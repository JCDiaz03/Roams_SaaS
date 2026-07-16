// Smoke del flujo comercial: login -> buscar -> ficha -> simular -> guardar -> divisa -> historial. ADR 0010
//
// Es la verificacion manual de la Fase 1 (roadmap 3.3), convertida en repetible por
// push: el cliente con PLAN ARCHIVADO (Fjord), que es el caso que demuestra el
// versionado en pantalla. Corre contra el build con la CSP estricta: una violacion de
// CSP rompe estilos o fetch y revienta aqui, no en un despliegue.

import { expect, test } from '@playwright/test'
import { abrirFicha, auditarAccesibilidad, entrar, inesperados, vigilarConsola } from './helpers'

test('el comercial cotiza a Fjord con su tarifa archivada y la guarda', async ({ page }) => {
  const consola = vigilarConsola(page)

  // --- Login (sesion REAL: POST /auth/login pone la cookie) ---------------------------
  await page.goto('/')
  await auditarAccesibilidad(page, 'login')
  await entrar(page, 'María')
  await auditarAccesibilidad(page, 'dashboard')

  // --- Buscar y abrir la ficha ---------------------------------------------------------
  await abrirFicha(page, 'fjord', 'Fjord Systems AS')

  // El aviso del plan archivado, en lenguaje de comercial: nada de jerga de versionado.
  await expect(page.getByText('Mantiene su tarifa contratada')).toBeVisible()
  await auditarAccesibilidad(page, 'ficha')

  // --- Simular con SU tarifa (la archivada: 10x12 + 5x7 = 155 EUR + 19 % DE) ----------
  await page.getByRole('button', { name: 'Nueva simulación' }).click()
  await page.getByLabel('Usuarios activos, valor exacto').fill('15')

  // El preview es local (quote() compartido) y debe dar el numero del gate: 184,45 EUR.
  await expect(page.getByText(/184,45/).first()).toBeVisible()
  await auditarAccesibilidad(page, 'simulador')

  await page.getByRole('button', { name: 'Guardar simulación' }).click()
  await expect(page.getByText(/Guardada ·/)).toBeVisible()

  // --- El presupuesto imprimible: la hoja solo existe en @media print ------------------
  // Emulando print se comprueba lo que Ctrl+P imprimiria de verdad: la hoja con el
  // numero PERSISTIDO y quien lo emite, y la app de pantalla invisible.
  await page.emulateMedia({ media: 'print' })
  await expect(page.getByRole('heading', { name: 'Presupuesto mensual' })).toBeVisible()
  await expect(page.getByText(/Emitido por/)).toContainText('María')
  await expect(page.locator('.hoja-impresion').getByText(/184,45/).first()).toBeVisible()
  await expect(page.getByLabel('Divisa de visualización')).not.toBeVisible()
  await page.emulateMedia({ media: 'screen' })

  // --- Divisa de visualizacion: SOLO vista, siempre etiquetada como referencia --------
  await page.getByLabel('Divisa de visualización').selectOption('USD')
  await expect(page.getByText('≈ referencia · no es la divisa de facturación')).toBeVisible()
  // El importe de FACTURACION sigue visible y no se ha movido: invariante 4.
  await expect(page.getByText(/Se factura: 184,45/)).toBeVisible()

  // --- El historial, desde la ficha ----------------------------------------------------
  await page.getByRole('navigation', { name: 'Migas de pan' }).getByRole('link', { name: 'Fjord Systems AS' }).click()
  await expect(page.getByText('1 presupuesto')).toBeVisible()
  await expect(page.getByText(/184,45/).first()).toBeVisible()

  // --- Cero errores de consola (salvo el 401 esperado del contrato) --------------------
  expect(inesperados(consola)).toEqual([])
})

test('cerrar sesion vuelve al login y la pantalla queda limpia', async ({ page }) => {
  await entrar(page, 'María')

  await page.getByRole('button', { name: /Menú de María/ }).click()
  await page.getByRole('button', { name: 'Cerrar sesión' }).click()

  await expect(page.getByRole('button', { name: 'Entrar' })).toBeVisible()
})
