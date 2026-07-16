// Slider + input por metrica; atenuada si el plan no la factura. Diseno: 4

import type { Metric } from '@saas/pricing'
import { Callout } from '../../ui/Callout'
import { Card } from '../../ui/Card'
import styles from './MetricSliderCard.module.css'

export const META: Record<Metric, { label: string; hint: string; max: number }> = {
  users: { label: 'Usuarios activos', hint: 'Personas con cuenta', max: 200 },
  storage_gb: { label: 'Almacenamiento (GB)', hint: 'Espacio contratado', max: 3000 },
  // "Estimación que el operario ajusta", no telemetria real (referencia 5.2).
  api_calls: { label: 'Llamadas API', hint: 'Estimación mensual', max: 200_000 },
}

const ICONOS: Record<Metric, React.ReactNode> = {
  users: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="9" cy="8" r="3.2" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M3.5 19a5.5 5.5 0 0 1 11 0M16 8a3 3 0 0 1 0 6M17 19a5.5 5.5 0 0 0-2-4.3"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  ),
  storage_gb: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <ellipse cx="12" cy="6" rx="7" ry="3" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M5 6v6c0 1.7 3.1 3 7 3s7-1.3 7-3V6M5 12v6c0 1.7 3.1 3 7 3s7-1.3 7-3v-6"
        stroke="currentColor"
        strokeWidth="1.8"
      />
    </svg>
  ),
  api_calls: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="m8 9-3 3 3 3M16 9l3 3-3 3M13 6l-2 12"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  ),
}

type Props = {
  metric: Metric
  value: number
  onChange: (v: number) => void
  /** false = el plan no cobra por esta metrica. NO se oculta: se atenua (referencia 5.2). */
  billed: boolean
  /** true durante el guardado: la respuesta re-sella con lo enviado (SimulatorPage). */
  disabled?: boolean
}

export function MetricSliderCard({ metric, value, onChange, billed, disabled = false }: Props) {
  const { label, hint, max } = META[metric]

  const cambiar = (bruto: string) => {
    const n = Number(bruto)
    if (!Number.isFinite(n)) return
    // Se acota aqui, no en el motor: el motor confia en sus entradas, y el esquema del
    // backend rebota lo que se salga. Esto solo evita que el input escriba un absurdo.
    onChange(Math.max(0, Math.min(max, Math.trunc(n))))
  }

  return (
    <Card className={`${styles.tarjeta} ${billed ? '' : styles.atenuada}`}>
      <div className={styles.cabecera}>
        <span className={styles.icono}>{ICONOS[metric]}</span>
        <div className={styles.textos}>
          <div className={styles.label}>{label}</div>
          <div className={styles.hint}>{hint}</div>
        </div>
        {/* El input numerico y el slider son la MISMA entrada, sincronizados: quien sabe
            el numero exacto lo teclea, quien explora lo arrastra. */}
        <input
          type="number"
          className={styles.numero}
          value={value}
          min={0}
          max={max}
          disabled={disabled}
          onChange={(e) => cambiar(e.target.value)}
          aria-label={`${label}, valor exacto`}
        />
      </div>

      <input
        type="range"
        className={styles.rango}
        value={value}
        min={0}
        max={max}
        disabled={disabled}
        onChange={(e) => cambiar(e.target.value)}
        aria-label={label}
      />

      {!billed && (
        <div className={styles.aviso}>
          {/* Se muestra IGUAL, atenuada y con el aviso: ocultarla confunde mas ("¿por que
              no puedo poner el almacenamiento?"). Y el dato se registra en la simulacion
              aunque aporte 0. */}
          <Callout tone="info">
            Este plan no cobra por esta métrica: puedes registrarla, pero <strong>no cambia el precio</strong>.
          </Callout>
        </div>
      )}
    </Card>
  )
}
