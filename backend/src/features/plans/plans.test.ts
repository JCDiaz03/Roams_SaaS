// Validacion de plantilla + versionado no altera lo guardado. Spec: 15
//
// Estado: (parcial). La validacion de plantilla y el versionado son Fase 2 (roadmap 4).
// Aqui solo esta el GET, que es lo que existe.

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { crearHarness, type Harness } from '../../test-harness'

let h: Harness
beforeEach(() => {
  h = crearHarness()
})
afterEach(async () => {
  await h.close()
})

const get = (qs = '') => h.app.inject({ method: 'GET', url: `/api/plans${qs}` })

describe('GET /plans', () => {
  it('por defecto solo los ACTIVOS: el alta no debe ofrecer un plan archivado', async () => {
    const { plans } = (await get()).json() as { plans: { name: string; version: number; active: boolean }[] }

    expect(plans.every((p) => p.active)).toBe(true)
    expect(plans.map((p) => `${p.name} v${p.version}`)).toEqual([
      'Plan Ágora v2',
      'Plan Bitácora v1',
      'Plan Cúspide v1',
    ])
  })

  it('?include_archived=true los trae todos, para el panel de admin', async () => {
    const { plans } = (await get('?include_archived=true')).json() as { plans: { active: boolean }[] }

    expect(plans).toHaveLength(4)
    expect(plans.filter((p) => !p.active)).toHaveLength(1)
  })

  it('trae los tramos de cada plan, y el multi-metrica los suyos', async () => {
    const { plans } = (await get()).json() as {
      plans: { name: string; tiers: { metric: string }[] }[]
    }

    const cuspide = plans.find((p) => p.name === 'Plan Cúspide')
    expect(cuspide?.tiers).toHaveLength(6)
    expect(new Set(cuspide?.tiers.map((t) => t.metric))).toEqual(
      new Set(['users', 'storage_gb', 'api_calls']),
    )
  })

  it('un parametro que no existe -> 400', async () => {
    expect((await get('?futuro=1')).statusCode).toBe(400)
  })
})
