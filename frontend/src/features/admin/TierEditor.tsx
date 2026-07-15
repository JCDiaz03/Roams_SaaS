// Editor de tramos: hasta cuantos + precio; ultimo tramo En adelante. Ref: 5.4

import type { Metric } from '@saas/pricing'
import type { Violacion } from '../../lib/api-client'
import { Button } from '../../ui/Button'
import { IconPlus } from '../../ui/icons'
import styles from './TierEditor.module.css'

/**
 * Un tramo tal y como se teclea: los dos campos como TEXTO.
 *
 * No como number: un input numerico a medio escribir ("1" camino de "100") tendria que
 * representarse, y "" no es 0. El parseo a entero se hace UNA vez, al enviar.
 */
export type TierBorrador = { upTo: string; price: string }

export type BloqueBorrador = { activo: boolean; tramos: TierBorrador[] }

export const UNIDAD: Record<Metric, string> = {
  users: 'usuarios',
  storage_gb: 'GB',
  api_calls: 'llamadas',
}

/**
 * La metrica dentro de una frase.
 *
 * Escritas a mano y no con un toLowerCase() sobre "Llamadas API": eso da "llamadas api" y
 * destroza el acronimo. El castellano no se genera bajando mayusculas.
 */
const EN_FRASE: Record<Metric, string> = {
  users: 'usuarios',
  storage_gb: 'almacenamiento',
  api_calls: 'llamadas a la API',
}

export const bloqueVacio = (activo: boolean): BloqueBorrador => ({
  activo,
  tramos: [
    { upTo: '', price: '' },
    { upTo: '', price: '' },
  ],
})

type Props = {
  metric: Metric
  bloque: BloqueBorrador
  onChange: (b: BloqueBorrador) => void
  /** Las violaciones del backend para ESTA metrica, para pintarlas en su fila. */
  violaciones: Violacion[]
}

export function TierEditor({ metric, bloque, onChange, violaciones }: Props) {
  const { activo, tramos } = bloque

  const parchear = (i: number, parche: Partial<TierBorrador>) =>
    onChange({ ...bloque, tramos: tramos.map((t, j) => (i === j ? { ...t, ...parche } : t)) })

  const anadir = () =>
    onChange({ ...bloque, tramos: [...tramos.slice(0, -1), { upTo: '', price: '' }, tramos[tramos.length - 1] as TierBorrador] })

  const quitar = (i: number) =>
    onChange({ ...bloque, tramos: tramos.filter((_, j) => j !== i) })

  const errorDe = (i: number) => violaciones.find((v) => v.index === i)
  // Las violaciones sin fila (p. ej. AT_LEAST_ONE_TIER) van bajo el bloque.
  const errorBloque = violaciones.find((v) => v.index === undefined)

  return (
    <div className={styles.bloque}>
      <div className={styles.cabecera}>
        <label className={styles.interruptor}>
          <input
            type="checkbox"
            className={styles.check}
            checked={activo}
            onChange={(e) => onChange(e.target.checked ? bloqueVacio(true) : { activo: false, tramos: [] })}
          />
          Este plan cobra por {EN_FRASE[metric]}
        </label>
      </div>

      {activo && (
        <div className={styles.tramos}>
          <div className={styles.filaCabecera}>
            {/* "Hasta cuantos", no "cantidad por tramo" (referencia 5.4): es mas dificil
                de romper -el admin lee la secuencia de un vistazo- y es como funciona el
                acumulativo. Pedir cantidades le obligaria a hacer la suma mental que el
                sistema ya sabe hacer. */}
            <span>Hasta cuántos {UNIDAD[metric]}</span>
            <span>Precio por unidad (€)</span>
            <span />
          </div>

          {tramos.map((t, i) => {
            const ultimo = i === tramos.length - 1
            const error = errorDe(i)

            return (
              <div className={styles.fila} key={i}>
                {ultimo ? (
                  // El ultimo se muestra FIJO como "En adelante": el tramo abierto no es
                  // una opcion que el admin pueda desmarcar, es el que hace que no haya
                  // unidades sin precio.
                  <div className={styles.enAdelante}>En adelante (∞)</div>
                ) : (
                  <input
                    className={`${styles.input} ${error ? styles.inputError : ''}`}
                    type="number"
                    min={1}
                    value={t.upTo}
                    onChange={(e) => parchear(i, { upTo: e.target.value })}
                    placeholder="10"
                    aria-label={`Hasta cuántos ${UNIDAD[metric]}, tramo ${i + 1}`}
                  />
                )}

                <input
                  className={`${styles.input} ${error ? styles.inputError : ''}`}
                  type="number"
                  min={0}
                  step="0.01"
                  value={t.price}
                  onChange={(e) => parchear(i, { price: e.target.value })}
                  placeholder="10,00"
                  aria-label={`Precio por unidad, tramo ${i + 1}`}
                />

                <button
                  type="button"
                  className={styles.quitar}
                  onClick={() => quitar(i)}
                  // Con dos tramos no se puede quitar ninguno: uno cerrado y el abierto es
                  // el minimo coherente.
                  disabled={tramos.length <= 2}
                  aria-label={`Quitar tramo ${i + 1}`}
                  title="Quitar tramo"
                >
                  ×
                </button>

                {error && <p className={styles.error}>{error.message}</p>}
              </div>
            )
          })}

          {errorBloque && <p className={styles.error}>{errorBloque.message}</p>}

          <div className={styles.anadir}>
            <Button variant="ghost" size="sm" icon={<IconPlus size={13} />} onClick={anadir}>
              Añadir tramo
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
