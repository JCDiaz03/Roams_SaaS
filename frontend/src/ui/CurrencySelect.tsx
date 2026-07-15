// Selector de divisa: la eleccion manual manda sobre la preseleccion por pais. Ref: 13 · Diseno: 3

import type { CurrencyCode } from '@saas/pricing'
import { simboloDe } from '../lib/currency-format'
import styles from './CurrencySelect.module.css'

/**
 * Las habituales arriba (diseno 2.2, "UX"). Cosmetica, no arquitectura: el enum tiene 44
 * divisas y el comercial usa cuatro.
 */
const HABITUALES: readonly CurrencyCode[] = ['EUR', 'USD', 'GBP', 'CHF', 'JPY']

type Props = {
  value: CurrencyCode
  onChange: (c: CurrencyCode) => void
  /** Sin tipos de cambio no hay conversion posible: se deshabilita (referencia 13.1). */
  disabled?: boolean
}

export function CurrencySelect({ value, onChange, disabled = false }: Props) {
  return (
    <div className={styles.wrap}>
      {/* El simbolo lo deriva Intl del codigo ISO: cero tablas de simbolos, y ninguna
          bandera. Una bandera al lado de una divisa es una mentira geopolitica pequena
          (el euro no es de un pais, el dolar es de veinte) y ademas no se puede leer. */}
      <span className={styles.simbolo} aria-hidden="true">
        {simboloDe(value)}
      </span>
      <select
        className={styles.select}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value as CurrencyCode)}
        aria-label="Divisa de visualización"
        title={disabled ? 'Sin tipos de cambio disponibles' : 'Divisa de visualización'}
      >
        {HABITUALES.map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
      </select>
    </div>
  )
}
