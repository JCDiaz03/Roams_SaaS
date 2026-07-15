// Cortes crecientes, sin huecos ni solapes, ultimo tramo abierto. Spec: 5.4

import { METRICS, isCurrencyCode, type Metric } from '@saas/pricing'

/** Un tramo tal y como llega de la plantilla: sin sort_order, que lo deriva el servidor. */
export type PlantillaTier = {
  metric: Metric
  up_to: number | null
  unit_price_minor: number
}

export type Plantilla = {
  name: string
  description?: string | undefined
  currency: string
  tiers: readonly PlantillaTier[]
}

/** Codigos ESTABLES. La UI decide con `rule`; `message` es texto de producto. */
export type Regla =
  | 'AT_LEAST_ONE_BLOCK'
  | 'AT_LEAST_ONE_TIER'
  | 'CUTS_NOT_INCREASING'
  | 'LAST_TIER_MUST_BE_OPEN'
  | 'OPEN_TIER_NOT_LAST'
  | 'PRICE_NEGATIVE'
  | 'CURRENCY_NOT_SUPPORTED'
  | 'METRIC_NOT_SUPPORTED'

export type Violacion = {
  rule: Regla
  /** La metrica afectada, si la regla es de un bloque. */
  metric?: Metric
  /** El indice del tramo dentro de su metrica, para pintar el error en su fila. */
  index?: number
  /** Castellano, para el admin. Explica LA CONSECUENCIA, no la regla. */
  message: string
}

const ETIQUETA: Record<Metric, string> = {
  users: 'Usuarios',
  storage_gb: 'Almacenamiento',
  api_calls: 'Llamadas API',
}

/**
 * Valida una plantilla de plan. Devuelve TODAS las violaciones, no la primera.
 *
 * ES OBLIGATORIA EN TODO CAMINO DE ESCRITURA, y eso incluye el seed. El motor NO valida
 * sus entradas y confia en este invariante (01-motor-tramos-y-simulaciones.md 4): si un
 * plan incoherente entra en la base de datos, el motor produce basura silenciosa. Esto es
 * lo unico que hay entre el admin y ese escenario.
 *
 * FUNCION PURA, sin IO: por eso la puede usar el seed, y por eso la vista previa de la
 * pantalla de plantilla puede ejecutarla en el navegador sin duplicar ninguna regla.
 *
 * Devuelve TODAS las violaciones porque el admin que ha escrito cuatro tramos mal no debe
 * descubrirlos de uno en uno, guardando y fallando cuatro veces.
 *
 * "Sin huecos ni solapes" NO esta aqui, y no es un olvido: AL REPRESENTAR LOS TRAMOS SOLO
 * CON SU LIMITE SUPERIOR, LOS HUECOS Y LOS SOLAPES SON INEXPRESABLES. Cada tramo empieza
 * exactamente donde acaba el anterior; no hay donde escribir un hueco. Con un modelo
 * (from, to), "(1,10) y (20,50)" seria un hueco perfectamente representable y harian
 * falta dos validaciones mas. Es la REPRESENTACION la que elimina dos clases enteras de
 * error, no el validador.
 */
export function validarPlantilla(plantilla: Plantilla): Violacion[] {
  const violaciones: Violacion[] = []

  if (!isCurrencyCode(plantilla.currency)) {
    violaciones.push({
      rule: 'CURRENCY_NOT_SUPPORTED',
      message: `No trabajamos con la divisa «${plantilla.currency}».`,
    })
  }

  for (const tier of plantilla.tiers) {
    if (!METRICS.includes(tier.metric)) {
      violaciones.push({
        rule: 'METRIC_NOT_SUPPORTED',
        message: `«${tier.metric}» no es una métrica que sepamos cobrar.`,
      })
    }
  }

  if (plantilla.tiers.length === 0) {
    violaciones.push({
      rule: 'AT_LEAST_ONE_BLOCK',
      message: 'El plan tiene que cobrar por algo: rellena al menos una métrica.',
    })
    return violaciones
  }

  for (const metric of METRICS) {
    // El orden en el que llegan ES el orden: el sort_order se deriva de el (contrato 4.1).
    // Ordenar aqui por up_to esconderia el error de un admin que escribio los cortes al
    // reves, que es justo lo que hay que decirle.
    const bloque = plantilla.tiers.filter((t) => t.metric === metric)
    // Un bloque ausente es legitimo: significa que este plan no cobra esa metrica.
    if (bloque.length === 0) continue

    violaciones.push(...validarBloque(metric, bloque))
  }

  return violaciones
}

function validarBloque(metric: Metric, bloque: readonly PlantillaTier[]): Violacion[] {
  const etiqueta = ETIQUETA[metric]

  // Un bloque presente pero vacio es un error del formulario, no un "no factura": eso se
  // expresa NO mandando el bloque.
  if (bloque.length === 0) {
    return [
      {
        rule: 'AT_LEAST_ONE_TIER',
        metric,
        message: `«${etiqueta}» está activado pero no tiene ningún tramo.`,
      },
    ]
  }

  const violaciones: Violacion[] = []

  for (const [i, tier] of bloque.entries()) {
    if (tier.unit_price_minor < 0) {
      violaciones.push({
        rule: 'PRICE_NEGATIVE',
        metric,
        index: i,
        message: `El precio del tramo ${i + 1} de «${etiqueta}» no puede ser negativo.`,
      })
    }

    // Solo el ULTIMO puede ser abierto: un null en medio hace inalcanzables los siguientes.
    if (tier.up_to === null && i !== bloque.length - 1) {
      violaciones.push({
        rule: 'OPEN_TIER_NOT_LAST',
        metric,
        index: i,
        message: `En «${etiqueta}», el tramo ${i + 1} no tiene tope, así que los siguientes nunca se aplicarían.`,
      })
    }
  }

  // El ULTIMO tiene que ser abierto, o hay unidades sin precio.
  const ultimo = bloque[bloque.length - 1]
  if (ultimo !== undefined && ultimo.up_to !== null) {
    violaciones.push({
      rule: 'LAST_TIER_MUST_BE_OPEN',
      metric,
      index: bloque.length - 1,
      // El mensaje dice LA CONSECUENCIA, no la regla: es lo que el admin necesita
      // entender para arreglarlo.
      message: `El último tramo de «${etiqueta}» debe quedar abierto: hoy, por encima de ${ultimo.up_to} no hay precio.`,
    })
  }

  // Cortes ESTRICTAMENTE crecientes.
  let anterior = 0
  for (const [i, tier] of bloque.entries()) {
    if (tier.up_to === null) break // el abierto cierra el bloque

    if (tier.up_to <= anterior) {
      violaciones.push({
        rule: 'CUTS_NOT_INCREASING',
        metric,
        index: i,
        message:
          anterior === 0
            ? `El primer tramo de «${etiqueta}» tiene que llegar a más de 0.`
            : `En «${etiqueta}», el tramo ${i + 1} llega hasta ${tier.up_to}, que no supera al anterior (${anterior}): quedaría vacío.`,
      })
    }
    anterior = tier.up_to
  }

  return violaciones
}
