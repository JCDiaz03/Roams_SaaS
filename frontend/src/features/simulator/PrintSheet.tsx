// La hoja del presupuesto: solo existe en @media print. Diseno: ventana 4 · roadmap 5.4

import { Fragment } from 'react'
import type { CurrencyCode } from '@saas/pricing'
import type { CustomerDetail, Simulation } from '../../lib/api-client'
import { formatMinor } from '../../lib/currency-format'
import { META } from './MetricSliderCard'
import styles from './PrintSheet.module.css'

const fechaLarga = (iso: string) =>
  new Date(iso).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })

type Props = {
  cliente: CustomerDetail
  /** La simulacion GUARDADA: el papel lleva el numero persistido, nunca un preview. */
  sim: Simulation
  /** Quien lo emite: el nombre de la sesion. */
  emisor: string
}

/**
 * El presupuesto en papel (o PDF, via el dialogo del navegador). Sin librerias de PDF ni
 * generacion en servidor: una hoja @media print resuelve lo mismo con cero dependencias
 * (roadmap 5.5).
 *
 * Solo se monta con la simulacion SELLADA, y es una decision de producto: lo que se
 * entrega a un cliente es el numero que el backend persistio, no un preview que nadie
 * podra reproducir. Por lo mismo, aqui NO aparece la divisa de visualizacion: el papel
 * lleva el importe en la divisa de FACTURACION (invariante 4) — la conversion es una
 * referencia efimera de pantalla y en un documento entregable seria una promesa falsa.
 *
 * En pantalla no existe (display: none); al imprimir, el resto de la app se oculta con
 * la regla global `.hoja-impresion` de global.css.
 */
export function PrintSheet({ cliente, sim, emisor }: Props) {
  const currency = sim.currency as CurrencyCode
  const facturadas = sim.breakdown.filter((b) => b.billed && b.tiers.length > 0)

  return (
    <section className={`hoja-impresion ${styles.hoja}`}>
      <header className={styles.cabecera}>
        <div className={styles.marca}>SaaS-O-Matic</div>
        <h1 className={styles.titulo}>Presupuesto mensual</h1>
        <div className={styles.fecha}>{fechaLarga(sim.created_at)}</div>
      </header>

      <dl className={styles.datos}>
        <div>
          <dt>Cliente</dt>
          <dd>{cliente.company_name}</dd>
        </div>
        <div>
          <dt>Identificador fiscal</dt>
          <dd>{cliente.fiscal_id}</dd>
        </div>
        <div>
          <dt>País</dt>
          <dd>{cliente.country.name}</dd>
        </div>
        <div>
          <dt>Plan</dt>
          <dd>{cliente.plan.name}</dd>
        </div>
      </dl>

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
                <td colSpan={2}>
                  {META[metrica.metric].label} — {metrica.quantity.toLocaleString('es-ES')}
                </td>
              </tr>
              {metrica.tiers.map((t, i) => (
                <tr key={i}>
                  <td>
                    {t.units.toLocaleString('es-ES')} × {formatMinor(t.unit_price_minor, currency)}
                  </td>
                  <td>{formatMinor(t.amount_minor, currency)}</td>
                </tr>
              ))}
            </Fragment>
          ))}
          <tr className={styles.subtotal}>
            <td>Base imponible</td>
            <td>{formatMinor(sim.base_minor, currency)}</td>
          </tr>
          <tr>
            <td>Impuestos ({sim.tax_rate_bp / 100} %)</td>
            <td>{formatMinor(sim.tax_minor, currency)}</td>
          </tr>
          <tr className={styles.total}>
            <td>Total mensual</td>
            <td>{formatMinor(sim.total_minor, currency)}</td>
          </tr>
        </tbody>
      </table>

      <p className={styles.pie}>
        Cada unidad paga el precio de su escalón: los primeros se cobran a su tarifa y solo las
        unidades que la superan pasan a la siguiente. El impuesto aplicado es el del país del
        cliente.
      </p>

      <footer className={styles.emision}>
        Emitido por <strong>{emisor}</strong> el {fechaLarga(sim.created_at)} · Importes en{' '}
        {currency}, la divisa de facturación del plan · Presupuesto orientativo: no es una factura.
      </footer>
    </section>
  )
}
