// Las 8 ventanas; admin condicionado por hasRole(admin). Diseno: 3, 8

import { Navigate, Route, Routes } from 'react-router-dom'
import { PlanTemplatePage } from './features/admin/PlanTemplatePage'
import { PlansAdminPage } from './features/admin/PlansAdminPage'
import { CustomerDetailPage } from './features/customer/CustomerDetailPage'
import { NewCustomerPage } from './features/customer/NewCustomerPage'
import { LoginPage } from './features/login/LoginPage'
import { PlanDetailPage } from './features/plans/PlanDetailPage'
import { DashboardPage } from './features/search/DashboardPage'
import { SettingsPage } from './features/settings/SettingsPage'
import { SimulatorPage } from './features/simulator/SimulatorPage'
import { RatesProvider } from './lib/rates-context'
import { useSession } from './lib/session'
import { Topbar } from './ui/Topbar'
import styles from './routes.module.css'

/**
 * Sin sesion no hay pantallas: el login lo ocupa todo.
 *
 * Este guardia es UX SOBRE una autorizacion real (spec 07): la API exige sesion (401) y
 * las rutas de admin exigen rol (403) EN EL BACKEND. Lo de aqui decide que se pinta, no
 * que se puede hacer.
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

          {/* El detalle de plan es de CUALQUIER sesion (spec 08): el catalogo es
              informacion de venta, no de administracion. La URL corta ensena; la de
              /editar edita. React Router prioriza "nuevo" sobre ":id" por ranking de
              segmento estatico. */}
          <Route path="/planes/:id" element={<PlanDetailPage />} />

          {/* Ajustes: de cualquier usuario. El perfil es de demostracion; los limites
              del simulador son funcionales (spec 10). */}
          <Route path="/ajustes" element={<SettingsPage />} />

          {/* Administracion. El gating visual decide que pantallas existen para quien;
              la autorizacion de verdad vive en el backend (403 por rol, spec 07): un
              comercial que teclee la URL vera pantallas cuyas mutaciones rebotan. */}
          {esAdmin && <Route path="/planes" element={<PlansAdminPage />} />}
          {esAdmin && <Route path="/planes/nuevo" element={<PlanTemplatePage />} />}
          {esAdmin && <Route path="/planes/:id/editar" element={<PlanTemplatePage />} />}

          {/* Cualquier otra cosa al buscador: una SPA no debe dejar a nadie en blanco. */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </RatesProvider>
  )
}
