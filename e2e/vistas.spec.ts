// Smoke de las vistas de la tanda del catalogo: ajustes, catalogo del dashboard y
// detalle de plan, con axe en cada una. ADR 0010 · specs 08 y 10
//
// Los otros dos smokes cubren los FLUJOS (comercial y admin); este cubre las pantallas
// que quedaban fuera de esos caminos, para que la auditoria de accesibilidad las
// recorra todas.

import { expect, test } from '@playwright/test'
import { auditarAccesibilidad, entrar, inesperados, vigilarConsola } from './helpers'

test('ajustes, catalogo de planes y detalle pasan la auditoria de accesibilidad', async ({ page }) => {
  const consola = vigilarConsola(page)

  await entrar(page, 'Auditora')

  // --- Ajustes (ventana 9): perfil de demo + limites del simulador --------------------
  await page.getByRole('button', { name: /Menú de Auditora/ }).click()
  await page.getByRole('button', { name: 'Ajustes' }).click()
  await expect(page.getByRole('heading', { name: 'Ajustes' })).toBeVisible()
  await expect(page.getByText('Límites del simulador')).toBeVisible()
  await auditarAccesibilidad(page, 'ajustes')

  // El clamp por abajo: 10 usuarios no es un limite valido, se guarda el minimo (70).
  await page.getByLabel('Usuarios').fill('10')
  await page.getByRole('button', { name: 'Guardar límites' }).click()
  await expect(page.getByLabel('Usuarios')).toHaveValue('70')

  // --- El catalogo del dashboard (spec 08, 5), colapsado por defecto -------------------
  await page.getByRole('button', { name: /SaaS/ }).click()
  const catalogo = page.getByText(/Planes activos \(7\)/)
  await expect(catalogo).toBeVisible()
  await catalogo.click()
  await expect(page.getByRole('link', { name: /Plan Almacenamiento/ })).toBeVisible()
  await auditarAccesibilidad(page, 'dashboard-catalogo')

  // --- El detalle de plan (ventana 8), solo lectura -----------------------------------
  await page.getByRole('link', { name: /Plan Almacenamiento/ }).click()
  await expect(page.getByRole('heading', { name: 'Plan Almacenamiento' })).toBeVisible()
  // DOS tablas de tramos (almacenamiento y llamadas API), cada una con su ultimo tramo
  // abierto en lenguaje llano: el conteo exacto es la asercion, no un .first() que
  // pasaria igual con una tabla de menos.
  await expect(page.getByRole('cell', { name: 'En adelante' })).toHaveCount(2)
  await auditarAccesibilidad(page, 'detalle-plan')

  expect(inesperados(consola)).toEqual([])
})
