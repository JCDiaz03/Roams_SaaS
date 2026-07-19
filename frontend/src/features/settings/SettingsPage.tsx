// Ventana 9 - Ajustes, para cualquier usuario. Spec: 10 · Diseno: 8
//
// Dos bloques: el perfil (DE DEMOSTRACION: datos fijos, sin edicion — no hay usuarios
// reales que editar hasta el IdP, ADR 0009) y los limites del simulador, que si son
// funcionales: el maximo visual de cada slider, por sesion.

import { useState } from 'react'
import { METRICS, type Metric } from '@saas/pricing'
import {
  LIMITE_MAXIMO,
  LIMITE_MINIMO,
  LIMITE_POR_DEFECTO,
  clampLimite,
  useSimulatorLimits,
} from '../../lib/simulator-limits'
import { useSession } from '../../lib/session'
import { Button } from '../../ui/Button'
import { Callout } from '../../ui/Callout'
import { Card } from '../../ui/Card'
import { useToast } from '../../ui/Toast'
import styles from './SettingsPage.module.css'

const ETIQUETA: Record<Metric, string> = {
  users: 'Usuarios',
  storage_gb: 'Almacenamiento (GB)',
  api_calls: 'Llamadas API',
}

const formatea = (n: number) => n.toLocaleString('es-ES')

export function SettingsPage() {
  const { session, hasRole } = useSession()
  const { limites, setLimite, restaurar } = useSimulatorLimits()
  const toast = useToast()

  // Borradores como texto: un input numerico a medio teclear no es un numero todavia.
  const [borrador, setBorrador] = useState<Record<Metric, string>>({
    users: String(limites.users),
    storage_gb: String(limites.storage_gb),
    api_calls: String(limites.api_calls),
  })

  const guardar = () => {
    // El valor que QUEDA se calcula una vez y alimenta las dos cosas: el limite vigente
    // y el texto del input. Antes se calculaban por separado y un `n || limites[m]`
    // trataba el 0 tecleado como "sin valor" con el closure viejo: el campo mostraba
    // 200 mientras el limite real pasaba a 70 (lo cazo la code review).
    const siguiente = { ...borrador }
    for (const m of METRICS) {
      const texto = borrador[m].trim()
      const n = Number(texto)
      // Vacio o basura -> se conserva el vigente; un numero -> acotado a [min, max].
      const valor = texto !== '' && Number.isFinite(n) ? clampLimite(m, n) : limites[m]
      setLimite(m, valor)
      siguiente[m] = String(valor)
    }
    setBorrador(siguiente)
    toast.showOk('Límites del simulador guardados')
  }

  const aDefecto = () => {
    restaurar()
    // De LIMITE_POR_DEFECTO, no literales sueltos: una copia se queda vieja.
    setBorrador({
      users: String(LIMITE_POR_DEFECTO.users),
      storage_gb: String(LIMITE_POR_DEFECTO.storage_gb),
      api_calls: String(LIMITE_POR_DEFECTO.api_calls),
    })
    toast.showOk('Límites restaurados')
  }

  return (
    <>
      <h1 className={styles.titulo}>Ajustes</h1>
      <p className={styles.subtitulo}>Tu perfil y las preferencias de esta sesión de trabajo.</p>

      <Card className={styles.bloque}>
        <h2 className={styles.tituloBloque}>Perfil</h2>
        {/* Solo lectura y sin boton de editar: estos datos vendran del sistema de
            identidad de la empresa cuando se conecte (ADR 0009); inventar su edicion
            hoy seria construir sobre un modelo de usuarios que no existe. */}
        <dl className={styles.perfil}>
          <div>
            <dt>Nombre</dt>
            <dd>{session?.nombre}</dd>
          </div>
          <div>
            <dt>Rol</dt>
            <dd>{hasRole('admin') ? 'Administración' : 'Comercial'}</dd>
          </div>
          <div>
            <dt>Idioma</dt>
            <dd>Español (es-ES)</dd>
          </div>
          <div>
            <dt>Zona horaria</dt>
            <dd>Europe/Madrid</dd>
          </div>
          <div>
            <dt>Notificaciones</dt>
            <dd>Desactivadas</dd>
          </div>
        </dl>
        <Callout tone="info">
          Estos datos vendrán del sistema de identidad de la empresa cuando se conecte. De momento
          no se pueden cambiar.
        </Callout>
      </Card>

      <Card className={styles.bloque}>
        <h2 className={styles.tituloBloque}>Límites del simulador</h2>
        <p className={styles.ayuda}>
          Hasta dónde llegan los deslizadores de una simulación. Si trabajas con planes pequeños
          (2–20 GB, por ejemplo), baja el máximo y ajustar el valor deja de ser un ejercicio de
          puntería. No limita lo que se puede simular: los valores exactos se pueden seguir
          tecleando y el servidor aplica sus propios topes.
        </p>

        <div className={styles.campos}>
          {METRICS.map((m) => (
            <label key={m} className={styles.campo}>
              <span>{ETIQUETA[m]}</span>
              <input
                type="number"
                min={LIMITE_MINIMO[m]}
                max={LIMITE_MAXIMO[m]}
                value={borrador[m]}
                onChange={(e) => setBorrador((b) => ({ ...b, [m]: e.target.value }))}
              />
              {/* Los topes del ajuste, visibles: el guardado acota a este rango. */}
              <small>
                entre {formatea(LIMITE_MINIMO[m])} y {formatea(LIMITE_MAXIMO[m])}
              </small>
            </label>
          ))}
        </div>

        <div className={styles.acciones}>
          <Button onClick={guardar}>Guardar límites</Button>
          <Button variant="ghost" onClick={aDefecto}>
            Restaurar valores por defecto
          </Button>
        </div>
      </Card>
    </>
  )
}
