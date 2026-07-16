// Ventana 5 - Alta: el hint fiscal llega resuelto de GET /countries; nunca comparar el pais. Ref: 7.2

import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api, ApiError, type Country, type Plan } from '../../lib/api-client'
import { formatMinor } from '../../lib/currency-format'
import { Button } from '../../ui/Button'
import { Card } from '../../ui/Card'
import { Skeleton } from '../../ui/Skeleton'
import { useToast } from '../../ui/Toast'
import { IconWarning } from '../../ui/icons'
import styles from './NewCustomerPage.module.css'

/** Un resumen legible de los tramos, para la tarjeta de plan. */
function resumen(plan: Plan): string {
  const porMetrica = new Map<string, number>()
  for (const t of plan.tiers) porMetrica.set(t.metric, (porMetrica.get(t.metric) ?? 0) + 1)

  const etiquetas: Record<string, string> = {
    users: 'usuarios',
    storage_gb: 'almacenamiento',
    api_calls: 'llamadas API',
  }

  const partes = [...porMetrica].map(([m, n]) => `${etiquetas[m] ?? m} (${n} tramos)`)
  const desde = plan.tiers.reduce((min, t) => Math.min(min, t.unit_price_minor), Infinity)

  return `Cobra por ${partes.join(' y ')} · desde ${formatMinor(desde, plan.currency)}/unidad`
}

export function NewCustomerPage() {
  const navegar = useNavigate()
  const toast = useToast()

  const [countries, setCountries] = useState<Country[] | null>(null)
  const [plans, setPlans] = useState<Plan[] | null>(null)
  const [cargaFallida, setCargaFallida] = useState(false)
  // Reintento en la SPA, como el buscador: navegar(0) recargaba la pagina entera.
  const [intento, setIntento] = useState(0)

  const [nombre, setNombre] = useState('')
  const [pais, setPais] = useState('ES')
  const [email, setEmail] = useState('')
  const [fiscal, setFiscal] = useState('')
  const [planId, setPlanId] = useState<number | null>(null)

  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState<ApiError | null>(null)

  useEffect(() => {
    setCargaFallida(false)
    Promise.all([api.countries(), api.plans()])
      .then(([cs, ps]) => {
        setCountries(cs)
        setPlans(ps)
        setPlanId(ps[0]?.id ?? null)
      })
      .catch(() => setCargaFallida(true))
  }, [intento])

  // EL HINT LLEGA RESUELTO DE LA API, junto al pais elegido (referencia 7.2). Aqui NO hay
  // ningun `if (pais === 'ES')`: la UI pinta el texto que recibe. Es el mismo principio
  // que el backend impone al registro de validadores, aplicado al otro lado.
  const paisElegido = useMemo(() => countries?.find((c) => c.code === pais), [countries, pais])

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault()
    if (planId === null) return

    setEnviando(true)
    setError(null)

    try {
      const { id } = await api.createCustomer({
        company_name: nombre,
        // Se envia TAL CUAL lo teclea el humano: la normalizacion es del servidor
        // (referencia 7.4). Normalizar aqui seria reimplementar la regla en el cliente.
        fiscal_id: fiscal,
        email,
        country: pais,
        plan_id: planId,
      })

      toast.showOk('Cliente dado de alta')
      navegar(`/clientes/${id}`)
    } catch (err) {
      if (err instanceof ApiError) setError(err)
      else toast.showError('No hemos podido dar de alta al cliente.')
      setEnviando(false)
    }
  }

  if (cargaFallida) {
    return (
      <Card>
        <p>No hemos podido cargar los países ni los planes.</p>
        <Button variant="secondary" onClick={() => setIntento((i) => i + 1)}>
          Reintentar
        </Button>
      </Card>
    )
  }

  /** El error de un campo concreto, para pintarlo junto a el (referencia 13.1). */
  const errorDe = (campo: string) => (error?.field === campo ? error : null)
  const errorFiscal = errorDe('fiscal_id')
  const errorNombre = errorDe('company_name')
  const errorEmail = errorDe('email')

  return (
    <>
      <h1 className={styles.titulo}>Nuevo cliente</h1>
      <p className={styles.subtitulo}>Registra una empresa para poder simular su presupuesto.</p>

      <Card className={styles.form}>
        <form onSubmit={enviar} noValidate>
          <div className={styles.campo}>
            <label className={styles.label} htmlFor="nombre">
              Nombre de empresa
            </label>
            <input
              id="nombre"
              className={`${styles.input} ${errorNombre !== null ? styles.inputError : ''}`}
              value={nombre}
              onChange={(e) => {
                setNombre(e.target.value)
                setError(null)
              }}
              placeholder="Acme Innovación S.L."
              maxLength={200}
              required
              autoFocus
              aria-invalid={errorNombre !== null}
            />
            {/* El mensaje, no solo el borde: un borde rojo mudo no dice que arreglar, y
                para un lector de pantalla ni siquiera existe (13.1). */}
            {errorNombre !== null && (
              <p className={styles.error} role="alert">
                <IconWarning size={14} />
                {errorNombre.message}
              </p>
            )}
          </div>

          <div className={`${styles.campo} ${styles.dos}`}>
            <div>
              <label className={styles.label} htmlFor="pais">
                País
              </label>
              {countries === null ? (
                <Skeleton height={46} radius="var(--radius-field)" />
              ) : (
                <select
                  id="pais"
                  className={styles.select}
                  value={pais}
                  onChange={(e) => {
                    setPais(e.target.value)
                    setError(null)
                  }}
                >
                  {countries.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.name}
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div>
              <label className={styles.label} htmlFor="email">
                Email de contacto
              </label>
              <input
                id="email"
                type="email"
                className={`${styles.input} ${errorEmail !== null ? styles.inputError : ''}`}
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value)
                  setError(null)
                }}
                placeholder="contacto@empresa.com"
                maxLength={254}
                required
                aria-invalid={errorEmail !== null}
              />
              {errorEmail !== null && (
                <p className={styles.error} role="alert">
                  <IconWarning size={14} />
                  {errorEmail.message}
                </p>
              )}
            </div>
          </div>

          <div className={styles.campo}>
            <label className={styles.label} htmlFor="fiscal">
              Identificador fiscal
            </label>
            <input
              id="fiscal"
              className={`${styles.input} ${styles.fiscal} ${errorFiscal !== null ? styles.inputError : ''}`}
              value={fiscal}
              onChange={(e) => {
                setFiscal(e.target.value)
                setError(null)
              }}
              maxLength={20}
              required
              aria-invalid={errorFiscal !== null}
              aria-describedby="fiscal-ayuda"
            />

            {errorFiscal === null ? (
              // El hint del pais, tal y como lo mando la API.
              <p className={styles.ayuda} id="fiscal-ayuda">
                {paisElegido?.fiscal_id.hint ?? ' '}
              </p>
            ) : (
              <p className={styles.error} id="fiscal-ayuda" role="alert">
                <IconWarning size={14} />
                {errorFiscal.message}
                {/* El duplicado trae el cliente existente: enlazamos a su ficha en vez de
                    dejar al comercial buscarlo a mano (contrato-api.md 2.1). */}
                {errorFiscal.code === 'FISCAL_ID_DUPLICATE' &&
                  errorFiscal.extra?.['existing_customer'] !== undefined && (
                    <Link
                      to={`/clientes/${(errorFiscal.extra['existing_customer'] as { id: number }).id}`}
                    >
                      Ver su ficha
                    </Link>
                  )}
              </p>
            )}
          </div>

          <div className={styles.campo}>
            <span className={styles.label}>Plan</span>
            {plans === null ? (
              <Skeleton height={70} radius="var(--radius-panel)" />
            ) : (
              <div className={styles.planes} role="radiogroup" aria-label="Plan">
                {plans.map((p) => (
                  <label
                    key={p.id}
                    className={`${styles.plan} ${planId === p.id ? styles.planElegido : ''}`}
                  >
                    <input
                      type="radio"
                      name="plan"
                      className={styles.planRadio}
                      checked={planId === p.id}
                      onChange={() => setPlanId(p.id)}
                    />
                    <span>
                      <span className={styles.planNombre}>{p.name}</span>
                      <span className={styles.planResumen}>{p.description ?? resumen(p)}</span>
                    </span>
                  </label>
                ))}
              </div>
            )}
          </div>

          {/* Un error sin campo atribuible (p. ej. PLAN_ARCHIVED) no puede ir junto a un
              input: va aqui, pero sigue siendo el mensaje del backend. */}
          {error !== null && error.field === undefined && (
            <p className={styles.error} role="alert">
              <IconWarning size={14} />
              {error.message}
            </p>
          )}

          <div className={styles.acciones}>
            <Button type="submit" loading={enviando} disabled={planId === null}>
              Dar de alta
            </Button>
            <Button type="button" variant="ghost" onClick={() => navegar('/')}>
              Cancelar
            </Button>
          </div>
        </form>
      </Card>
    </>
  )
}
