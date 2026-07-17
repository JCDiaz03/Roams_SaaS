// Bloque de valores base de la ficha: ver y editar en linea. Spec: 09, 3.3 · Diseno: 8

import { useState } from 'react'
import { api, ApiError, type CustomerDetail } from '../../lib/api-client'
import { Button } from '../../ui/Button'
import { useToast } from '../../ui/Toast'
import styles from './BaseValuesBlock.module.css'

type Bases = Pick<CustomerDetail, 'base_users' | 'base_storage_gb' | 'base_api_calls'>

type Props = {
  cliente: CustomerDetail
  /** La ficha actualiza su estado con lo que el servidor devolvio. */
  onActualizado: (bases: Bases) => void
}

const CAMPOS = [
  { clave: 'base_users', label: 'Empleados (usuarios)', tope: 1_000_000 },
  { clave: 'base_storage_gb', label: 'Almacenamiento (GB)', tope: 10_000_000 },
  { clave: 'base_api_calls', label: 'Llamadas API / mes', tope: 1_000_000_000 },
] as const

/** null -> input vacio; el vacio vuelve como null: "no registrado" es un valor (spec 09). */
const aTexto = (v: number | null) => (v === null ? '' : String(v))

export function BaseValuesBlock({ cliente, onActualizado }: Props) {
  const toast = useToast()

  const [editando, setEditando] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [borrador, setBorrador] = useState<Record<(typeof CAMPOS)[number]['clave'], string>>({
    base_users: aTexto(cliente.base_users),
    base_storage_gb: aTexto(cliente.base_storage_gb),
    base_api_calls: aTexto(cliente.base_api_calls),
  })

  const abrir = () => {
    setBorrador({
      base_users: aTexto(cliente.base_users),
      base_storage_gb: aTexto(cliente.base_storage_gb),
      base_api_calls: aTexto(cliente.base_api_calls),
    })
    setEditando(true)
  }

  const guardar = async () => {
    setGuardando(true)
    try {
      // Los tres siempre: el PATCH admite parciales, pero desde esta pantalla la
      // intencion es "deja los valores base asi", los tres a la vista.
      const actualizado = await api.updateCustomerBases(cliente.id, {
        base_users: borrador.base_users === '' ? null : Number(borrador.base_users),
        base_storage_gb: borrador.base_storage_gb === '' ? null : Number(borrador.base_storage_gb),
        base_api_calls: borrador.base_api_calls === '' ? null : Number(borrador.base_api_calls),
      })

      onActualizado({
        base_users: actualizado.base_users,
        base_storage_gb: actualizado.base_storage_gb,
        base_api_calls: actualizado.base_api_calls,
      })
      setEditando(false)
      toast.showOk('Valores base guardados')
    } catch (e) {
      toast.showError(
        e instanceof ApiError ? e.message : 'No hemos podido guardar. Inténtalo de nuevo.',
      )
    } finally {
      setGuardando(false)
    }
  }

  return (
    <div className={styles.bloque}>
      <div className={styles.titulo}>
        <h2>Valores base de consumo</h2>
        {!editando && (
          <Button variant="ghost" size="sm" onClick={abrir}>
            Editar
          </Button>
        )}
      </div>
      <p className={styles.ayuda}>
        El consumo habitual de la empresa. La simulación parametrizada arranca de aquí.
      </p>

      {editando ? (
        <div className={styles.formulario}>
          {CAMPOS.map(({ clave, label, tope }) => (
            <label key={clave} className={styles.campo}>
              <span>{label}</span>
              <input
                type="number"
                min={0}
                max={tope}
                value={borrador[clave]}
                placeholder="Sin registrar"
                disabled={guardando}
                onChange={(e) => setBorrador((b) => ({ ...b, [clave]: e.target.value }))}
              />
            </label>
          ))}
          <div className={styles.acciones}>
            <Button variant="ghost" size="sm" disabled={guardando} onClick={() => setEditando(false)}>
              Cancelar
            </Button>
            <Button size="sm" loading={guardando} onClick={() => void guardar()}>
              Guardar
            </Button>
          </div>
        </div>
      ) : (
        <div className={styles.valores}>
          {CAMPOS.map(({ clave, label }) => (
            <div key={clave}>
              <strong>{cliente[clave] === null ? '—' : cliente[clave].toLocaleString('es-ES')}</strong>
              {label}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
