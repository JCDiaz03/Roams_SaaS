// Layout + topbar + rutas. Diseno: 01-specs/diseno-frontend.md 3

import { BrowserRouter } from 'react-router-dom'
import { SessionProvider } from './lib/session'
import { SimulatorLimitsProvider } from './lib/simulator-limits'
import { AppRoutes } from './routes'
import { ToastProvider } from './ui/Toast'

export function App() {
  return (
    // La sesion contiene la divisa y el tema. Los tipos de cambio (RatesProvider) NO
    // estan aqui: viven en routes.tsx, por debajo del gate de sesion, para que GET /rates
    // no se dispare en la pantalla de login, donde nadie los usa. Los limites del
    // simulador (/ajustes) son estado de la sesion de trabajo, como la divisa.
    <SessionProvider>
      <SimulatorLimitsProvider>
        <ToastProvider>
          <BrowserRouter>
            <AppRoutes />
          </BrowserRouter>
        </ToastProvider>
      </SimulatorLimitsProvider>
    </SessionProvider>
  )
}
