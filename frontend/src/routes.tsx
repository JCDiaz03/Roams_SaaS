// Las 7 ventanas; admin condicionado por hasRole(admin). Diseno: 3

import { Navigate, Route, Routes } from 'react-router-dom'
import { PlanTemplatePage } from './features/admin/PlanTemplatePage'
import { PlansAdminPage } from './features/admin/PlansAdminPage'
import { CustomerDetailPage } from './features/customer/CustomerDetailPage'
import { NewCustomerPage } from './features/customer/NewCustomerPage'
import { LoginPage } from './features/login/LoginPage'
import { DashboardPage } from './features/search/DashboardPage'
import { SimulatorPage } from './features/simulator/SimulatorPage'
import { RatesProvider } from './lib/rates-context'
import { useSession } from './lib/session'
import { Topbar } from './ui/Topbar'
import styles from './routes.module.css'

/**
 * Sin sesion no hay pantallas: el login lo ocupa todo.
 *
 * Esto es UX, NO SEGURIDAD (referencia 8.3): la API no esta protegida y cualquiera puede
 * llamarla directamente. El guardia existe para que la aplicacion tenga sentido, no para
 * defender nada.
 */
export function AppRoutes() {
  const { session, hasRole, restaurando } = useSession()

  // Mientras GET /auth/session decide si hay alguien (un F5 con la cookie viva), no se
  // pinta nada: enseñar el login y sustituirlo al instante seria un parpadeo que miente.
  if (restaurando) return null

  if (session === null) return <LoginPage />

  const esAdmin = hasRole('admin')

  return (
    // Los tipos se piden UNA vez para toda la app -topbar y simulador comparten estado-,
    // y solo con sesion: en el login nadie los usa. Al montarse con cada login, ademas,
    // cada sesion entra con los tipos recien pedidos.
    <RatesProvider>
      <Topbar />
      <main className={styles.main}>
        <Routes>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/clientes/nuevo" element={<NewCustomerPage />} />
          <Route path="/clientes/:id" element={<CustomerDetailPage />} />
          <Route path="/clientes/:id/simular" element={<SimulatorPage />} />

          {/* Administracion. El gating es UX -que la app tenga sentido-, NO seguridad: la
              API no esta protegida y un comercial que teclee la URL igualmente no rompe
              nada que no pudiera romper con curl (referencia 8.3). */}
          {esAdmin && <Route path="/planes" element={<PlansAdminPage />} />}
          {esAdmin && <Route path="/planes/nuevo" element={<PlanTemplatePage />} />}
          {esAdmin && <Route path="/planes/:id" element={<PlanTemplatePage />} />}

          {/* Cualquier otra cosa al buscador: una SPA no debe dejar a nadie en blanco. */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </RatesProvider>
  )
}
