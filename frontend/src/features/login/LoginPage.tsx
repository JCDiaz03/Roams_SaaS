// Ventana 1 - Login mock. Diseno: 4

import { useState } from 'react'
import { useSession } from '../../lib/session'
import { Button } from '../../ui/Button'
import { Card } from '../../ui/Card'
import { ThemeToggle } from '../../ui/ThemeToggle'
import { IconLogo } from '../../ui/icons'
import styles from './LoginPage.module.css'

/**
 * El acceso. Desde la spec 07 el login es una peticion REAL (POST /auth/login): la
 * sesion la abre el servidor y la cookie es HttpOnly. Lo que sigue siendo de
 * demostracion son las credenciales, y se declaran abajo. Diseno: limpio y neutro, SIN
 * candados dramaticos ni escudos (diseno, ventana 1).
 */
export function LoginPage() {
  const { login, session, toggleTheme } = useSession()

  const [usuario, setUsuario] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault()
    setEnviando(true)
    setError(null)

    // El mensaje viene del servidor (credenciales, rate limit) o del cliente API (red).
    const mensaje = await login(usuario, password)
    if (mensaje !== null) {
      setError(mensaje)
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
        <form onSubmit={(e) => void enviar(e)} noValidate>
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
              className={`${styles.input} ${error !== null ? styles.inputError : ''}`}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              aria-invalid={error !== null}
              aria-describedby={error !== null ? 'login-error' : undefined}
            />
            {/* El error va JUNTO al campo, no en un alert generico (referencia 13.1). */}
            {error !== null && (
              <p className={styles.error} id="login-error" role="alert">
                {error}
              </p>
            )}
          </div>

          <div className={styles.acciones}>
            <Button type="submit" size="lg" block loading={enviando}>
              Entrar
            </Button>
          </div>
        </form>

        {/* Las credenciales de demostracion se DECLARAN, no se disimulan (spec 07, 7):
            la sesion y los permisos son reales; lo unico simulado es quien puede entrar. */}
        <p className={styles.nota}>
          Credenciales de demostración: cualquier usuario con la contraseña <strong>1111</strong>.
          Entra como <strong>ADMIN</strong> para ver los paneles de administración.
        </p>
      </Card>
    </div>
  )
}
