// Las 7 ventanas; admin condicionado por hasRole(admin). Diseno: 3
//
// Estado: (parcial). Las 5 pantallas de Fase 1. Las dos de administracion (listado y
// plantilla de planes) son Fase 2 (roadmap 4) y necesitan POST/PUT/DELETE /plans, que aun
// no existen.

import { Navigate, Route, Routes } from 'react-router-dom'
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
  const { session } = useSession()

  if (session === null) return <LoginPage />

  return (
    <>
      <Topbar />
      <main className={styles.main}>
        <Routes>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/clientes/nuevo" element={<NewCustomerPage />} />
          <Route path="/clientes/:id" element={<CustomerDetailPage />} />
          <Route path="/clientes/:id/simular" element={<SimulatorPage />} />
          {/* Cualquier otra cosa al buscador: una SPA no debe dejar a nadie en blanco. */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </>
  )
}
