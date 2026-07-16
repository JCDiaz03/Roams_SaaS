// Desglose por tramo con pie explicativo. Diseno: 2.4.5

import { Fragment, useState } from 'react'
import type { CurrencyCode, QuoteResult } from '@saas/pricing'
import { formatMinor } from '../../lib/currency-format'
import styles from './BreakdownTable.module.css'
import { META } from './MetricSliderCard'

type Props = {
  resultado: QuoteResult
  currency: CurrencyCode
}

/**
 * El desglose. "10 usuarios x 10 € + 5 x 8 €" en vez de un total opaco.
 *
 * No es adorno: un comercial tiene que poder EXPLICAR EL NUMERO AL CLIENTE POR TELEFONO
 * (referencia 13). Por eso va abierto por defecto y no escondido tras un clic.
 */
export function BreakdownTable({ resultado, currency }: Props) {
  const [abierto, setAbierto] = useState(true)
  const facturadas = resultado.breakdown.filter((b) => b.billed && b.tiers.length > 0)

  return (
    <div className={styles.zona}>
      <button
        type="button"
        className={styles.toggle}
        onClick={() => setAbierto((v) => !v)}
        aria-expanded={abierto}
      >
        Cómo se calcula
        <svg className={`${styles.chevron} ${abierto ? styles.abierto : ''}`} width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="m6 9 6 6 6-6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {abierto && (
        <>
          <div className={styles.scroll}>
            <table className={styles.tabla}>
              <thead>
                <tr>
                  <th>Concepto</th>
                  <th>Importe</th>
                </tr>
              </thead>
              <tbody>
                {facturadas.map((metrica) => (
                  <Fragment key={metrica.metric}>
                    <tr className={styles.grupo}>
                      <td colSpan={2}>{META[metrica.metric].label}</td>
                    </tr>
                    {metrica.tiers.map((t, i) => (
                      <tr key={i}>
                        <td>
                          {t.units.toLocaleString('es-ES')} × {formatMinor(t.unit_price_minor, currency)}
                        </td>
                        <td>{formatMinor(t.amount_minor, currency)}</td>
                      </tr>
                    ))}
                    {metrica.tiers.length > 1 && (
                      <tr className={styles.subtotal}>
                        <td>Subtotal</td>
                        <td>{formatMinor(metrica.subtotal_minor, currency)}</td>
                      </tr>
                    )}
                  </Fragment>
                ))}

                <tr className={styles.impuesto}>
                  <td>Base imponible</td>
                  <td>{formatMinor(resultado.base_minor, currency)}</td>
                </tr>
                <tr>
                  {/* El tipo viene en puntos basicos; se pinta como porcentaje y con
                      toLocaleString: un 8,1 % debe llevar coma, como el resto. */}
                  <td>Impuestos ({(resultado.tax_rate_bp / 100).toLocaleString('es-ES')} %)</td>
                  <td>{formatMinor(resultado.tax_minor, currency)}</td>
                </tr>
                <tr className={styles.total}>
                  <td>Total mensual</td>
                  <td>{formatMinor(resultado.total_minor, currency)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* El pie "cómo se calcula" del patron Roams: dice el metodo, sin jerga. */}
          <p className={styles.pie}>
            Cada unidad paga el precio de su escalón: los primeros se cobran a su tarifa y solo las
            unidades que la superan pasan a la siguiente. El impuesto es el del país del cliente.
          </p>
        </>
      )}
    </div>
  )
}

