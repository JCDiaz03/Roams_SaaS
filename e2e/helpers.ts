// Utilidades de los smoke: entrar, abrir ficha, vigilar consola, auditar accesibilidad. ADR 0010

import AxeBuilder from '@axe-core/playwright'
import { expect, type Page } from '@playwright/test'

export async function entrar(page: Page, usuario: string): Promise<void> {
  await page.goto('/')
  await page.getByLabel('Usuario').fill(usuario)
  await page.getByLabel('Contraseña').fill('1111')
  await page.getByRole('button', { name: 'Entrar' }).click()

  // El saludo del dashboard es la señal de que la sesion abrio y el enrutado cambio.
  await expect(page.getByRole('heading', { name: `Hola, ${usuario}` })).toBeVisible()
}

/** Busca en el dashboard y abre la ficha. El input del buscador GRANDE, no el de la topbar. */
export async function abrirFicha(page: Page, termino: string, empresa: string): Promise<void> {
  await page.getByRole('main').getByLabel('Buscar cliente').fill(termino)
  await page.getByRole('button', { name: `Ver ficha de ${empresa}` }).click()
  await expect(page.getByRole('heading', { name: empresa })).toBeVisible()
}

/**
 * Recoge los errores de consola y de pagina. "Cero errores de consola" fue el criterio
 * de la verificacion manual de Fase 1 (roadmap 3.3); esto lo convierte en repetible.
 */
export function vigilarConsola(page: Page): string[] {
  const errores: string[] = []

  page.on('console', (msg) => {
    if (msg.type() === 'error') errores.push(`${msg.text()} [${msg.location().url}]`)
  })
  page.on('pageerror', (err) => errores.push(String(err)))

  return errores
}

/**
 * El unico error esperado: el 401 de GET /auth/session en la pantalla de login. Es el
 * CONTRATO (spec 07, 4: "no hay nadie" se responde con 401) y Chromium lo pinta en la
 * consola igualmente. Todo lo demas es un fallo real.
 */
export function inesperados(errores: string[]): string[] {
  return errores.filter((e) => !(e.includes('401') && e.includes('/api/auth/session')))
}

/** Sin violaciones GRAVES de axe. Las menores (moderate/minor) no bloquean el smoke. */
export async function auditarAccesibilidad(page: Page, pantalla: string): Promise<void> {
  const resultado = await new AxeBuilder({ page }).analyze()
  const graves = resultado.violations.filter((v) => v.impact === 'critical' || v.impact === 'serious')

  // El selector de cada nodo va en el mensaje: un fallo de axe que no dice DONDE es un
  // fallo que se ignora.
  expect(
    graves.map(
      (v) =>
        `${pantalla}: ${v.id} — ${v.help} [${v.nodes.map((n) => n.target.join(' ')).join(' | ')}]`,
    ),
  ).toEqual([])
}
