// Seccion de planes activos del dashboard, colapsable. Spec: 08 · Diseno: 8

import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api, type Plan } from '../../lib/api-client'
import { ETIQUETA_METRICA, metricasDe } from '../../lib/plan-format'
import { Button } from '../../ui/Button'
import { Chip } from '../../ui/Chip'
import styles from './ActivePlansSection.module.css'

type Estado =
  | { estado: 'cargando' }
  | { estado: 'listo'; planes: Plan[] }
  | { estado: 'error' }

/**
 * El catalogo, debajo del buscador y COLAPSADO por defecto: el buscador de clientes es la
 * vista obligatoria del enunciado y el flujo principal; esto es consulta ocasional. Mismo
 * patron <details> que los archivados del panel de admin.
 *
 * Estado propio a proposito: si GET /plans falla, el aviso es de esta seccion y el
 * buscador sigue funcionando — el catalogo nunca tumba la pantalla principal.
 */
export function ActivePlansSection() {
  const [datos, setDatos] = useState<Estado>({ estado: 'cargando' })
  const [intento, setIntento] = useState(0)

  useEffect(() => {
    let cancelado = false
    setDatos({ estado: 'cargando' })

    api
      .plans()
      .then((planes) => {
        if (!cancelado) setDatos({ estado: 'listo', planes })
      })
      .catch(() => {
        if (!cancelado) setDatos({ estado: 'error' })
      })

    return () => {
      cancelado = true
    }
  }, [intento])

  return (
    <details className={styles.seccion}>
      <summary className={styles.resumen}>
        Planes activos{datos.estado === 'listo' && <> ({datos.planes.length})</>}
      </summary>

      {datos.estado === 'cargando' && <p className={styles.nota}>Cargando planes…</p>}

      {datos.estado === 'error' && (
        <p className={styles.nota}>
          No hemos podido cargar los planes.{' '}
          <Button variant="ghost" size="sm" onClick={() => setIntento((i) => i + 1)}>
            Reintentar
          </Button>
        </p>
      )}

      {datos.estado === 'listo' && (
        <div className={styles.lista}>
          {datos.planes.map((plan) => (
            <Link key={plan.id} to={`/planes/${plan.id}`} className={styles.tarjeta}>
              <span className={styles.nombre}>
                {plan.name}
                <Chip>v{plan.version}</Chip>
              </span>
              <span className={styles.chips}>
                {metricasDe(plan).map((m) => (
                  <Chip key={m} tone="brand">
                    {ETIQUETA_METRICA[m]}
                  </Chip>
                ))}
                <Chip>{plan.currency}</Chip>
              </span>
              <span className={styles.detalle}>
                {plan.tiers.length} {plan.tiers.length === 1 ? 'tramo' : 'tramos'} · Ver detalle
              </span>
            </Link>
          ))}
        </div>
      )}
    </details>
  )
}
