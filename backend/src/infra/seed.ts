// Seed: ~10 paises + tax_rates (ES 21%), Plan A literal del enunciado y Plan B. Spec: 5.1, 6.1
//
// Datos exactos y su porque: ai-workspace/01-specs/modelo-datos.md 3.
// Se ejecuta automaticamente si el fichero .db no existe (referencia 2.1): el evaluador
// clona, npm run dev, y tiene datos. Es idempotente por construccion, porque solo corre
// sobre una base vacia.

import { existsSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
import type { Metric } from '@saas/pricing'
import { config } from '../config'
import { normalizeFiscalId } from '../domain/tax-id/normalize'
import { validatorFor } from '../domain/tax-id/registry'
import { openDb, type Db } from './db'
import { migrate } from './migrate'

// ---------------------------------------------------------------------------
// Paises. Spec: modelo-datos.md 3.1
// ---------------------------------------------------------------------------

type SeedCountry = {
  code: string
  name: string
  /** Clave del registro de validadores. null = PassThrough (referencia 7.3). */
  scheme: string | null
  /** SOLO presentacion: preselecciona el desplegable. Jamas afecta a la facturacion. */
  displayCurrency: string
}

/**
 * El criterio de seleccion NO es "los mas grandes": es que exista un tipo impositivo
 * estandar de ambito estatal, porque la cobertura fiscal es lo que define el universo de
 * paises (referencia 6.1) y un pais sin tipo calculable es inexpresable por diseno.
 *
 * Solo ES lleva esquema fiscal: los otros nueve van a PassThroughValidator. Ese es el
 * caso mayoritario del mundo real, y asi el fallback esta ejercitado por el seed y no
 * solo por un test.
 *
 * GB, CH y JP no son decorado: dan tres divisas de presentacion distintas de la de
 * facturacion, que es lo unico que prueba de verdad el 4.1 en pantalla. JP ejercita
 * minor_unit = 0 (el yen no tiene decimales); CH aporta el unico tipo con decimal del
 * seed (810 bp = 8,1 %), y un seed donde todos los tipos son multiplos de 100 no
 * distingue un rate_bp correcto de un rate_pct con suerte.
 *
 * Estados Unidos esta excluido a proposito: no tiene tipo indirecto federal (el sales
 * tax es estatal y depende del nexo). Ponerlo a 0 seria escribir una mentira en la base
 * de datos. USD sigue disponible como divisa de VISUALIZACION, que es independiente del
 * pais. Spec: 03-proceso/recortes-conscientes.md 3
 */
const COUNTRIES: readonly SeedCountry[] = [
  { code: 'ES', name: 'España', scheme: 'ES_NIF', displayCurrency: 'EUR' },
  { code: 'PT', name: 'Portugal', scheme: null, displayCurrency: 'EUR' },
  { code: 'FR', name: 'Francia', scheme: null, displayCurrency: 'EUR' },
  { code: 'DE', name: 'Alemania', scheme: null, displayCurrency: 'EUR' },
  { code: 'IT', name: 'Italia', scheme: null, displayCurrency: 'EUR' },
  { code: 'NL', name: 'Países Bajos', scheme: null, displayCurrency: 'EUR' },
  { code: 'IE', name: 'Irlanda', scheme: null, displayCurrency: 'EUR' },
  { code: 'GB', name: 'Reino Unido', scheme: null, displayCurrency: 'GBP' },
  { code: 'CH', name: 'Suiza', scheme: null, displayCurrency: 'CHF' },
  { code: 'JP', name: 'Japón', scheme: null, displayCurrency: 'JPY' },
]

// ---------------------------------------------------------------------------
// Tipos impositivos. Spec: modelo-datos.md 3.1 / referencia 6.2
// ---------------------------------------------------------------------------

type SeedRate = { country: string; vigenteDesde: string; rateBp: number }

/**
 * Nota de procedencia: son datos de seed documentados para una herramienta de
 * simulacion interna, no una fuente fiscal. La v1 no tiene panel de impuestos: se
 * actualizan por seed/redeploy, que es el supuesto declarado en referencia 6.1.
 */
const TAX_RATES: readonly SeedRate[] = [
  // España lleva DOS filas deliberadamente: al arrancar debe resolverse 21 %, nunca
  // 18 %. Es lo que ejercita la regla de vigencia (mayor vigente_desde <= hoy) con datos
  // reales y no solo con fixtures. El caso simetrico (una fila FUTURA que no debe
  // aplicarse) no va en el seed -seria un tipo inventado- y vive en los tests.
  { country: 'ES', vigenteDesde: '2010-07-01', rateBp: 1800 },
  { country: 'ES', vigenteDesde: '2012-09-01', rateBp: 2100 },

  { country: 'PT', vigenteDesde: '2011-01-01', rateBp: 2300 },
  { country: 'FR', vigenteDesde: '2014-01-01', rateBp: 2000 },
  { country: 'DE', vigenteDesde: '2007-01-01', rateBp: 1900 },
  { country: 'IT', vigenteDesde: '2013-10-01', rateBp: 2200 },
  { country: 'NL', vigenteDesde: '2012-10-01', rateBp: 2100 },
  { country: 'IE', vigenteDesde: '2012-01-01', rateBp: 2300 },
  { country: 'GB', vigenteDesde: '2011-01-04', rateBp: 2000 },
  { country: 'CH', vigenteDesde: '2024-01-01', rateBp: 810 },
  { country: 'JP', vigenteDesde: '2019-10-01', rateBp: 1000 },
]

// ---------------------------------------------------------------------------
// Planes. Spec: modelo-datos.md 3.2 / referencia 5.1
// ---------------------------------------------------------------------------

type SeedTier = {
  metric: Metric
  /** Limite superior INCLUSIVO. null = infinito, y debe ser el ultimo de su metrica. */
  upTo: number | null
  unitPriceMinor: number
}

type SeedPlan = {
  name: string
  version: number
  active: boolean
  description: string
  currency: string
  /** El sort_order NO se declara: se deriva del orden de este array, por metrica. */
  tiers: readonly SeedTier[]
}

/**
 * Nombres y tramos tomados del prototipo de Claude Design (SaaS-O-Matic.dc.html), que es
 * la fuente del producto. El enunciado no nombra los planes: solo fija los tramos
 * 10/8/5, que Agora v2 respeta.
 */
const PLANS: readonly SeedPlan[] = [
  {
    // La version vieja, ARCHIVADA. No es adorno: Fjord Systems sigue apuntando aqui, y
    // es lo unico que hace visible en pantalla que un precio publicado es inmutable
    // (referencia 5.5) y que "los clientes actuales mantienen su tarifa" es cierto y no
    // una frase de un documento.
    name: 'Plan Ágora',
    version: 1,
    active: false,
    description: 'Tarifa por usuario activo. Versión anterior, ya no se ofrece a clientes nuevos.',
    currency: 'EUR',
    tiers: [
      { metric: 'users', upTo: 10, unitPriceMinor: 1200 },
      { metric: 'users', upTo: null, unitPriceMinor: 700 },
    ],
  },
  {
    // Los tramos LITERALES del enunciado. Es el caso que el evaluador va a probar:
    // 15 usuarios -> 10x1000 + 5x800 = 14000 minor = 140 EUR, mas 21 % = 169,40 EUR.
    name: 'Plan Ágora',
    version: 2,
    active: true,
    description: 'Tarifa por usuario activo. El precio por usuario baja según crece el equipo.',
    currency: 'EUR',
    tiers: [
      { metric: 'users', upTo: 10, unitPriceMinor: 1000 },
      { metric: 'users', upTo: 50, unitPriceMinor: 800 },
      { metric: 'users', upTo: null, unitPriceMinor: 500 },
    ],
  },
  {
    name: 'Plan Bitácora',
    version: 1,
    active: true,
    description: 'Tarifa por almacenamiento contratado. No cobra por usuarios ni por llamadas a la API.',
    currency: 'EUR',
    tiers: [
      { metric: 'storage_gb', upTo: 100, unitPriceMinor: 1300 },
      { metric: 'storage_gb', upTo: 500, unitPriceMinor: 700 },
      { metric: 'storage_gb', upTo: 2000, unitPriceMinor: 400 },
      { metric: 'storage_gb', upTo: null, unitPriceMinor: 200 },
    ],
  },
  {
    // El multi-metrica. El 5.2 (un plan es un conjunto de metricas, cada una con su
    // tabla) es la abstraccion central del diseno, y sin un plan asi en el seed solo se
    // demuestra en un test unitario, nunca en pantalla: aqui el simulador ensena tres
    // bloques sumando, y por contraste el callout "esta metrica no afecta al coste"
    // aparece en Agora y en Bitacora.
    name: 'Plan Cúspide',
    version: 1,
    active: true,
    description: 'Combina usuarios, almacenamiento y llamadas a la API en una sola tarifa.',
    currency: 'EUR',
    tiers: [
      { metric: 'users', upTo: 20, unitPriceMinor: 900 },
      { metric: 'users', upTo: null, unitPriceMinor: 600 },
      { metric: 'storage_gb', upTo: 500, unitPriceMinor: 500 },
      { metric: 'storage_gb', upTo: null, unitPriceMinor: 300 },
      { metric: 'api_calls', upTo: 50_000, unitPriceMinor: 2 },
      { metric: 'api_calls', upTo: null, unitPriceMinor: 1 },
    ],
  },
]

// ---------------------------------------------------------------------------
// Clientes de demo. Spec: modelo-datos.md 3.3
// ---------------------------------------------------------------------------

type SeedCustomer = {
  companyName: string
  /** Tal y como lo tecleria un humano: el seed lo normaliza, igual que el endpoint. */
  fiscalId: string
  email: string
  country: string
  planName: string
  /** La VERSION concreta del plan. Un cliente apunta a una fila, no a un nombre (5.5). */
  planVersion: number
}

/**
 * (propuesto) Sin clientes, el evaluador entra al dashboard y ve el estado vacio: el
 * buscador, las cards y el historial -tres de las cuatro vistas obligatorias- solo se
 * pueden juzgar dando de alta datos a mano primero.
 *
 * El `fiscal_id_type` NO se declara aqui: lo dice el validador (ver seed()). Declararlo
 * a mano permitiria escribir 'DNI' junto a un CIF y que nadie se enterase.
 *
 * Los CIF son SINTETICOS y con digito de control correcto (no son de empresas reales).
 * B12345674: pares 2+4+6 = 12; impares duplicados 1,3,5,7 -> 2,6,10,14 -> 2+6+1+5 = 14;
 * total 26 -> control (10 - 6) mod 10 = 4.
 *
 * El seed NO crea simulaciones: el estado vacio del historial es una vista que hay que
 * poder ver, y crear la primera simulacion es justo el flujo que el evaluador recorre.
 */
const CUSTOMERS: readonly SeedCustomer[] = [
  {
    companyName: 'Nébula Cloud S.L.',
    // Sin normalizar a proposito: asi el seed ejercita el mismo camino que el alta.
    fiscalId: 'b-1234 5674',
    email: 'admin@nebula.example',
    country: 'ES',
    planName: 'Plan Ágora',
    planVersion: 2,
  },
  {
    // Existe para que 'unvalidated' y una divisa de presentacion != EUR aparezcan en la
    // UI desde el primer arranque, y para ensenar el plan multi-metrica.
    companyName: 'Meridian Data Ltd.',
    fiscalId: 'GB428291',
    email: 'ops@meridian.example',
    country: 'GB',
    planName: 'Plan Cúspide',
    planVersion: 1,
  },
  {
    // Un DNI entre tantos CIF: el validador espanol despacha por formato, y aqui se ve.
    companyName: 'Talleres Duero',
    fiscalId: '12345678Z',
    email: 'gestion@duero.example',
    country: 'ES',
    planName: 'Plan Bitácora',
    planVersion: 1,
  },
  {
    // EL CLIENTE QUE IMPORTA: apunta a la version ARCHIVADA de Agora. Es el unico que
    // hace visible el 5.5 en pantalla -su ficha dice "Mantiene su tarifa contratada" y
    // simula con 1200/700, no con los tramos de hoy-. Sin el, el versionado solo existe
    // en un test.
    companyName: 'Fjord Systems AS',
    fiscalId: 'NO993110',
    email: 'hei@fjord.example',
    country: 'DE',
    planName: 'Plan Ágora',
    planVersion: 1,
  },
]

// ---------------------------------------------------------------------------
// Siembra
// ---------------------------------------------------------------------------

/**
 * Puebla una base de datos VACIA con el esquema ya aplicado.
 *
 * Todo en una transaccion: un seed a medias es peor que ninguno, porque arranca el
 * servidor con paises sin tipo y revienta el chequeo de integridad con un error que no
 * explica la causa real.
 *
 * El seed es un CAMINO DE ESCRITURA y pasa por el mismo validador fiscal que
 * POST /customers: normaliza, resuelve el validador por el esquema del pais y le pregunta
 * el tipo. Un seed que introduce datos que el sistema rechazaria es una bomba de
 * relojeria, y ademas nadie tiene que recalcular a mano un digito de control nunca mas.
 *
 * PENDIENTE (Fase 2): falta pasar los planes por el validador de plantilla, que aun no
 * existe. Importa porque el motor confia en que los tramos son coherentes sin
 * comprobarlo (01-motor-tramos-y-simulaciones.md 4).
 */
export function seed(db: Db): void {
  const ahora = new Date().toISOString()

  // Sentencias preparadas en el 100 % de las consultas (referencia 14.2).
  const insertCountry = db.prepare(
    'INSERT INTO countries (code, name, tax_id_scheme, display_currency) VALUES (?, ?, ?, ?)',
  )
  const insertRate = db.prepare(
    'INSERT INTO tax_rates (country, vigente_desde, rate_bp) VALUES (?, ?, ?)',
  )
  const insertPlan = db.prepare(
    `INSERT INTO plans (name, version, description, pricing_model, currency, active, created_at)
     VALUES (?, ?, ?, 'graduated', ?, ?, ?)`,
  )
  const insertTier = db.prepare(
    `INSERT INTO plan_tiers (plan_id, metric, up_to, unit_price_minor, sort_order)
     VALUES (?, ?, ?, ?, ?)`,
  )
  const insertCustomer = db.prepare(
    `INSERT INTO customers (company_name, fiscal_id, fiscal_id_type, email, country, plan_id, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  )

  db.transaction(() => {
    for (const c of COUNTRIES) {
      insertCountry.run(c.code, c.name, c.scheme, c.displayCurrency)
    }
    for (const r of TAX_RATES) {
      insertRate.run(r.country, r.vigenteDesde, r.rateBp)
    }

    // Clave por (nombre, version): un cliente apunta a una FILA concreta, no a un nombre.
    // Con dos versiones de Agora vivas, la clave por nombre a secas mandaria a todo el
    // mundo a la ultima insertada, que es justo el bug que el versionado evita.
    const planIds = new Map<string, number>()
    for (const p of PLANS) {
      const planId = Number(
        insertPlan.run(p.name, p.version, p.description, p.currency, p.active ? 1 : 0, ahora)
          .lastInsertRowid,
      )
      planIds.set(`${p.name}#${p.version}`, planId)

      // El sort_order se deriva del orden del array, contando por metrica: declararlo a
      // mano permitiria escribir un orden que contradice los cortes, y entonces habria
      // dos fuentes de verdad para "cual es el primer tramo".
      const siguienteOrden = new Map<Metric, number>()
      for (const t of p.tiers) {
        const sortOrder = siguienteOrden.get(t.metric) ?? 0
        siguienteOrden.set(t.metric, sortOrder + 1)
        insertTier.run(planId, t.metric, t.upTo, t.unitPriceMinor, sortOrder)
      }
    }

    for (const c of CUSTOMERS) {
      const planId = planIds.get(`${c.planName}#${c.planVersion}`)
      if (planId === undefined) {
        throw new Error(
          `Seed incoherente: el cliente "${c.companyName}" apunta a "${c.planName}" v${c.planVersion}, que no esta en PLANS.`,
        )
      }

      const pais = COUNTRIES.find((p) => p.code === c.country)
      if (pais === undefined) {
        throw new Error(
          `Seed incoherente: el cliente "${c.companyName}" es del pais "${c.country}", que no esta en COUNTRIES.`,
        )
      }

      // El mismo camino que POST /customers: normalizar -> resolver validador por el
      // esquema del pais -> validar. El tipo lo dice el validador; no se declara.
      const fiscalId = normalizeFiscalId(c.fiscalId)
      const { valid, type } = validatorFor(pais.scheme).validate(fiscalId)
      if (!valid) {
        throw new Error(
          `Seed incoherente: el fiscal_id "${fiscalId}" de "${c.companyName}" no pasa el ` +
            `validador de ${c.country}. Un seed no puede sembrar lo que el alta rechazaria.`,
        )
      }

      insertCustomer.run(c.companyName, fiscalId, type, c.email, c.country, planId, ahora)
    }
  })()
}

/**
 * Abre la base de datos y, si no existia, crea el esquema y la puebla. Es el "seed
 * automatico en el primer arranque" de referencia 2.1, y lo que sostiene el camino unico
 * del README: clonar -> npm install -> npm run dev.
 *
 * La existencia se comprueba ANTES de abrir a proposito: abrir crea el fichero vacio, y
 * despues ya no habria forma de distinguir "primera vez" de "base existente".
 */
export function ensureDatabase(path: string): Db {
  const esPrimeraVez = !existsSync(path)
  const db = openDb(path)

  if (esPrimeraVez) {
    migrate(db)
    seed(db)
  }

  return db
}

// ---------------------------------------------------------------------------
// CLI: npm run seed
// ---------------------------------------------------------------------------

function main(): void {
  const db = openDb(config.dbPath)
  migrate(db)

  const { n } = db.prepare('SELECT COUNT(*) AS n FROM plans').get() as { n: number }
  if (n > 0) {
    // Refuse ruidoso en vez de sembrar encima: insertar sobre una base ya poblada
    // reventaria con un choque de UNIQUE que no explica nada.
    console.error(`La base de datos de ${config.dbPath} ya está sembrada (${n} planes).`)
    console.error('El seed solo corre sobre una base vacía: borra el fichero .db y vuelve a ejecutarlo.')
    db.close()
    process.exit(1)
  }

  seed(db)
  db.close()
  console.log(
    `Base sembrada en ${config.dbPath}: ${COUNTRIES.length} países, ${PLANS.length} planes, ${CUSTOMERS.length} clientes de demo.`,
  )
}

const esEjecucionDirecta =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href

if (esEjecucionDirecta) {
  main()
}
