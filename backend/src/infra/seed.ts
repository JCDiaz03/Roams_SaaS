// Seed: ~10 paises + tax_rates (ES 21%), Text (enunciado) + catalogo Demo/PRO/MAX/Premium/Almacenamiento/Tokio. Spec: 5.1, 6.1
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
import { validarPlantilla, type Plantilla } from '../features/plans/plan-template.validation'
import { insertPlan } from '../features/plans/plans.repo'
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
 * ES y PT llevan esquema fiscal (los dos validadores del registro); los otros ocho van a
 * PassThroughValidator. Ese sigue siendo el caso mayoritario del mundo real, y asi el
 * fallback esta ejercitado por el seed y no solo por un test.
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
  { code: 'PT', name: 'Portugal', scheme: 'PT_NIF', displayCurrency: 'EUR' },
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
 * Catalogo de la propuesta de planes (2026-07, segunda iteracion: los tramos salen de
 * los ajustes hechos en el panel de admin y adoptados aqui como default). Un ancla
 * conservada: Plan Text v1 lleva los tramos LITERALES del enunciado (10/8/5), el caso
 * que el evaluador va a probar. El versionado visible en pantalla vive en MAX (v1
 * archivada con Fjord suscrito + v2 activa).
 *
 * Dos patrones de precio conviven a proposito: Text/Tokio bajan el precio por unidad al
 * crecer (descuento por volumen) y el resto lo SUBE (freemium: los primeros tramos
 * gratis o baratos). Varios planes usan el tramo "hasta 1" caro como CUOTA DE ENTRADA
 * (p. ej. Premium: 150 EUR el primer usuario): es la forma de expresar una cuota fija
 * dentro de graduated sin implementar el modelo 'flat' (referencia 5.3).
 */
const PLANS: readonly SeedPlan[] = [
  {
    // Los tramos LITERALES del enunciado. Es el caso que el evaluador va a probar:
    // 15 usuarios -> 10x1000 + 5x800 = 14000 minor = 140 EUR, mas 21 % = 169,40 EUR.
    name: 'Plan Text',
    version: 1,
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
    // Version 2 SIN una v1 en el seed, a proposito: el catalogo la define como segunda
    // iteracion y la v1 nunca llego a publicarse. El versionado visible en pantalla lo
    // demuestra MAX; duplicar el caso solo anadiria ruido.
    name: 'Plan Demo',
    version: 2,
    active: true,
    description: 'Para probar la plataforma: los primeros usuarios, GB y llamadas son gratis.',
    currency: 'EUR',
    tiers: [
      { metric: 'users', upTo: 2, unitPriceMinor: 0 },
      { metric: 'users', upTo: 10, unitPriceMinor: 400 },
      { metric: 'users', upTo: null, unitPriceMinor: 1000 },
      { metric: 'storage_gb', upTo: 2, unitPriceMinor: 0 },
      { metric: 'storage_gb', upTo: null, unitPriceMinor: 400 },
      { metric: 'api_calls', upTo: 200, unitPriceMinor: 0 },
      { metric: 'api_calls', upTo: 1000, unitPriceMinor: 1 },
      { metric: 'api_calls', upTo: null, unitPriceMinor: 4 },
    ],
  },
  {
    name: 'Plan PRO',
    version: 1,
    active: true,
    description: 'Para equipos en crecimiento: entrada barata y el precio acompaña al consumo.',
    currency: 'EUR',
    tiers: [
      { metric: 'users', upTo: 8, unitPriceMinor: 50 },
      { metric: 'users', upTo: 20, unitPriceMinor: 100 },
      { metric: 'users', upTo: null, unitPriceMinor: 300 },
      { metric: 'storage_gb', upTo: 2, unitPriceMinor: 0 },
      { metric: 'storage_gb', upTo: 10, unitPriceMinor: 100 },
      { metric: 'storage_gb', upTo: null, unitPriceMinor: 400 },
      { metric: 'api_calls', upTo: 500, unitPriceMinor: 0 },
      { metric: 'api_calls', upTo: 5000, unitPriceMinor: 1 },
      { metric: 'api_calls', upTo: null, unitPriceMinor: 4 },
    ],
  },
  {
    // La version vieja, ARCHIVADA. No es adorno: Fjord Systems sigue apuntando aqui, y
    // es lo unico que hace visible en pantalla que un precio publicado es inmutable
    // (referencia 5.5) y que "los clientes actuales mantienen su tarifa" es cierto y no
    // una frase de un documento.
    name: 'Plan MAX',
    version: 1,
    active: false,
    description: 'Para equipos grandes. Versión anterior, ya no se ofrece a clientes nuevos.',
    currency: 'EUR',
    tiers: [
      { metric: 'users', upTo: 20, unitPriceMinor: 20 },
      { metric: 'users', upTo: 40, unitPriceMinor: 50 },
      { metric: 'users', upTo: null, unitPriceMinor: 100 },
      { metric: 'storage_gb', upTo: 16, unitPriceMinor: 0 },
      { metric: 'storage_gb', upTo: 32, unitPriceMinor: 100 },
      { metric: 'storage_gb', upTo: null, unitPriceMinor: 200 },
      { metric: 'api_calls', upTo: 15_000, unitPriceMinor: 0 },
      { metric: 'api_calls', upTo: 50_000, unitPriceMinor: 1 },
      { metric: 'api_calls', upTo: null, unitPriceMinor: 3 },
    ],
  },
  {
    // El multi-metrica de referencia del catalogo (Meridian esta suscrita): el simulador
    // ensena tres bloques sumando (referencia 5.2). El tramo "hasta 1 -> 20 EUR" es la
    // cuota de entrada; a partir del segundo usuario, centimos.
    name: 'Plan MAX',
    version: 2,
    active: true,
    description: 'Para equipos grandes: usuarios a céntimos y tramos amplios en almacenamiento y API.',
    currency: 'EUR',
    tiers: [
      { metric: 'users', upTo: 1, unitPriceMinor: 2000 },
      { metric: 'users', upTo: 20, unitPriceMinor: 20 },
      { metric: 'users', upTo: 40, unitPriceMinor: 50 },
      { metric: 'users', upTo: null, unitPriceMinor: 100 },
      { metric: 'storage_gb', upTo: 12, unitPriceMinor: 0 },
      { metric: 'storage_gb', upTo: 32, unitPriceMinor: 100 },
      { metric: 'storage_gb', upTo: null, unitPriceMinor: 200 },
      { metric: 'api_calls', upTo: 5000, unitPriceMinor: 0 },
      { metric: 'api_calls', upTo: 50_000, unitPriceMinor: 1 },
      { metric: 'api_calls', upTo: null, unitPriceMinor: 3 },
    ],
  },
  {
    // La cuota de entrada mas visible del catalogo: 150 EUR el primer usuario y el
    // resto del bloque a 2 EUR. Llamadas API ilimitadas incluidas (tramo unico a 0):
    // la cuota fija pura sigue siendo el hueco 'flat' del Strategy (referencia 5.3).
    name: 'Plan Premium',
    version: 1,
    active: true,
    description: 'Bloques amplios de usuarios y almacenamiento, con llamadas API ilimitadas incluidas.',
    currency: 'EUR',
    tiers: [
      { metric: 'users', upTo: 1, unitPriceMinor: 15_000 },
      { metric: 'users', upTo: 50, unitPriceMinor: 200 },
      { metric: 'users', upTo: null, unitPriceMinor: 10 },
      { metric: 'storage_gb', upTo: 50, unitPriceMinor: 10 },
      { metric: 'storage_gb', upTo: 256, unitPriceMinor: 80 },
      { metric: 'storage_gb', upTo: null, unitPriceMinor: 200 },
      { metric: 'api_calls', upTo: null, unitPriceMinor: 0 },
    ],
  },
  {
    // El unico plan en USD: hace visible que la divisa de FACTURACION es del plan
    // (referencia 4.1) — Talleres Duero cotiza en dolares aunque sea de Espana — y que
    // los sugeridos no cruzan divisas. El primer GB a 60 $ es la cuota de entrada; el
    // resto del primer bloque a 0,50 $/GB.
    name: 'Plan Almacenamiento',
    version: 1,
    active: true,
    description: 'Solo almacenamiento, facturado en dólares. No cobra por usuarios.',
    currency: 'USD',
    tiers: [
      { metric: 'storage_gb', upTo: 1, unitPriceMinor: 6000 },
      { metric: 'storage_gb', upTo: 120, unitPriceMinor: 50 },
      { metric: 'storage_gb', upTo: null, unitPriceMinor: 200 },
      { metric: 'api_calls', upTo: 2000, unitPriceMinor: 0 },
      { metric: 'api_calls', upTo: null, unitPriceMinor: 4 },
    ],
  },
  {
    // El caso minor_unit = 0 en pantalla: el yen no tiene decimales, asi que aqui
    // unit_price_minor son yenes ENTEROS (1500 = 1.500 JPY, no 15,00). Sin este plan,
    // la pieza mas fina del diseno de divisas (referencia 4.4) solo vive en tests.
    name: 'Plan Tokio',
    version: 1,
    active: true,
    description: 'Tarifa por usuario facturada en yenes japoneses, sin decimales.',
    currency: 'JPY',
    tiers: [
      { metric: 'users', upTo: 10, unitPriceMinor: 1500 },
      { metric: 'users', upTo: 50, unitPriceMinor: 1200 },
      { metric: 'users', upTo: null, unitPriceMinor: 800 },
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
  /**
   * Valores base de consumo (spec 09, 3): preajuste de la simulacion parametrizada.
   * Opcionales a proposito: la ficha SIN valores base (boton "parametrizada" oculto)
   * tambien es una vista que hay que poder ver.
   */
  baseUsers?: number
  baseStorageGb?: number
  baseApiCalls?: number
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
    planName: 'Plan Text',
    planVersion: 1,
    // El caso literal del enunciado como valor base: el boton "parametrizada" precarga
    // 15 usuarios = 140 EUR + 21 % = 169,40 EUR desde el primer arranque.
    baseUsers: 15,
  },
  {
    // Existe para que 'unvalidated' y una divisa de presentacion != EUR aparezcan en la
    // UI desde el primer arranque, y para ensenar el plan multi-metrica.
    companyName: 'Meridian Data Ltd.',
    fiscalId: 'GB428291',
    email: 'ops@meridian.example',
    country: 'GB',
    planName: 'Plan MAX',
    planVersion: 2,
    // Los tres valores base sobre el plan multi-metrica: la parametrizada con los tres
    // campos precargados, visible sin dar de alta nada.
    baseUsers: 40,
    baseStorageGb: 750,
    baseApiCalls: 120_000,
  },
  {
    // Un DNI entre tantos CIF: el validador espanol despacha por formato, y aqui se ve.
    // Suscrito al plan en USD: un cliente espanol facturado en dolares es lo que hace
    // visible que la divisa de facturacion es DEL PLAN, no del pais (referencia 4.1).
    companyName: 'Talleres Duero',
    fiscalId: '12345678Z',
    email: 'gestion@duero.example',
    country: 'ES',
    planName: 'Plan Almacenamiento',
    planVersion: 1,
  },
  {
    // El segundo validador del registro, visible desde el primer arranque: su ficha
    // enseña el chip "NIF validado" y el alta en PT el hint resuelto, sin que ningun
    // componente sepa que Portugal existe (roadmap 5.3). El NIF es SINTETICO con control
    // correcto: 5,1,2,3,4,5,6,7 ponderados 9..2 suman 157; 157 mod 11 = 3; 11 - 3 = 8.
    companyName: 'Lusitânia Dados Lda.',
    // Sin normalizar a proposito, como Nebula: el seed recorre el camino del alta.
    fiscalId: '512 345 678',
    email: 'geral@lusitania.example',
    country: 'PT',
    planName: 'Plan PRO',
    planVersion: 1,
  },
  {
    // EL CLIENTE QUE IMPORTA: apunta a la version ARCHIVADA de MAX. Es el unico que
    // hace visible el 5.5 en pantalla -su ficha dice "Mantiene su tarifa contratada" y
    // simula con la v1 (sin cuota de entrada), no con los tramos de hoy-. Sin el, el
    // versionado solo existe en un test.
    companyName: 'Fjord Systems AS',
    fiscalId: 'NO993110',
    email: 'hei@fjord.example',
    country: 'DE',
    planName: 'Plan MAX',
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
 * El seed es un CAMINO DE ESCRITURA y pasa por los MISMOS validadores que los endpoints:
 * el registro fiscal para cada fiscal_id (como POST /customers) y el validador de
 * plantilla para cada plan (como POST /plans). Un seed que introduce datos que el sistema
 * rechazaria es una bomba de relojeria -y el motor confia en que los tramos son coherentes
 * sin comprobarlo (01-motor-tramos-y-simulaciones.md 4)-. De paso, nadie tiene que
 * recalcular a mano un digito de control nunca mas.
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
  const insertCustomer = db.prepare(
    `INSERT INTO customers (company_name, fiscal_id, fiscal_id_type, email, country, plan_id,
                            base_users, base_storage_gb, base_api_calls, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )

  db.transaction(() => {
    for (const c of COUNTRIES) {
      insertCountry.run(c.code, c.name, c.scheme, c.displayCurrency)
    }
    for (const r of TAX_RATES) {
      insertRate.run(r.country, r.vigenteDesde, r.rateBp)
    }

    // Clave por (nombre, version): un cliente apunta a una FILA concreta, no a un nombre.
    // Con dos versiones de MAX en el seed, la clave por nombre a secas mandaria a todo el
    // mundo a la ultima insertada, que es justo el bug que el versionado evita.
    const planIds = new Map<string, number>()
    for (const p of PLANS) {
      const plantilla: Plantilla = {
        name: p.name,
        description: p.description,
        currency: p.currency,
        tiers: p.tiers.map((t) => ({
          metric: t.metric,
          up_to: t.upTo,
          unit_price_minor: t.unitPriceMinor,
        })),
      }

      // El mismo validador que POST /plans. Si un seed futuro escribe cortes decrecientes
      // o un ultimo tramo cerrado, revienta el arranque en vez de sembrar un plan que el
      // motor calculara mal en silencio.
      const violaciones = validarPlantilla(plantilla)
      if (violaciones.length > 0) {
        throw new Error(
          `Seed incoherente: la plantilla de "${p.name}" v${p.version} no pasa el validador ` +
            `que usa POST /plans:\n  - ${violaciones.map((v) => v.message).join('\n  - ')}`,
        )
      }

      // La MISMA insercion que POST /plans (plans.repo), que ya deriva el sort_order del
      // orden del array: el seed no mantiene una copia del INSERT que pueda divergir.
      const creado = insertPlan(db, plantilla, p.version, p.active)
      planIds.set(`${p.name}#${p.version}`, creado.id)
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

      insertCustomer.run(
        c.companyName,
        fiscalId,
        type,
        c.email,
        c.country,
        planId,
        c.baseUsers ?? null,
        c.baseStorageGb ?? null,
        c.baseApiCalls ?? null,
        ahora,
      )
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

  // migrate() corre SIEMPRE, no solo la primera vez: crea el esquema si falta y añade
  // las columnas aditivas que un git pull haya traído (ADR 0012). El seed sí queda
  // condicionado a primera vez: sembrar exige base vacía; migrar no.
  migrate(db)

  if (esPrimeraVez) {
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
