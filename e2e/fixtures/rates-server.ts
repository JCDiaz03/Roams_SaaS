// Fixture de open.er-api.com para los E2E: tipos fijos, cero red externa. ADR 0010
//
// El backend le apunta via RATES_URL. Sin esto, el smoke de CI dependeria de que un
// tercero este vivo, y un E2E que falla por la red de otro es un E2E que se acaba
// ignorando. La forma del payload es la real (rates + time_*_unix), porque lo que se
// ejercita es el parser de verdad (OpenErApiProvider), no un doble.

import { createServer } from 'node:http'

// El puerto lo dicta playwright.config.ts (unica fuente); el default solo sirve para
// arrancar el fixture a mano.
const PORT = Number(process.env['RATES_PORT'] ?? 9099)
const ahora = Math.floor(Date.now() / 1000)

const payload = {
  result: 'success',
  base_code: 'EUR',
  time_last_update_unix: ahora,
  time_next_update_unix: ahora + 24 * 60 * 60,
  rates: { EUR: 1, USD: 1.08, GBP: 0.85, CHF: 0.94, JPY: 168.4 },
}

createServer((_req, res) => {
  res.setHeader('Content-Type', 'application/json')
  res.end(JSON.stringify(payload))
}).listen(PORT, '127.0.0.1', () => {
  console.log(`Fixture de tipos en http://127.0.0.1:${PORT}/`)
})
