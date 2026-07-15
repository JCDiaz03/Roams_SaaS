// Resultado vivo: total grande, preview local a 0 ms. Ref: 10

import type { CurrencyCode, QuoteResult } from '@saas/pricing'
import { convertMinor, formatMinor } from '../../lib/currency-format'
import { Button } from '../../ui/Button'
import { Callout } from '../../ui/Callout'
import { Card } from '../../ui/Card'
import { Chip } from '../../ui/Chip'
import { BreakdownTable } from './BreakdownTable'
import styles from './ResultPanel.module.css'

const fecha = (iso: string) =>
  new Date(iso).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })

type Props = {
  resultado: QuoteResult
  display: CurrencyCode
  rates: Readonly<Record<string, number>> | null
  /** true = los tipos vienen de fallback: hay que avisar (referencia 9). */
  stale: boolean
  staleDesde: string | null
  guardando: boolean
  /** No null = ya se guardo: el numero mostrado es EL DEL BACKEND. */
  selladaEn: string | null
  onGuardar: () => void
}

export function ResultPanel({
  resultado,
  display,
  rates,
  stale,
  staleDesde,
  guardando,
  selladaEn,
  onGuardar,
}: Props) {
  const facturacion = resultado.currency

  // Paso 5 del orden canonico, y el unico que vive en el frontend: convertir para PINTAR
  // (referencia 4.2). El resultado no vuelve al negocio ni se envia a ningun sitio.
  const convertido =
    rates === null || display === facturacion
      ? null
      : convertMinor(resultado.total_minor, facturacion, display, rates)

  const hayConversion = convertido !== null

  return (
    <Card className={styles.panel}>
      <div className={styles.etiqueta}>Presupuesto mensual</div>

      <div className={styles.total}>
        {hayConversion ? formatMinor(convertido, display) : formatMinor(resultado.total_minor, facturacion)}
        <span className={styles.periodo}> /mes</span>
      </div>
      <div className={styles.impuestos}>impuestos incluidos</div>

      {/* El importe convertido va SIEMPRE marcado como referencia, y el de facturacion
          real SIEMPRE visible al lado (referencia 4.1). La divisa de visualizacion no
          afecta al negocio, y la pantalla no debe dejar ninguna duda sobre cual es el
          numero de verdad. */}
      {hayConversion && (
        <div className={styles.referencia}>
          <div className={styles.referenciaEtiqueta}>≈ referencia · no es la divisa de facturación</div>
          <div className={styles.facturado}>
            Se factura: {formatMinor(resultado.total_minor, facturacion)}
          </div>
        </div>
      )}

      {hayConversion && stale && (
        <div className={styles.aviso}>
          <Callout tone="warning">
            Tipos de cambio del <strong>{staleDesde === null ? '—' : fecha(staleDesde)}</strong>. La
            conversión es orientativa; el importe facturado no se ve afectado.
          </Callout>
        </div>
      )}

      <BreakdownTable resultado={resultado} currency={facturacion} />

      {selladaEn === null ? (
        <div className={styles.acciones}>
          <Button block size="lg" loading={guardando} onClick={onGuardar}>
            Guardar simulación
          </Button>
        </div>
      ) : (
        // Guardada: el numero queda "sellado" con su fecha. A partir de aqui lo que se ve
        // es lo que devolvio el backend, no el preview.
        <div className={styles.sellada}>
          <Chip tone="success">Guardada · {fecha(selladaEn)}</Chip>
        </div>
      )}
    </Card>
  )
}
