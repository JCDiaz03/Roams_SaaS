// Wordmark, buscador compacto, divisa, tema, menu de usuario. Diseno: 3

import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSession } from '../lib/session'
import { useRatesContext } from '../lib/rates-context'
import { Button } from './Button'
import { Chip } from './Chip'
import { CurrencySelect } from './CurrencySelect'
import { ThemeToggle } from './ThemeToggle'
import styles from './Topbar.module.css'
import logoUrl from '../assets/roams-logo.svg'
import { IconAdmin, IconLogout, IconSearch, IconSettings, IconWarning } from './icons'

const fecha = (iso: string) =>
  new Date(iso).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })

export function Topbar() {
  const { session, theme, hasRole, logout, setCurrency, toggleTheme } = useSession()
  const rates = useRatesContext()
  const navegar = useNavigate()

  const [menuAbierto, setMenuAbierto] = useState(false)
  const [termino, setTermino] = useState('')
  const menuRef = useRef<HTMLDivElement>(null)

  // Un menu que solo se cierra con su propio boton es un menu que se queda abierto: se
  // cierra al pulsar fuera y con Escape, que es lo que cualquiera espera.
  useEffect(() => {
    if (!menuAbierto) return

    const fuera = (e: MouseEvent) => {
      if (menuRef.current !== null && !menuRef.current.contains(e.target as Node)) {
        setMenuAbierto(false)
      }
    }
    const escape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuAbierto(false)
    }

    document.addEventListener('mousedown', fuera)
    document.addEventListener('keydown', escape)
    return () => {
      document.removeEventListener('mousedown', fuera)
      document.removeEventListener('keydown', escape)
    }
  }, [menuAbierto])

  if (session === null) return null

  const buscar = (e: React.FormEvent) => {
    e.preventDefault()
    navegar(`/?q=${encodeURIComponent(termino)}`)
  }

  return (
    <header className={styles.bar}>
      <button type="button" className={styles.marca} onClick={() => navegar('/')}>
        {/* El logo de marca (assets/roams-logo.svg), el mismo que el login. alt vacio:
            el wordmark de al lado ya nombra la marca. */}
        <span className={styles.logo}>
          <img src={logoUrl} alt="" width={30} height={30} />
        </span>
        <span className={styles.wordmark}>
          SaaS<em>-O-</em>Matic
        </span>
      </button>

      <form className={styles.buscador} onSubmit={buscar} role="search">
        <span className={styles.lupa}>
          <IconSearch />
        </span>
        <input
          className={styles.input}
          value={termino}
          onChange={(e) => setTermino(e.target.value)}
          placeholder="Busca por empresa o identificador fiscal…"
          aria-label="Buscar cliente"
          // El mismo tope que el esquema del backend: el 400 existe, pero que el input lo
          // provoque seria un error de cliente mal programado.
          maxLength={100}
        />
      </form>

      <div className={styles.hueco} />

      {/* Badge de tipos desactualizados. Persistente mientras lo esten: un dashboard que
          ensena un numero viejo EN SILENCIO es peor que uno que dice que no sabe. */}
      {rates.estado === 'listo' && rates.rates.stale && (
        <Chip tone="warning" icon={<IconWarning size={14} />}>
          Tipos del {fecha(rates.rates.as_of)}
        </Chip>
      )}

      {/* Sin tipos, la salida no puede ser F5: el fallo de GET /rates al entrar dejaba
          el selector muerto TODA la sesion aunque la red volviera. */}
      {rates.estado === 'error' && (
        <Button variant="secondary" size="sm" onClick={rates.reintentar}>
          Sin tipos de cambio · Reintentar
        </Button>
      )}

      <CurrencySelect
        value={session.currency}
        onChange={setCurrency}
        disabled={rates.estado !== 'listo'}
      />

      <ThemeToggle theme={theme} onToggle={toggleTheme} />

      <div className={styles.usuario} ref={menuRef}>
        <button
          type="button"
          className={styles.botonUsuario}
          onClick={() => setMenuAbierto((v) => !v)}
          aria-expanded={menuAbierto}
        >
          <span className={styles.nombreUsuario}>Hola, {session.nombre}</span>
          <span className={styles.avatar} aria-hidden="true">
            {session.nombre.charAt(0).toUpperCase()}
          </span>
          {/* En movil solo queda el avatar, que es aria-hidden: sin esto el boton se
              queda sin nombre accesible y un lector de pantalla lee "botón" y ya. */}
          <span className="sr-only">Menú de {session.nombre}</span>
        </button>

        {/* Un grupo de botones a secas, SIN role="menu": ese rol promete navegacion por
            flechas y foco gestionado que aqui no existe; para dos acciones, prometerlo
            y no darlo es peor que no prometerlo. */}
        {menuAbierto && (
          <div className={styles.menu}>
            {/* hasRole('admin'), no una comparacion de strings: el rol lo dicta el
                servidor y el literal del usuario magico ya ni existe en el frontend. */}
            {hasRole('admin') && (
              <button
                type="button"
                className={styles.itemMenu}
                onClick={() => {
                  setMenuAbierto(false)
                  navegar('/planes')
                }}
              >
                <IconAdmin />
                Administración
              </button>
            )}
            {/* Ajustes es de TODOS: perfil (demo) + limites del simulador (spec 10). */}
            <button
              type="button"
              className={styles.itemMenu}
              onClick={() => {
                setMenuAbierto(false)
                navegar('/ajustes')
              }}
            >
              <IconSettings />
              Ajustes
            </button>
            <div className={styles.separador} />
            <button
              type="button"
              className={`${styles.itemMenu} ${styles.itemPeligro}`}
              onClick={() => {
                logout()
                // La URL vuelve al inicio: sin esto, el siguiente login aterrizaria en
                // la ruta donde el anterior cerro sesion (p. ej. /planes/3), que no es
                // su sitio ni, si era de admin, quiza su rol.
                navegar('/')
              }}
            >
              <IconLogout />
              Cerrar sesión
            </button>
          </div>
        )}
      </div>
    </header>
  )
}
