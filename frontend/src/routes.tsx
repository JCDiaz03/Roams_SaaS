// Las 7 ventanas; admin condicionado por hasRole(admin). Diseno: 3

import { Navigate, Route, Routes } from 'react-router-dom'
import { PlanTemplatePage } from './features/admin/PlanTemplatePage'
import { PlansAdminPage } from './features/admin/PlansAdminPage'
import { CustomerDetailPage } from './features/customer/CustomerDetailPage'
import { NewCustomerPage } from './features/customer/NewCustomerPage'
import { LoginPage } from './features/login/LoginPage'
import { DashboardPage } from './features/search/DashboardPage'
import { SimulatorPage } from './features/simulator/SimulatorPage'
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
  const { session, hasRole } = useSession()

  if (session === null) return <LoginPage />

  const esAdmin = hasRole('admin')

  return (
    <>
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
    </>
  )
}
