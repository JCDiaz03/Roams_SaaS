// La hoja del presupuesto: solo existe en @media print. Diseno: ventana 4 · roadmap 5.4

import { Fragment, useEffect } from 'react'
import { createPortal } from 'react-dom'
import type { CurrencyCode } from '@saas/pricing'
import type { CustomerDetail, Simulation } from '../../lib/api-client'
import { formatMinor } from '../../lib/currency-format'
import { fechaLarga } from '../../lib/fechas'
import { META } from './MetricSliderCard'
import styles from './PrintSheet.module.css'

type Props = {
  cliente: CustomerDetail
  /** La simulacion GUARDADA: el papel lleva el numero persistido, nunca un preview. */
  sim: Simulation
}

/**
 * El presupuesto en papel (o PDF, via el dialogo del navegador). Sin librerias de PDF ni
 * generacion en servidor: una hoja @media print resuelve lo mismo con cero dependencias
 * (roadmap 5.5).
 *
 * La montan DOS pantallas —el simulador (recien sellada) y la ficha del cliente (una
 * guardada del historial)— y es EL MISMO componente a proposito: dos hojas divergirian
 * en el proximo campo del papel (sesion 13 del proceso: "mover, no rehacer").
 *
 * Solo se monta con la simulacion SELLADA, y es una decision de producto: lo que se
 * entrega a un cliente es el numero que el backend persistio, no un preview que nadie
 * podra reproducir. Por lo mismo, aqui NO aparece la divisa de visualizacion: el papel
 * lleva el importe en la divisa de FACTURACION (invariante 4) — la conversion es una
 * referencia efimera de pantalla y en un documento entregable seria una promesa falsa.
 *
 * En pantalla no existe (display: none). La hoja se monta por PORTAL fuera de #root y
 * marca el body: la regla de impresion de global.css oculta #root con display -no con
 * visibility, que conservaria el layout y regalaria paginas en blanco tras la hoja-
 * SOLO cuando la hoja existe. Sin hoja (Ctrl+P en cualquier otra pantalla), la app se
 * imprime tal cual en vez de salir un papel vacio.
 */
export function PrintSheet({ cliente, sim }: Props) {
  const currency = sim.currency as CurrencyCode
  const facturadas = sim.breakdown.filter((b) => b.billed && b.tiers.length > 0)

  useEffect(() => {
    document.body.classList.add('con-hoja-impresion')
    return () => document.body.classList.remove('con-hoja-impresion')
  }, [])

  return createPortal(
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
          {/* De la SIMULACION sellada, no del cliente: con el plan elegido (ADR 0011),
              cliente.plan.name seria la tarifa equivocada en el papel. */}
          <dd>
            {sim.plan_name} · v{sim.plan_version}
          </dd>
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
            {/* toLocaleString: un tipo con decimal (8,1 %) debe salir con coma, como
                todos los demas numeros del documento. */}
            <td>Impuestos ({(sim.tax_rate_bp / 100).toLocaleString('es-ES')} %)</td>
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

      {/* El emisor sale de la SIMULACION (created_by), no de la sesion de quien mira: el
          papel declara a quien lo creo, y reimprimirlo otro dia u otro comercial no le
          cambia el autor. En las guardadas antes de existir el dato, se omite: mejor un
          papel sin emisor que uno con el emisor equivocado. */}
      <footer className={styles.emision}>
        {sim.created_by !== null ? (
          <>
            Emitido por <strong>{sim.created_by}</strong> el {fechaLarga(sim.created_at)}
          </>
        ) : (
          <>Emitido el {fechaLarga(sim.created_at)}</>
        )}{' '}
        · Importes en {currency}, la divisa de facturación del plan · Presupuesto orientativo: no es
        una factura.
      </footer>
    </section>,
    document.body,
  )
}
