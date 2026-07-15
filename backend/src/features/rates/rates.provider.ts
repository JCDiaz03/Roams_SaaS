// Cliente de open.er-api.com (URL fija en config). Spec: 9, 14.1

import { isCurrencyCode } from '@saas/pricing'

export type RatesPayload = {
  /** Ya FILTRADO a las divisas del enum Currency. */
  rates: Record<string, number>
  /** De time_last_update_unix. */
  asOf: string
  /** De time_next_update_unix: el TTL. */
  nextUpdate: string
}

/** El puerto minimo que la feature necesita. Es lo que el test sustituye. */
export interface RatesProvider {
  fetchRates(): Promise<RatesPayload>
}

const TIMEOUT_MS = 5_000
const TTL_MAXIMO_MS = 48 * 60 * 60 * 1000

/**
 * Convierte un unix en segundos a ISO, o null si el valor no es utilizable.
 * El payload de un tercero se trata como NO CONFIABLE.
 */
function isoDeUnix(v: unknown): string | null {
  if (typeof v !== 'number' || !Number.isFinite(v) || v <= 0) return null
  const ms = v * 1000
  const d = new Date(ms)
  return Number.isNaN(d.getTime()) ? null : d.toISOString()
}

/**
 * El cliente HTTP de open.er-api.com.
 *
 * SIN SSRF: la URL es FIJA y de configuracion del servidor. Ninguna entrada del usuario
 * compone la URL, ni la base ni un parametro; por eso GET /rates no acepta ningun
 * parametro (referencia 14.1).
 */
export class OpenErApiProvider implements RatesProvider {
  constructor(private readonly url: string) {}

  async fetchRates(): Promise<RatesPayload> {
    // Timeout explicito: sin el, una API que acepta la conexion y no responde deja
    // GET /rates colgado, y con la promesa compartida del servicio arrastra a todos los
    // que esperan.
    const respuesta = await fetch(this.url, { signal: AbortSignal.timeout(TIMEOUT_MS) })
    if (!respuesta.ok) {
      throw new Error(`La API de tipos respondio ${respuesta.status}.`)
    }

    const cuerpo: unknown = await respuesta.json()
    return this.parsear(cuerpo)
  }

  /**
   * Valida la forma ANTES de que nada de esto llegue a la cache.
   *
   * Un proveedor que empieza a devolver null en una divisa no debe poder meter un NaN en
   * el selector, y una marca de tiempo absurda no debe poder envenenar el TTL.
   */
  private parsear(cuerpo: unknown): RatesPayload {
    if (typeof cuerpo !== 'object' || cuerpo === null) {
      throw new Error('La API de tipos no devolvio un objeto.')
    }

    const { rates, time_last_update_unix, time_next_update_unix } = cuerpo as Record<string, unknown>

    if (typeof rates !== 'object' || rates === null) {
      throw new Error('La API de tipos no devolvio `rates`.')
    }

    // FILTRADO AL RECIBIR, no al servir: la cache guarda solo lo que se sirve. Es lo que
    // hace que el enum Currency sea la unica definicion de "en que divisas trabaja el
    // sistema", y que la API externa no pueda colar una que el resto no conoce
    // (spec 04, 3.3).
    const filtradas: Record<string, number> = {}
    for (const [code, valor] of Object.entries(rates as Record<string, unknown>)) {
      if (!isCurrencyCode(code)) continue
      if (typeof valor !== 'number' || !Number.isFinite(valor) || valor <= 0) continue
      filtradas[code] = valor
    }

    if (Object.keys(filtradas).length === 0) {
      throw new Error('La API de tipos no devolvio ninguna divisa utilizable.')
    }

    const asOf = isoDeUnix(time_last_update_unix) ?? new Date().toISOString()

    // TTL = time_next_update_unix (referencia 9): se caduca ahi, alineado con el ciclo
    // real del proveedor, no a 24 h fijas adivinadas. El dato para decidir YA VIENE en el
    // payload; ignorarlo y adivinar un numero es acoplamiento por descuido.
    //
    // Defensa minima: si falta o es absurdo (pasado, o a mas de 48 h vista), se cae a 24 h
    // desde ahora. No se confia ciegamente en un tercero para algo que puede dejar la
    // cache envenenada o inutil.
    const propuesto = isoDeUnix(time_next_update_unix)
    const ahora = Date.now()
    const razonable =
      propuesto !== null &&
      Date.parse(propuesto) > ahora &&
      Date.parse(propuesto) - ahora <= TTL_MAXIMO_MS

    const nextUpdate = razonable
      ? (propuesto as string)
      : new Date(ahora + 24 * 60 * 60 * 1000).toISOString()

    return { rates: filtradas, asOf, nextUpdate }
  }
}
