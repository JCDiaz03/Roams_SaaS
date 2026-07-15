// Middleware de auth (mock declarado): la costura existe desde el dia 1. Spec: 8.2

import type { FastifyInstance } from 'fastify'

/**
 * LA COSTURA DE AUTH. Hoy no valida nada, y es deliberado (referencia 8.2, regla 3).
 *
 * NO LO BORRES PORQUE PAREZCA CODIGO MUERTO: es lo contrario. Es la diferencia entre
 * "hay que anadir auth" -buscar donde, tocar cada ruta, arriesgarse a olvidar una- y
 * "hay que rellenar esta funcion".
 *
 * Por que un mock y no auth de verdad (referencia 8.2): no se conocen ni los datos ni el
 * sistema de identidad interno de la empresa. Inventar hoy un modelo de usuarios costaria
 * mas que anadirlo cuando se conozca, y casi con certeza seria el modelo equivocado. Por
 * eso aqui no hay una forma de token a medio adivinar.
 *
 * RIESGO ACEPTADO Y DECLARADO (referencia 8.3, 14.3): los endpoints de administracion NO
 * estan protegidos. Cualquiera puede llamarlos directamente. Es aceptable en una
 * herramienta interna con el mock declarado; lo que no vale es CREERSE protegido. Por eso
 * los planes de admin cuelgan de `GET /plans?include_archived=true` y no de un `/admin/*`
 * que solo daria ilusion de seguridad. El README lo declara fuera del modelo de amenazas.
 *
 * Cuando llegue el auth real, aqui dentro va: leer la cabecera, validar el token contra
 * el sistema de la empresa, colgar la identidad de `req` y rechazar con 401 si no cuadra.
 * Ninguna ruta de contrato-api.md cambia.
 */
export function registerAuth(app: FastifyInstance): void {
  app.addHook('onRequest', async () => {
    // Intencionadamente vacio. Ver el bloque de arriba antes de tocar esto.
  })
}
