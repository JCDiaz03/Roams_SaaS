// Ventana 7 - Crear / editar plan. Diseno: 4

import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { METRICS, minorUnitOf, quote, type CurrencyCode, type Metric, type Tier } from '@saas/pricing'
import { ApiError, api, type Plantilla, type PlantillaTier, type Violacion } from '../../lib/api-client'
import { formatMinor } from '../../lib/currency-format'
import { Button } from '../../ui/Button'
import { Callout } from '../../ui/Callout'
import { Card } from '../../ui/Card'
import { Skeleton } from '../../ui/Skeleton'
import { useToast } from '../../ui/Toast'
import { TierEditor, UNIDAD, bloqueVacio, type BloqueBorrador } from './TierEditor'
import styles from './PlanTemplatePage.module.css'

const DIVISAS: readonly CurrencyCode[] = ['EUR', 'USD', 'GBP', 'CHF', 'JPY']

type Borradores = Record<Metric, BloqueBorrador>

const vacios = (): Borradores => ({
  users: bloqueVacio(true),
  storage_gb: { activo: false, tramos: [] },
  api_calls: { activo: false, tramos: [] },
})

/** Un entero de un campo de texto, o null si esta vacío/no es un número. */
const entero = (s: string): number | null => {
  const t = s.trim()
  if (t === '') return null
  const n = Number(t)
  return Number.isFinite(n) ? Math.trunc(n) : null
}

/**
 * El precio se teclea en unidades MAYORES ("10,50") y viaja en menores (1050).
 *
 * El factor es 10^minor_unit DE LA DIVISA DEL PLAN, nunca un 100 fijo: con JPY
 * (minor_unit 0), "500" son 500 minor, y un x100 fijo guardaria un precio cien veces
 * mayor. Es exactamente la rotura que la referencia 4.4 predice para el "x100" asumido.
 */
const aMinor = (s: string, currency: CurrencyCode): number | null => {
  const t = s.trim().replace(',', '.')
  if (t === '') return null
  const n = Number(t)
  return Number.isFinite(n) ? Math.round(n * 10 ** minorUnitOf(currency)) : null
}

/** Los borradores -> los tramos del contrato. El sort_order lo deriva el servidor. */
function aTiers(borradores: Borradores, currency: CurrencyCode): PlantillaTier[] {
  return METRICS.flatMap((metric) => {
    const b = borradores[metric]
    if (!b.activo) return []

    return b.tramos.map((t, i) => ({
      metric,
      // El ultimo es SIEMPRE el abierto: es la forma del editor, no una eleccion.
      up_to: i === b.tramos.length - 1 ? null : entero(t.upTo),
      unit_price_minor: aMinor(t.price, currency) ?? 0,
    }))
  })
}

export function PlanTemplatePage() {
  const { id } = useParams<{ id: string }>()
  const navegar = useNavigate()
  const toast = useToast()

  const editando = id !== undefined && id !== 'nuevo'

  const [nombre, setNombre] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [currency, setCurrency] = useState<CurrencyCode>('EUR')
  const [borradores, setBorradores] = useState<Borradores>(vacios)

  const [cargando, setCargando] = useState(editando)
  const [enviando, setEnviando] = useState(false)
  const [violaciones, setViolaciones] = useState<Violacion[]>([])
  const [errorGeneral, setErrorGeneral] = useState<string | null>(null)
  /** El PLAN_NAME_TAKEN del backend: llega como ApiError con field 'name', no como violacion. */
  const [errorNombre, setErrorNombre] = useState<string | null>(null)

  // Ejemplo de la vista previa: lo que costaria este consumo con los tramos escritos.
  const [ejemplo, setEjemplo] = useState<Record<Metric, number>>({
    users: 15,
    storage_gb: 100,
    api_calls: 10_000,
  })

  useEffect(() => {
    if (!editando) return

    api
      .plans(true)
      .then((planes) => {
        const plan = planes.find((p) => p.id === Number(id))
        if (plan === undefined) {
          navegar('/planes')
          return
        }

        setNombre(plan.name)
        setDescripcion(plan.description ?? '')
        setCurrency(plan.currency)

        const nuevos = vacios()
        for (const m of METRICS) {
          const suyos = plan.tiers.filter((t) => t.metric === m).sort((a, b) => a.sort_order - b.sort_order)
          nuevos[m] = suyos.length === 0
            ? { activo: false, tramos: [] }
            : {
                activo: true,
                tramos: suyos.map((t) => ({
                  upTo: t.up_to === null ? '' : String(t.up_to),
                  // El inverso de aMinor, con el MISMO factor por divisa.
                  price: String(t.unit_price_minor / 10 ** minorUnitOf(plan.currency)),
                })),
              }
        }
        setBorradores(nuevos)
        setCargando(false)
      })
      .catch(() => {
        setErrorGeneral('No hemos podido cargar el plan.')
        setCargando(false)
      })
  }, [editando, id, navegar])

  /**
   * LA VISTA PREVIA EN VIVO, con el MISMO motor que el backend.
   *
   * No hay una segunda implementacion del calculo "para el preview": es quote() de
   * @saas/pricing, igual que en el simulador (referencia 10). Sin impuesto: aqui se
   * enseña la tarifa, no un presupuesto a un cliente concreto.
   */
  const previa = useMemo(() => {
    const tiers = aTiers(borradores, currency)
    if (tiers.length === 0) return null

    // El motor confia en sus entradas: con tramos a medio escribir (un up_to vacio en
    // medio) el resultado no significa nada, asi que no se enseña.
    const incompletos = tiers.some((t, i) => t.up_to === null && i !== tiers.length - 1 && tiers[i + 1]?.metric === t.metric)
    if (incompletos) return null

    try {
      return quote({
        tiers: tiers.map((t, i) => ({ ...t, sort_order: i })) as Tier[],
        quantities: ejemplo,
        tax_rate_bp: 0,
        currency,
      })
    } catch {
      return null
    }
  }, [borradores, ejemplo, currency])

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault()
    setEnviando(true)
    setViolaciones([])
    setErrorGeneral(null)
    setErrorNombre(null)

    const plantilla: Plantilla = {
      name: nombre,
      ...(descripcion.trim() === '' ? {} : { description: descripcion }),
      currency,
      tiers: aTiers(borradores, currency),
    }

    try {
      const plan = editando
        ? await api.versionPlan(Number(id), plantilla)
        : await api.createPlan(plantilla)

      toast.showOk(editando ? `«${plan.name}» actualizado a la v${plan.version}` : `«${plan.name}» creado`)
      navegar('/planes')
    } catch (err) {
      if (err instanceof ApiError && err.code === 'PLAN_TEMPLATE_INVALID') {
        // TODAS las violaciones, cada una a su fila. El admin que ha escrito cuatro
        // tramos mal no debe descubrirlos de uno en uno.
        setViolaciones((err.extra?.['violations'] as Violacion[] | undefined) ?? [])
      } else if (err instanceof ApiError && err.field === 'name') {
        // El nombre ocupado se pinta JUNTO al campo, como cualquier error de campo (13.1).
        setErrorNombre(err.message)
      } else if (err instanceof ApiError) {
        setErrorGeneral(err.message)
      } else {
        setErrorGeneral('No hemos podido guardar el plan.')
      }
      setEnviando(false)
    }
  }

  if (cargando) {
    return (
      <Card>
        <Skeleton height={46} />
      </Card>
    )
  }

  const violacionesDe = (m: Metric) => violaciones.filter((v) => v.metric === m)

  return (
    <>
      <h1 className={styles.titulo}>{editando ? 'Editar plan' : 'Nuevo plan'}</h1>
      <p className={styles.subtitulo}>
        Define qué métricas cobra el plan y cuánto cuesta cada escalón.
      </p>

      <div className={styles.rejilla}>
        <Card>
          {/* TODA la jerga de versionado que el admin ve, y aparece una vez
              (referencia 5.5). Nada de "snapshot", "v2" ni "archivar la anterior". */}
          {editando && (
            <div className={styles.aviso}>
              <Callout tone="info" title="Los clientes actuales mantendrán su tarifa">
                Al guardar se creará una versión nueva del plan. Los clientes que ya lo tienen
                seguirán con las condiciones que firmaron.
              </Callout>
            </div>
          )}

          <form onSubmit={enviar} noValidate>
            <div className={`${styles.campo} ${styles.dos}`}>
              <div>
                <label className={styles.label} htmlFor="nombre">
                  Nombre del plan
                </label>
                <input
                  id="nombre"
                  className={`${styles.input} ${errorNombre !== null ? styles.inputError : ''}`}
                  value={nombre}
                  onChange={(e) => {
                    setNombre(e.target.value)
                    setErrorNombre(null)
                  }}
                  placeholder="Plan Ágora"
                  maxLength={100}
                  required
                  aria-invalid={errorNombre !== null}
                  // Editar no puede renombrar: v1 y v2 comparten nombre, o "la version
                  // anterior de este plan" deja de significar nada.
                  disabled={editando}
                  title={editando ? 'El nombre se hereda de la versión anterior' : undefined}
                />
                {errorNombre !== null && (
                  <p className={styles.error} role="alert">
                    {errorNombre}
                  </p>
                )}
              </div>

              <div>
                <label className={styles.label} htmlFor="currency">
                  Divisa de facturación
                </label>
                <select
                  id="currency"
                  className={styles.select}
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value as CurrencyCode)}
                >
                  {DIVISAS.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className={styles.campo}>
              <label className={styles.label} htmlFor="descripcion">
                Descripción
              </label>
              <input
                id="descripcion"
                className={styles.input}
                value={descripcion}
                onChange={(e) => setDescripcion(e.target.value)}
                placeholder="Tarifa por usuario activo."
                maxLength={500}
              />
            </div>

            <h2 className={styles.seccion}>Qué cobra este plan</h2>
            {METRICS.map((m) => (
              <TierEditor
                key={m}
                metric={m}
                bloque={borradores[m]}
                onChange={(b) => setBorradores((prev) => ({ ...prev, [m]: b }))}
                violaciones={violacionesDe(m)}
                currency={currency}
              />
            ))}

            {errorGeneral !== null && (
              <p className={styles.error} role="alert">
                {errorGeneral}
              </p>
            )}
            {/* Violaciones sin metrica (divisa, ningun bloque). */}
            {violaciones
              .filter((v) => v.metric === undefined)
              .map((v, i) => (
                <p className={styles.error} role="alert" key={i}>
                  {v.message}
                </p>
              ))}

            <div className={styles.acciones}>
              <Button type="submit" loading={enviando}>
                {editando ? 'Guardar como versión nueva' : 'Crear plan'}
              </Button>
              <Button type="button" variant="ghost" onClick={() => navegar('/planes')}>
                Cancelar
              </Button>
            </div>
          </form>
        </Card>

        <Card className={styles.previa}>
          <p className={styles.previaTitulo}>Vista previa</p>

          <div className={styles.ejemplo}>
            {METRICS.filter((m) => borradores[m].activo).map((m) => (
              <label className={styles.ejemploFila} key={m}>
                <span>{UNIDAD[m]}</span>
                <input
                  type="number"
                  min={0}
                  value={ejemplo[m]}
                  onChange={(e) => setEjemplo((x) => ({ ...x, [m]: Math.max(0, Number(e.target.value)) }))}
                />
              </label>
            ))}
          </div>

          {previa === null ? (
            <p className={styles.previaInvalida}>
              Rellena los tramos para ver qué costaría un ejemplo con esta tarifa.
            </p>
          ) : (
            <div className={styles.previaTotal}>
              <div className={styles.previaImporte}>{formatMinor(previa.base_minor, currency)}</div>
              <p className={styles.previaNota}>
                al mes, sin impuestos. El impuesto depende del país de cada cliente.
              </p>
            </div>
          )}
        </Card>
      </div>
    </>
  )
}
