// Cache TTL = time_next_update_unix; filtrado; fallback marcado. Spec: 9

import { AppError } from '../../plugins/error-handler'
import type { RatesPayload, RatesProvider } from './rates.provider'

export type RatesView = {
  base: 'EUR'
  rates: Record<string, number>
  as_of: string
  next_update: string
  /** true = la API fallo y esto es el ultimo tipo conocido. La UI pinta el badge ambar. */
  stale: boolean
}

/**
 * El proxy con cache de servidor (referencia 9).
 *
 * EL MOTIVO PRINCIPAL ES DE NEGOCIO, no tecnico: con cache en el navegador, dos
 * comerciales pueden cotizar al mismo cliente con tipos distintos el mismo dia -uno abrio
 * la pestana ayer, el otro hoy-. La cache de servidor garantiza que TODO EL EQUIPO VE EL
 * MISMO NUMERO A LA MISMA HORA. Los beneficios tecnicos (una llamada real al dia, un
 * punto unico de fallback, cero CORS, el proveedor no expuesto) son reales y secundarios.
 *
 * La cache vive EN MEMORIA del proceso, no en SQLite: son datos volatiles de
 * presentacion, y perderlos al reiniciar cuesta una peticion HTTP.
 *
 * Sin refresco proactivo: un setInterval anade un temporizador que apagar, que falla en
 * silencio si nadie lo mira, y que pide tipos a las 4 de la manana cuando no hay nadie
 * cotizando. Cache-aside pide cuando alguien pregunta, que es cuando hace falta.
 */
/**
 * Tras un fallo del proveedor, margen sin reintentar. Sin el, con la API caida y la cache
 * caducada CADA peticion paga el timeout entero (5 s) antes de caer al dato viejo; con el,
 * la primera paga y las siguientes sirven el fallback al instante hasta que toque reintentar.
 */
const REINTENTO_TRAS_FALLO_MS = 60_000

export class RatesService {
  private cache: RatesPayload | null = null

  /** Cuando fallo el ultimo intento, o null si el ultimo intento fue bien. */
  private falloEn: number | null = null

  /**
   * La peticion en vuelo, si la hay.
   *
   * Sin esto, cinco peticiones con la cache caducada disparan cinco llamadas externas y
   * el "una llamada real al dia" -el argumento central del proxy- se convierte en "una
   * por comercial que refresque a la vez". Es una variable, no una libreria.
   */
  private enVuelo: Promise<RatesPayload> | null = null

  constructor(private readonly provider: RatesProvider) {}

  async get(): Promise<RatesView> {
    if (this.cache !== null && !this.caducada(this.cache)) {
      return this.vista(this.cache, false)
    }

    if (this.falloEn !== null && Date.now() - this.falloEn < REINTENTO_TRAS_FALLO_MS) {
      return this.fallback()
    }

    try {
      const frescos = await this.pedirUnaSolaVez()
      this.cache = frescos
      this.falloEn = null
      return this.vista(frescos, false)
    } catch {
      this.falloEn = Date.now()
      return this.fallback()
    }
  }

  /**
   * La API fallo (ahora o hace un momento). Si hay algo cacheado, se sirve MARCADO: sigue
   * siendo un 200 y no un 503 porque los datos son utilizables -un tipo de ayer orienta
   * perfectamente- y la decision de mostrarlos es de la UI, que pinta "Tipos de cambio del
   * {fecha}". Un 503 haria que el frontend descartara datos que si valen.
   *
   * Lo que NO se hace jamas es servir el numero viejo EN SILENCIO: un dashboard que
   * ensena un tipo de hace tres dias sin avisar es peor que uno que dice que no sabe.
   */
  private fallback(): RatesView {
    if (this.cache !== null) return this.vista(this.cache, true)

    // Sin cache y sin API: el unico caso sin salida, no hay numero viejo que ensenar.
    // La UI cae a EUR con aviso visible. Los importes de FACTURACION siguen siendo
    // correctos porque no dependen de esta API (referencia 4.1): la caida del proveedor
    // degrada la presentacion y no toca el negocio.
    throw new AppError(
      503,
      'RATES_UNAVAILABLE',
      'No hemos podido obtener los tipos de cambio. Los importes se muestran en su divisa de facturación.',
    )
  }

  private caducada(payload: RatesPayload): boolean {
    return Date.now() >= Date.parse(payload.nextUpdate)
  }

  /** Cinco peticiones concurrentes con la cache caducada -> UNA llamada externa. */
  private async pedirUnaSolaVez(): Promise<RatesPayload> {
    this.enVuelo ??= this.provider.fetchRates().finally(() => {
      this.enVuelo = null
    })

    return this.enVuelo
  }

  private vista(payload: RatesPayload, stale: boolean): RatesView {
    return {
      base: 'EUR',
      rates: payload.rates,
      as_of: payload.asOf,
      next_update: payload.nextUpdate,
      stale,
    }
  }
}
