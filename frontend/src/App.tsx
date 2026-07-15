// Layout + topbar + rutas. Diseno: 01-specs/diseño-frontend.md 3

import { BrowserRouter } from 'react-router-dom'
import { RatesProvider } from './lib/rates-context'
import { SessionProvider } from './lib/session'
import { AppRoutes } from './routes'
import { ToastProvider } from './ui/Toast'

export function App() {
  return (
    // El orden importa: la sesion contiene la divisa y el tema, y los tipos de cambio se
    // piden una sola vez para toda la app (topbar y simulador comparten estado).
    <SessionProvider>
      <RatesProvider>
        <ToastProvider>
          <BrowserRouter>
            <AppRoutes />
          </BrowserRouter>
        </ToastProvider>
      </RatesProvider>
    </SessionProvider>
  )
}
