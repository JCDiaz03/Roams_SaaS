// GET /rates: proxy de divisas. Spec: 9, 12

import type { FastifyInstance } from 'fastify'
import { getRatesSchema } from './rates.schemas'
import type { RatesService } from './rates.service'

export function ratesRoutes({ ratesService }: { ratesService: RatesService }) {
  return async (app: FastifyInstance): Promise<void> => {
    // NO acepta ningun parametro, y es a proposito: es lo que ancla el "sin SSRF" del
    // 14.1. Ninguna entrada del usuario puede llegar a componer la URL saliente, porque
    // no hay ninguna entrada.
    app.get('/rates', { schema: getRatesSchema }, async (req) => ratesService.get(req.log))
  }
}
