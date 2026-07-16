// Smoke de admin: versionar un plan NO altera lo guardado ni la tarifa de los clientes. ADR 0010
//
// Es la verificacion manual de la Fase 2 (roadmap 4), convertida en repetible: el test
// de versionado de la suite de integracion, recorrido esta vez por la UI real.

import { expect, test } from '@playwright/test'
import { abrirFicha, auditarAccesibilidad, entrar, inesperados, vigilarConsola } from './helpers'

test('ADMIN versiona el Plan Ágora y Nébula conserva su tarifa y su presupuesto', async ({ page }) => {
  const consola = vigilarConsola(page)

  await entrar(page, 'ADMIN')

  // --- Primero, un presupuesto guardado que el versionado NO debe tocar ----------------
  await abrirFicha(page, 'nébula', 'Nébula Cloud S.L.')
  await page.getByRole('button', { name: 'Nueva simulación' }).click()
  await page.getByLabel('Usuarios activos, valor exacto').fill('15')

  // El caso literal del enunciado: 10x10 + 5x8 = 140 EUR + 21 % = 169,40 EUR.
  await expect(page.getByText(/169,40/).first()).toBeVisible()
  await page.getByRole('button', { name: 'Guardar simulación' }).click()
  await expect(page.getByText(/Guardada ·/)).toBeVisible()

  // --- Administracion: editar = version nueva ------------------------------------------
  await page.getByRole('button', { name: /Menú de ADMIN/ }).click()
  await page.getByRole('menuitem', { name: 'Administración' }).click()
  await expect(page.getByRole('heading', { name: 'Planes de precios' })).toBeVisible()
  await auditarAccesibilidad(page, 'admin-listado')

  // El primero de los activos es Ágora (orden alfabetico con locale es).
  await page.getByRole('button', { name: 'Editar' }).first().click()
  await expect(page.getByText('Los clientes actuales mantendrán su tarifa')).toBeVisible()
  await auditarAccesibilidad(page, 'admin-plantilla')

  // Sube el precio del primer tramo: 10 -> 11 EUR.
  await page.getByLabel('Precio por unidad, tramo 1').fill('11')
  await page.getByRole('button', { name: 'Guardar como versión nueva' }).click()

  // Version nueva activa; la v2 se une a la v1 en los archivados. El chip se busca
  // DENTRO de main y con texto exacto: el toast («...actualizado a la v3») tambien
  // contiene "v3" y vive fuera de main durante ~2,6 s — sin el ancla, la busqueda por
  // subcadena resuelve a dos elementos mientras el toast no se va.
  await expect(page.getByText('«Plan Ágora» actualizado a la v3')).toBeVisible()
  await expect(page.getByRole('main').getByText('v3', { exact: true })).toBeVisible()
  await expect(page.getByText('2 planes archivados')).toBeVisible()

  // --- La comprobacion que importa: nada de lo de Nébula se ha movido -------------------
  // La marca de la topbar vuelve al buscador (el listado de admin no tiene migas).
  await page.getByRole('button', { name: /SaaS/ }).click()
  await abrirFicha(page, 'nébula', 'Nébula Cloud S.L.')

  // Su plan (la v2) esta ahora archivado: aparece el aviso de tarifa contratada...
  await expect(page.getByText('Mantiene su tarifa contratada')).toBeVisible()
  // ...y el presupuesto guardado sigue diciendo LO MISMO: snapshot + versionado (5.5, 11.2).
  await expect(page.getByText('1 presupuesto')).toBeVisible()
  await expect(page.getByText(/169,40/).first()).toBeVisible()

  expect(inesperados(consola)).toEqual([])
})
