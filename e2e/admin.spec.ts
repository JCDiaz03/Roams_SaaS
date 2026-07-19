// Smoke de admin: versionar un plan NO altera lo guardado ni la tarifa de los clientes. ADR 0010
//
// Es la verificacion manual de la Fase 2 (roadmap 4), convertida en repetible: el test
// de versionado de la suite de integracion, recorrido esta vez por la UI real.

import { expect, test } from '@playwright/test'
import { abrirFicha, auditarAccesibilidad, entrar, inesperados, vigilarConsola } from './helpers'

test('ADMIN versiona el Plan Text y Nébula conserva su tarifa y su presupuesto', async ({ page }) => {
  const consola = vigilarConsola(page)

  await entrar(page, 'ADMIN')

  // --- Primero, un presupuesto guardado que el versionado NO debe tocar ----------------
  // Nebula viene sembrada con base_users: 15 -> la PARAMETRIZADA arranca con el caso
  // literal del enunciado ya puesto (spec 09, 3.4), sin teclearlo.
  await abrirFicha(page, 'nébula', 'Nébula Cloud S.L.')
  await page.getByRole('button', { name: 'Nueva simulación parametrizada' }).click()
  await expect(page.getByLabel('Usuarios activos, valor exacto')).toHaveValue('15')
  await expect(page.getByText('base: 15')).toBeVisible()

  // El caso literal del enunciado: 10x10 + 5x8 = 140 EUR + 21 % = 169,40 EUR.
  await expect(page.getByText(/169,40/).first()).toBeVisible()
  await page.getByRole('button', { name: 'Guardar simulación' }).click()
  await expect(page.getByText(/Guardada ·/)).toBeVisible()

  // --- Administracion: editar = version nueva ------------------------------------------
  await page.getByRole('button', { name: /Menú de ADMIN/ }).click()
  await page.getByRole('button', { name: 'Administración' }).click()
  await expect(page.getByRole('heading', { name: 'Planes de precios' })).toBeVisible()
  await auditarAccesibilidad(page, 'admin-listado')

  // Por nombre accesible, no por posicion: un plan nuevo en el seed que ordene antes
  // que Text haria que un .first() editara (mutara) el plan equivocado.
  await page.getByRole('button', { name: 'Editar Plan Text' }).click()
  // La decision D1 clavada en URL: el editor vive en /editar; la URL corta es el detalle.
  await expect(page).toHaveURL(/\/planes\/\d+\/editar$/)
  await expect(page.getByText('Los clientes actuales mantendrán su tarifa')).toBeVisible()
  await auditarAccesibilidad(page, 'admin-plantilla')

  // Sube el precio del primer tramo: 10 -> 11 EUR.
  await page.getByLabel('Precio por unidad, tramo 1').fill('11')
  await page.getByRole('button', { name: 'Guardar como versión nueva' }).click()

  // Version nueva activa; la v1 de Text se une a la de MAX en los archivados. El chip
  // "v2" ya no es unico en el listado (Demo y MAX tambien van por v2): se cuenta — tres
  // chips v2 exactos dentro de main = el listado se actualizo con la Text v2 nueva.
  await expect(page.getByText('«Plan Text» actualizado a la v2')).toBeVisible()
  await expect(page.getByRole('main').getByText('v2', { exact: true })).toHaveCount(3)
  await expect(page.getByText('2 planes archivados')).toBeVisible()

  // --- La comprobacion que importa: nada de lo de Nébula se ha movido -------------------
  // La marca de la topbar vuelve al buscador (el listado de admin no tiene migas).
  await page.getByRole('button', { name: /SaaS/ }).click()
  await abrirFicha(page, 'nébula', 'Nébula Cloud S.L.')

  // Su plan (la v1) esta ahora archivado: aparece el aviso de tarifa contratada...
  await expect(page.getByText('Mantiene su tarifa contratada')).toBeVisible()
  // ...y el presupuesto guardado sigue diciendo LO MISMO: snapshot + versionado (5.5, 11.2).
  await expect(page.getByText('1 presupuesto')).toBeVisible()
  await expect(page.getByText(/169,40/).first()).toBeVisible()
  // Y sigue declarando SU version (v1), no la v2 recien creada: el nombre tambien sale
  // del snapshot (spec 09, 5.1).
  await expect(page.getByText('Plan Text · v1')).toBeVisible()

  expect(inesperados(consola)).toEqual([])
})
