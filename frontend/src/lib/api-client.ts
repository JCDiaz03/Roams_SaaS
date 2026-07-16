// Cliente HTTP contra el backend (mismo origen via proxy de Vite). Ref: 14.1

import type { CurrencyCode, Metric, MetricBreakdown, Tier } from '@saas/pricing'

// Rutas RELATIVAS: el navegador solo habla con su propio origen. En desarrollo lo
// mantiene literal el proxy de Vite hacia :3000 (referencia 14.1). Nadie debe "arreglar"
// el cruce de puertos poniendo aqui una URL absoluta y abriendo CORS.
const BASE = '/api'

// --- Tipos del contrato (contrato-api.md) -------------------------------------------

export type Country = {
  code: string
  name: string
  display_currency: CurrencyCode
  fiscal_id: { validated: boolean; hint: string }
}

export type Plan = {
  id: number
  name: string
  version: number
  description: string | null
  currency: CurrencyCode
  pricing_model: string
  active: boolean
  tiers: Tier[]
}

export type CustomerListItem = {
  id: number
  company_name: string
  fiscal_id: string
  fiscal_id_type: string
  country: string
  plan: { id: number; name: string; version: number }
  simulation_count: number
}

export type CustomerDetail = {
  id: number
  company_name: string
  fiscal_id: string
  fiscal_id_type: string
  email: string
  country: { code: string; name: string; display_currency: CurrencyCode }
  tax_rate_bp: number
  plan: Plan
  created_at: string
}

export type Simulation = {
  id: number
  customer_id: number
  plan_id: number
  inputs: { active_users: number; storage_gb: number; api_calls: number }
  currency: CurrencyCode
  base_minor: number
  tax_rate_bp: number
  tax_minor: number
  total_minor: number
  breakdown: MetricBreakdown[]
  created_at: string
}

export type Rates = {
  base: 'EUR'
  rates: Record<string, number>
  as_of: string
  next_update: string
  stale: boolean
}

/** La sesion tal y como la cuenta el servidor. El rol YA VIENE derivado (spec 07). */
export type SesionApi = { nombre: string; rol: 'admin' | 'sales' }

// --- Errores --------------------------------------------------------------------------

/**
 * Un error que el backend explico. Lleva `code` para decidir y `field` para pintar.
 *
 * La UI decide con `code`, NUNCA parseando `message`: el mensaje es texto de producto y
 * puede cambiar sin avisar (contrato-api.md 1.2).
 */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    override readonly message: string,
    readonly field?: string,
    readonly extra?: Record<string, unknown>,
  ) {
    super(message)
    this.name = 'ApiError'
  }

  /** true = el usuario ha escrito algo que no vale. Es flujo normal, no una anomalia. */
  get esDeValidacion(): boolean {
    return this.status === 422 || this.status === 409
  }
}

/** La red se cayo, o el servidor no respondio nada entendible. Otra pantalla distinta. */
export class NetworkError extends Error {
  constructor() {
    super('No hemos podido conectar. Comprueba tu conexión e inténtalo de nuevo.')
    this.name = 'NetworkError'
  }
}

/**
 * Aviso de sesion caducada. La registra el SessionProvider: cuando cualquier llamada
 * devuelve 401 AUTH_REQUIRED, la sesion local se limpia y la app vuelve al login. Un
 * callback de modulo y no un contexto: el cliente API no es un componente.
 */
let alCaducarSesion: (() => void) | null = null

export function onSesionCaducada(fn: () => void): void {
  alCaducarSesion = fn
}

async function pedir<T>(path: string, init?: RequestInit): Promise<T> {
  let respuesta: Response
  try {
    respuesta = await fetch(`${BASE}${path}`, {
      ...init,
      headers: { 'Content-Type': 'application/json', ...init?.headers },
    })
  } catch {
    // fetch solo rechaza por red. Un 500 NO pasa por aqui: es una respuesta.
    throw new NetworkError()
  }

  if (respuesta.status === 204) return undefined as T

  let cuerpo: unknown
  try {
    cuerpo = await respuesta.json()
  } catch {
    throw new NetworkError()
  }

  if (!respuesta.ok) {
    const e = (cuerpo as { error?: Record<string, unknown> }).error
    if (e === undefined) throw new NetworkError()

    const { code, message, field, ...extra } = e

    // Solo AUTH_REQUIRED (la sesion caduco o no existe), NO el 401 del login: unas
    // credenciales mal tecleadas no deben "cerrar la sesion" de nadie.
    if (respuesta.status === 401 && code === 'AUTH_REQUIRED') alCaducarSesion?.()

    throw new ApiError(
      respuesta.status,
      String(code),
      String(message),
      field === undefined ? undefined : String(field),
      extra,
    )
  }

  return cuerpo as T
}

// --- La API ---------------------------------------------------------------------------

export const api = {
  // --- Auth (spec 07). La cookie de sesion viaja sola: fetch es same-origin. ---------
  auth: {
    login: (usuario: string, password: string) =>
      pedir<SesionApi>('/auth/login', { method: 'POST', body: JSON.stringify({ usuario, password }) }),
    /** Quien soy, para rehidratar tras un F5. 401 = no hay nadie, no un error. */
    session: () => pedir<SesionApi>('/auth/session'),
    logout: () => pedir<undefined>('/auth/logout', { method: 'POST' }),
  },

  countries: () => pedir<{ countries: Country[] }>('/countries').then((r) => r.countries),

  plans: (includeArchived = false) =>
    pedir<{ plans: Plan[] }>(`/plans${includeArchived ? '?include_archived=true' : ''}`).then(
      (r) => r.plans,
    ),

  searchCustomers: (search: string, signal?: AbortSignal) =>
    pedir<{ customers: CustomerListItem[]; total: number }>(
      `/customers?search=${encodeURIComponent(search)}`,
      signal === undefined ? undefined : { signal },
    ),

  customer: (id: number) => pedir<CustomerDetail>(`/customers/${id}`),

  history: (id: number) =>
    pedir<{ simulations: Simulation[]; total: number }>(`/customers/${id}/simulations`).then(
      (r) => r.simulations,
    ),

  createCustomer: (body: {
    company_name: string
    fiscal_id: string
    email: string
    country: string
    plan_id: number
  }) => pedir<{ id: number }>('/customers', { method: 'POST', body: JSON.stringify(body) }),

  // SOLO ENTRADAS, jamas importes (invariante 1). El backend recalcula desde cero y su
  // numero manda; si difiere del preview, la UI pinta el suyo (referencia 10).
  createSimulation: (body: {
    customer_id: number
    active_users: number
    storage_gb: number
    api_calls: number
  }) => pedir<Simulation>('/simulations', { method: 'POST', body: JSON.stringify(body) }),

  rates: () => pedir<Rates>('/rates'),

  // --- Admin. Protegidas EN EL BACKEND (403 sin rol admin, spec 07). -------------------

  createPlan: (body: Plantilla) => pedir<Plan>('/plans', { method: 'POST', body: JSON.stringify(body) }),

  /** "Editar" NO modifica: crea una version nueva y archiva la anterior (referencia 5.5). */
  versionPlan: (id: number, body: Plantilla) =>
    pedir<Plan>(`/plans/${id}`, { method: 'PUT', body: JSON.stringify(body) }),

  /** "Borrar" archiva. Nunca borra. */
  archivePlan: (id: number) => pedir<Plan>(`/plans/${id}`, { method: 'DELETE' }),
}

export type PlantillaTier = {
  metric: Metric
  up_to: number | null
  unit_price_minor: number
}

export type Plantilla = {
  name: string
  description?: string
  currency: CurrencyCode
  /** El sort_order NO se envia: lo deriva el servidor del orden de este array. */
  tiers: PlantillaTier[]
}

/** Una violacion de la plantilla, con su fila, para pintarla donde toca. */
export type Violacion = {
  rule: string
  metric?: Metric
  index?: number
  message: string
}
