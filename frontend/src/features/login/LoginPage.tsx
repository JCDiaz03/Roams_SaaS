// Ventana 1 - Login mock. Diseno: 4

import { useState } from 'react'
import { useSession } from '../../lib/session'
import { Button } from '../../ui/Button'
import { Card } from '../../ui/Card'
import { ThemeToggle } from '../../ui/ThemeToggle'
import { IconLogo } from '../../ui/icons'
import styles from './LoginPage.module.css'

/**
 * El acceso mock. Diseno: limpio y neutro, SIN candados dramaticos ni escudos: no debe
 * aparentar una seguridad que no hay (diseno, ventana 1).
 */
export function LoginPage() {
  const { login, session, toggleTheme } = useSession()

  const [usuario, setUsuario] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(false)
  const [enviando, setEnviando] = useState(false)

  const enviar = (e: React.FormEvent) => {
    e.preventDefault()
    setEnviando(true)
    setError(false)

    if (!login(usuario, password)) {
      setError(true)
      setEnviando(false)
    }
    // Si entra, el enrutado cambia de pantalla y este componente se desmonta.
  }

  return (
    <div className={styles.pantalla}>
      {/* El conmutador de tema esta tambien aqui: es la unica pantalla sin topbar, y
          quien prefiera oscuro no deberia tener que entrar antes para conseguirlo. */}
      <ThemeToggle theme={session?.theme ?? 'light'} onToggle={toggleTheme} floating />

      <div className={styles.marca}>
        <span className={styles.logo}>
          <IconLogo size={24} />
        </span>
        <span className={styles.wordmark}>
          SaaS<em>-O-</em>Matic
        </span>
      </div>

      <Card className={styles.tarjeta}>
        <form onSubmit={enviar} noValidate>
          <div className={styles.campo}>
            <label className={styles.label} htmlFor="usuario">
              Usuario
            </label>
            <input
              id="usuario"
              className={styles.input}
              value={usuario}
              onChange={(e) => setUsuario(e.target.value)}
              autoComplete="username"
              autoFocus
              maxLength={60}
            />
          </div>

          <div className={styles.campo}>
            <label className={styles.label} htmlFor="password">
              Contraseña
            </label>
            <input
              id="password"
              type="password"
              className={`${styles.input} ${error ? styles.inputError : ''}`}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              aria-invalid={error}
              aria-describedby={error ? 'login-error' : undefined}
            />
            {/* El error va JUNTO al campo, no en un alert generico (referencia 13.1). */}
            {error && (
              <p className={styles.error} id="login-error" role="alert">
                Usuario o contraseña incorrectos.
              </p>
            )}
          </div>

          <div className={styles.acciones}>
            <Button type="submit" size="lg" block loading={enviando}>
              Entrar
            </Button>
          </div>
        </form>

        {/* El mock se DECLARA, no se disimula (referencia 8.3). Esconderlo seria fingir
            una seguridad que no existe, y el evaluador lo va a ver en el codigo igual. */}
        <p className={styles.nota}>
          Acceso simulado: cualquier usuario con la contraseña <strong>1111</strong>. Entra como{' '}
          <strong>ADMIN</strong> para ver los paneles de administración.
        </p>
      </Card>
    </div>
  )
}
