// Editar = version nueva + archivar la anterior. Spec: 5.5

import type { Db } from '../../infra/db'
import { AppError } from '../../plugins/error-handler'
import type { PlanWithTiers } from '../customers/customers.repo'
import { validarPlantilla, type Plantilla } from './plan-template.validation'
import {
  archivarPlan,
  deletePlanFisico,
  findPlanById,
  insertPlan,
  nombreActivoOcupado,
  planEnUso,
  siguienteVersion,
} from './plans.repo'

/**
 * Lanza si la plantilla no cuadra, con TODAS las violaciones dentro.
 *
 * `violations` viaja en el sobre de error para que la UI pinte cada error sobre la fila
 * afectada (diseño-frontend.md, ventana 7). `rule` es el codigo estable; `message` es la
 * traduccion a lenguaje de admin.
 */
function assertPlantillaValida(plantilla: Plantilla): void {
  const violations = validarPlantilla(plantilla)
  if (violations.length === 0) return

  throw new AppError(
    422,
    'PLAN_TEMPLATE_INVALID',
    // El primer mensaje es el que se ve si la UI no sabe pintar `violations`: que sea uno
    // util y no un "hay errores".
    violations[0]?.message ?? 'La configuración de tramos no es correcta.',
    'tiers',
    { violations },
  )
}

/**
 * Crear un plan nuevo. Version 1 y activo... casi siempre.
 *
 * El nombre de un plan ARCHIVADO se puede reutilizar -si no, archivar quemaria el nombre
 * para siempre-, y entonces la version NO es 1: es la siguiente de ese nombre.
 *
 * Es coherente y no un parche: `UNIQUE (name, version)` significa que el NOMBRE es la
 * identidad del linaje, asi que reutilizarlo es continuarlo. Las versiones viejas siguen
 * en el historico bajo el mismo nombre, que es exactamente lo que el admin espera ver.
 * Fijar `version = 1` aqui choca contra el UNIQUE en cuanto ese nombre tuvo una v1.
 */
export function crearPlan(db: Db, plantilla: Plantilla): PlanWithTiers {
  assertPlantillaValida(plantilla)

  if (nombreActivoOcupado(db, plantilla.name)) {
    throw new AppError(
      409,
      'PLAN_NAME_TAKEN',
      `Ya hay un plan activo que se llama «${plantilla.name}».`,
      'name',
    )
  }

  return insertPlan(db, plantilla, siguienteVersion(db, plantilla.name), true)
}

/**
 * "Editar" = crear version nueva y archivar la anterior. NO modifica el plan.
 *
 * Por que "el admin edita con conocimiento de causa" no se sostiene (referencia 5.5): no
 * es un problema de competencia, es que NO PUEDE VER LAS CONSECUENCIAS DESDE SU PANTALLA
 * -no sabe que presupuestos se enviaron con ese tramo ni que clientes estan dados de alta
 * con ese plan-. Ninguna advertencia arregla informacion que no esta en la pantalla.
 *
 * Los clientes existentes SIGUEN APUNTANDO AL plan_id ANTIGUO: eso es la feature, no un
 * efecto secundario.
 */
export function versionarPlan(db: Db, id: number, plantilla: Plantilla): PlanWithTiers {
  const actual = findPlanById(db, id)
  if (actual === undefined) {
    throw new AppError(404, 'PLAN_NOT_FOUND', 'Ese plan no existe.')
  }

  // No se versiona desde una version ya archivada: crearia una v3 a partir de la v1
  // mientras la v2 sigue activa -dos ramas vivas del mismo plan y ninguna forma de saber
  // cual manda-. El versionado es lineal a proposito.
  if (!actual.active) {
    throw new AppError(
      422,
      'PLAN_ALREADY_ARCHIVED',
      'Ese plan ya está archivado: no se puede crear una versión nueva a partir de él.',
    )
  }

  assertPlantillaValida(plantilla)

  // El nombre se hereda del plan que se versiona: "editar" no puede renombrar, porque
  // v1 y v2 tienen que compartir nombre para que "la version anterior de este plan"
  // signifique algo.
  const conNombre: Plantilla = { ...plantilla, name: actual.name }
  const version = siguienteVersion(db, actual.name)

  // LA UNICA TRANSACCION DEL BACKEND, y hace falta: son dos escrituras y una caida entre
  // ellas dejaria DOS VERSIONES ACTIVAS del mismo plan. El selector del alta mostraria el
  // plan duplicado sin que nada estuviera "roto" de forma detectable, que es la peor
  // clase de fallo.
  return db.transaction(() => {
    const nuevo = insertPlan(db, conNombre, version, true)
    archivarPlan(db, actual.id)
    return nuevo
  })()
}

/**
 * "Borrar" = archivar... salvo el plan JAMAS USADO, que se elimina de verdad (ADR 0013).
 *
 * La regla original ("nunca borrado fisico") protege dos cosas: la integridad
 * referencial y los presupuestos ya emitidos. Un plan con CERO clientes y CERO
 * simulaciones no tiene ni una ni otros: conservar para siempre el plan que un admin
 * creo por error no protege nada — solo acumula ruido en el panel. La condicion es
 * estricta (cero referencias de ambos tipos) y la decide el servidor, no la pantalla.
 *
 * Para un plan usado, todo sigue igual: archivar, y 422 si ya lo estaba.
 */
export function archivarOEliminar(db: Db, id: number): PlanWithTiers & { removed: boolean } {
  const plan = findPlanById(db, id)
  if (plan === undefined) {
    throw new AppError(404, 'PLAN_NOT_FOUND', 'Ese plan no existe.')
  }

  if (!planEnUso(db, id)) {
    // Sin referencias no hay nada que archivar "para los clientes actuales": se borra.
    // Tambien un ARCHIVADO sin uso (una version vieja que nadie llego a contratar): el
    // 422 de "ya archivado" es para el caso usado, donde borrar dos veces no significa
    // nada; aqui la intencion "quitalo de en medio" si tiene un cumplimiento posible.
    deletePlanFisico(db, id)
    return { ...plan, active: false, removed: true }
  }

  if (!plan.active) {
    throw new AppError(422, 'PLAN_ALREADY_ARCHIVED', 'Ese plan ya está archivado.')
  }

  archivarPlan(db, id)

  const archivado = findPlanById(db, id)
  if (archivado === undefined) throw new Error('El plan archivado no se encuentra.')
  return { ...archivado, removed: false }
}
