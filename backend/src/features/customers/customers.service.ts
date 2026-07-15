// Alta: normaliza, valida via registro por pais, persiste. Spec: 7

import { normalizeFiscalId } from '../../domain/tax-id/normalize'
import { validatorFor } from '../../domain/tax-id/registry'
import type { CountriesCache } from '../../infra/countries.cache'
import type { Db } from '../../infra/db'
import { AppError } from '../../plugins/error-handler'
import {
  findCustomerByFiscalId,
  findCustomerById,
  findPlanWithTiers,
  insertCustomer,
  type CustomerRow,
} from './customers.repo'

export type AltaCliente = {
  company_name: string
  fiscal_id: string
  email: string
  country: string
  plan_id: number
}

/**
 * El alta. Contrato: contrato-api.md 2.1.
 *
 * EL ORDEN ES LA FEATURE: el pais determina el validador, y el validador determina el
 * resultado. En ningun punto se compara `country === 'ES'`. Si algun dia hay que tocar
 * este flujo para anadir un pais, el diseno ha fallado.
 */
export function crearCliente(db: Db, countries: CountriesCache, datos: AltaCliente): CustomerRow {
  // 1. El pais, de la cache. Sin fila en `countries` no hay alta posible: "cliente de
  //    pais no soportado" es inexpresable (referencia 6.1, 7.3).
  const pais = countries.get(datos.country)
  if (pais === undefined) {
    throw new AppError(
      422,
      'COUNTRY_NOT_SUPPORTED',
      'Todavía no trabajamos con clientes de ese país.',
      'country',
    )
  }

  // 2. Normalizar ANTES de validar, y persistir la forma normalizada (referencia 7.4).
  const fiscalId = normalizeFiscalId(datos.fiscal_id)

  // 3. El registro elige el validador; el pais solo dice cual. Un pais sin esquema cae en
  //    PassThrough, que es una estrategia mas y no una rama.
  const { valid, type } = validatorFor(pais.scheme).validate(fiscalId)
  if (!valid) {
    throw new AppError(
      422,
      'FISCAL_ID_INVALID',
      'La letra de control no corresponde. Revisa el identificador.',
      'fiscal_id',
    )
  }

  // 4. El plan tiene que existir y estar ACTIVO. Un cliente nuevo no entra en un plan
  //    archivado; uno existente si puede simular con el suyo (spec 02, 5.3). La simetria
  //    aparente invita a "unificar" y romper una de las dos.
  const plan = findPlanWithTiers(db, datos.plan_id)
  if (plan === undefined) {
    throw new AppError(422, 'PLAN_NOT_FOUND', 'El plan elegido no existe.', 'plan_id')
  }
  if (!plan.active) {
    throw new AppError(
      422,
      'PLAN_ARCHIVED',
      'Ese plan ya no se ofrece a clientes nuevos. Elige otro.',
      'plan_id',
    )
  }

  // 5. Insertar y CAPTURAR la violacion de UNIQUE. No se consulta antes si existe: un
  //    SELECT seguido de INSERT es una condicion de carrera de manual -dos altas
  //    simultaneas del mismo CIF pasan las dos el SELECT y una revienta igual, solo que
  //    con un 500 en vez de un 409-.
  try {
    return insertCustomer(db, {
      company_name: datos.company_name,
      fiscal_id: fiscalId,
      fiscal_id_type: type,
      email: datos.email,
      country: datos.country,
      plan_id: datos.plan_id,
    })
  } catch (e) {
    if (!esUniqueDeFiscalId(e)) throw e

    // El SELECT va AQUI, en el camino de fallo, cuando ya se sabe que hay duplicado y no
    // hay carrera que perder. Se paga una consulta en el camino que casi nunca corre, en
    // vez de en el que corre siempre.
    const existente = findCustomerByFiscalId(db, fiscalId)

    throw new AppError(
      409,
      'FISCAL_ID_DUPLICATE',
      'Ya hay una empresa dada de alta con este identificador fiscal.',
      'fiscal_id',
      existente === undefined
        ? undefined
        : { existing_customer: { id: existente.id, company_name: existente.company_name } },
    )
  }
}

/**
 * Distingue el UNIQUE de fiscal_id de cualquier otro fallo de SQLite.
 *
 * Se mira el codigo Y el mensaje: sin lo segundo, un UNIQUE futuro sobre otra columna se
 * reportaria como "esta empresa ya existe", que es peor que un 500 honesto.
 */
function esUniqueDeFiscalId(e: unknown): boolean {
  if (!(e instanceof Error)) return false
  const code = (e as { code?: string }).code
  return code === 'SQLITE_CONSTRAINT_UNIQUE' && e.message.includes('customers.fiscal_id')
}

/** El cliente o un 404. Lo comparten el detalle y el historial. */
export function obtenerClienteOFallar(db: Db, id: number): CustomerRow {
  const cliente = findCustomerById(db, id)
  if (cliente === undefined) {
    throw new AppError(404, 'CUSTOMER_NOT_FOUND', 'No encontramos a ese cliente.')
  }
  return cliente
}
