// E2E contra la app REAL: backend con base en memoria + build servido con la CSP estricta. ADR 0010

import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',

  // EN SERIE, a proposito: los dos specs comparten un backend con una base sembrada, y
  // el de admin MUTA planes. El paralelismo aqui compraria segundos vendiendo carreras.
  workers: 1,
  fullyParallel: false,

  // Sin reintentos: un smoke que necesita reintentar esta contando un problema real.
  retries: 0,

  use: {
    // El PREVIEW, no el dev server: es lo mas parecido a produccion que hay aqui, y
    // lleva la CSP estricta. Una violacion de CSP revienta el smoke, no un despliegue.
    // `localhost` y no 127.0.0.1: vite preview escucha en localhost, que en Windows
    // puede resolver a ::1 — el probe a la IP v4 se quedaria esperando para siempre.
    baseURL: 'http://localhost:4173',
    locale: 'es-ES',
    trace: 'retain-on-failure',
  },

  webServer: [
    {
      // Tipos de cambio de mentira: el smoke no depende de que un tercero este vivo.
      command: 'npx tsx e2e/fixtures/rates-server.ts',
      url: 'http://127.0.0.1:9099/',
      reuseExistingServer: false,
    },
    {
      // Base EN MEMORIA: cada ejecucion arranca con el seed limpio, como un evaluador.
      command: 'npx tsx backend/src/index.ts',
      // /api/countries responde 401 sin sesion, y eso basta como señal de "vivo":
      // no existe ningun endpoint anonimo con 200 (spec 07, 5.1).
      url: 'http://127.0.0.1:3000/api/countries',
      env: { DB_PATH: ':memory:', RATES_URL: 'http://127.0.0.1:9099/' },
      reuseExistingServer: false,
      timeout: 60_000,
    },
    {
      command: 'npm run build --workspace frontend && npm run preview --workspace frontend',
      url: 'http://localhost:4173',
      reuseExistingServer: false,
      timeout: 120_000,
    },
  ],
})
