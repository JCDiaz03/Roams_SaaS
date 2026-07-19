// Selector de divisa: la eleccion manual manda sobre la preseleccion por pais. Ref: 13 · Diseno: 3

import { useEffect, useRef, useState } from 'react'
import type { CurrencyCode } from '@saas/pricing'
import { simboloDe } from '../lib/currency-format'
import { IconCheck } from './icons'
import styles from './CurrencySelect.module.css'

/**
 * Las habituales arriba (diseno 2.2, "UX"). Cosmetica, no arquitectura: el enum tiene 44
 * divisas y el comercial usa cuatro.
 */
const HABITUALES: readonly CurrencyCode[] = ['EUR', 'USD', 'GBP', 'CHF', 'JPY']

/** El nombre de cada divisa en castellano, derivado por Intl: cero tablas propias (4.4). */
const nombres = new Intl.DisplayNames('es', { type: 'currency' })

const nombreDe = (c: CurrencyCode): string => {
  const crudo = nombres.of(c) ?? c
  // DisplayNames devuelve minusculas ("dólar estadounidense"); en una lista, mayuscula.
  return crudo.charAt(0).toUpperCase() + crudo.slice(1)
}

type Props = {
  value: CurrencyCode
  onChange: (c: CurrencyCode) => void
  /** Sin tipos de cambio no hay conversion posible: se deshabilita (referencia 13.1). */
  disabled?: boolean
}

/**
 * Desplegable PROPIO, no el popup nativo del <select>: el nativo no puede ensenar el
 * nombre de la divisa junto al codigo ni la marca de la elegida, y desentona con el
 * resto del sistema. Mismo patron que el menu de usuario de la topbar: botones a secas
 * (sin role="listbox" que prometeria un teclado que no se gestiona), cierre con Escape
 * y con el clic fuera.
 */
export function CurrencySelect({ value, onChange, disabled = false }: Props) {
  const [abierto, setAbierto] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!abierto) return

    // Al abrir, el foco entra en la opcion SELECCIONADA: es lo que el select nativo
    // hacia solo y el desplegable propio habia perdido (lo cazo la code review).
    const seleccionada =
      menuRef.current?.querySelector<HTMLButtonElement>('[aria-current="true"]') ??
      menuRef.current?.querySelector<HTMLButtonElement>('button')
    seleccionada?.focus()

    const fuera = (e: MouseEvent) => {
      if (wrapRef.current !== null && !wrapRef.current.contains(e.target as Node)) {
        setAbierto(false)
      }
    }
    const escape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setAbierto(false)
    }

    document.addEventListener('mousedown', fuera)
    document.addEventListener('keydown', escape)
    return () => {
      document.removeEventListener('mousedown', fuera)
      document.removeEventListener('keydown', escape)
    }
  }, [abierto])

  // Las flechas mueven el foco entre opciones, como en el select nativo.
  const flechas = (e: React.KeyboardEvent) => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return
    e.preventDefault()

    const opciones = [...(menuRef.current?.querySelectorAll<HTMLButtonElement>('button') ?? [])]
    const actual = opciones.indexOf(document.activeElement as HTMLButtonElement)
    const paso = e.key === 'ArrowDown' ? 1 : -1
    const destino = opciones[(actual + paso + opciones.length) % opciones.length]
    destino?.focus()
  }

  return (
    <div className={styles.wrap} ref={wrapRef}>
      <button
        type="button"
        className={styles.boton}
        disabled={disabled}
        // La divisa vigente forma parte del nombre accesible: sin ella, un lector de
        // pantalla anuncia el control sin decir que hay elegido.
        aria-label={`Divisa de visualización: ${value}`}
        aria-expanded={abierto}
        title={disabled ? 'Sin tipos de cambio disponibles' : 'Divisa de visualización'}
        onClick={() => setAbierto((v) => !v)}
      >
        {/* El simbolo lo deriva Intl del codigo ISO: cero tablas, y ninguna bandera. Una
            bandera junto a una divisa es una mentira geopolitica pequena (el euro no es
            de un pais, el dolar es de veinte) y ademas no se puede leer. */}
        <span className={styles.simbolo} aria-hidden="true">
          {simboloDe(value)}
        </span>
        <span className={styles.codigo}>{value}</span>
        <svg className={styles.flecha} width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
          <path d="m2 3.5 3 3 3-3" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      </button>

      {abierto && (
        <div className={styles.menu} ref={menuRef} onKeyDown={flechas}>
          {HABITUALES.map((c) => (
            <button
              key={c}
              type="button"
              className={`${styles.opcion} ${c === value ? styles.activa : ''}`}
              // aria-current es lo que ANUNCIA la elegida: el check visual es
              // aria-hidden y sin esto las cinco opciones sonaban identicas.
              aria-current={c === value ? 'true' : undefined}
              onClick={() => {
                onChange(c)
                setAbierto(false)
              }}
            >
              <span className={styles.opcionSimbolo} aria-hidden="true">
                {simboloDe(c)}
              </span>
              <span className={styles.opcionCodigo}>{c}</span>
              <span className={styles.opcionNombre}>{nombreDe(c)}</span>
              {c === value && <IconCheck size={14} className={styles.marca ?? ''} />}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
