# SaaS-O-Matic

Herramienta interna para el equipo comercial: registrar clientes corporativos, simular su consumo (usuarios, almacenamiento, llamadas API) y obtener presupuestos mensuales de suscripción, visualizables en varias divisas.

> **Estado: completo.** Motor de tarificación, validación fiscal (ES y PT), API, autenticación con sesión de servidor, las pantallas y la administración de planes — más la **tanda del catálogo de planes** ([roadmap v2](./ai-workspace/roams-roadmap_v2.md)): detalle de plan, valores base del cliente, simulación parametrizada, cotizar con otro plan y sugerencias. **375 tests + 4 E2E**, verificado de punta a punta contra la aplicación real y con Lighthouse en verde en las 8 vistas (accesibilidad 100). Lo diseñado y deliberadamente no hecho está en [`recortes-conscientes.md`](./ai-workspace/03-proceso/recortes-conscientes.md).

## Arranque en local

```bash
git clone https://github.com/JCDiaz03/Roams_SaaS.git
cd Roams_SaaS
npm install
npm run dev
```

Y ya está: **http://localhost:5173**. Entra con cualquier usuario y la contraseña `1111`, o con el usuario `ADMIN` para ver la entrada de administración.

No hay ningún paso manual de base de datos: el backend crea el esquema SQLite y lo puebla en el primer arranque si el fichero `.db` no existe. Requiere **Node ≥ 22** (`engines`); `.nvmrc` fija la **24**, que es la que usa el CI. No hace falta Docker ni herramientas de compilación.

| Script (raíz) | Qué hace |
|---|---|
| `npm run dev` | Levanta backend (`:3000`) y frontend (`:5173`) a la vez |
| `npm test` | Los 375 tests de los tres workspaces |
| `npm run seed` | Repuebla la base de datos (solo sobre una base vacía) |
| `npm run test:e2e` | El smoke E2E (Playwright): arranca backend, build con CSP estricta y navegador, y recorre la app como un evaluador. Primera vez: `npx playwright install chromium` |
| `npm run lint` · `npm run typecheck` | Lo mismo que ejecuta el CI |
| `npm run build -w frontend` + `npm run preview -w frontend` | Sirve el build en `:4173` **con la CSP estricta**. Es lo más parecido a producción que hay aquí (ver abajo) |

### Qué probar en dos minutos

1. **El caso del enunciado**: entra, busca `Nébula`, abre su ficha y pulsa *Nueva simulación*. Con **15 usuarios** verás **140 € + 21 % = 169,40 €**, con su desglose `10 × 10 € + 5 × 8 €`.
2. **Precio inmutable**: abre `Fjord Systems AS`. Está en una versión **archivada** del Plan MAX y su ficha lo dice sin jerga («Mantiene su tarifa contratada»). Simula 15 usuarios: cotiza a **su** tarifa (`15 × 0,20 €`), sin la cuota de entrada que la versión actual añadió.
3. **Divisa**: cambia el selector de la topbar a USD. El total se convierte, pero va **marcado como referencia** y con el importe de facturación real al lado. El número del negocio no cambia.
4. **Validación fiscal**: en *Nuevo cliente*, prueba `B12345675` (control incorrecto) y luego `B12345674`. El error sale junto al campo.
5. **Un precio publicado es inmutable**: entra como `ADMIN`, ve a *Administración*, edita el Plan Text y cámbiale un precio. Se crea una **versión nueva** y la anterior se archiva; las simulaciones que ya habías guardado siguen diciendo lo mismo, y Nébula sigue con su tarifa.
6. **Entrégalo en papel**: tras guardar una simulación, *Imprimir presupuesto* (o Ctrl+P) abre el diálogo del navegador con una hoja limpia — desglose, total en la divisa de facturación, el plan con el que se cotizó y quién lo emitió. También desde cada card del historial con *Imprimir*: el papel declara a quien **guardó** la simulación, no a quien lo abre.
7. **El catálogo y el what-if**: en la ficha de Nébula, pulsa el chip del plan para ver su detalle con los tramos, y *Nueva simulación parametrizada* — arranca con sus valores base (15 usuarios, «base: 15» como referencia). En el simulador, cambia el plan en la barra superior: el número se recalcula al instante, la barra avisa de que no es el contratado, y si otro plan sale más barato con esos datos aparece como sugerencia. Al guardar, la card del historial dice con qué plan se cotizó.
8. **Ordena el historial y el catálogo**: en una card guardada, *Archivar* la saca de la vista (queda en «archivadas», recuperable — los números sellados no se tocan). En *Ajustes* (menú de usuario), baja el tope de los deslizadores si trabajas con planes pequeños. Y como `ADMIN`, borra un plan recién creado que nadie use: desaparece de verdad; uno con clientes solo se archiva (→ ADR 0013).

## Estructura

```
backend/           API REST (Fastify + better-sqlite3)
frontend/          Dashboard comercial (React + Vite)
packages/pricing/  Motor de tramos, redondeo y Currency — compartido por ambos
ai-workspace/      El proceso: specs, arquitectura y desarrollo con IA
```

## El grueso del trabajo está en `/ai-workspace`

**[`/ai-workspace`](./ai-workspace/README.md)** contiene lo que se decidió antes de escribir código, las directrices bajo las que se generó, y las decisiones con sus alternativas descartadas.

- Qué se construye y por qué → [`01-specs/idea-referencia.md`](./ai-workspace/01-specs/idea-referencia.md) — el documento madre
- Estado y fases → [`roams-roadmap.md`](./ai-workspace/roams-roadmap.md)
- Las reglas dadas a la IA → [`02-arquitectura/directrices-ia.md`](./ai-workspace/02-arquitectura/directrices-ia.md)
- Las decisiones y lo descartado → [`02-arquitectura/decisiones.md`](./ai-workspace/02-arquitectura/decisiones.md)
- Lo diseñado y deliberadamente no hecho → [`03-proceso/recortes-conscientes.md`](./ai-workspace/03-proceso/recortes-conscientes.md)

## Decisiones que conviene conocer antes de leer el código

**Los tipos de cambio se consumen a través del backend**, no directamente desde el navegador. El enunciado dice que «la interfaz debe conectar con una API pública», y se cumple: la interfaz consume tipos de una API pública y el backend es una capa intermedia estándar (*cache-aside*). **La desviación de la letra es deliberada y el motivo es de negocio, no técnico**: con caché en el navegador, dos comerciales pueden cotizar al mismo cliente con tipos distintos el mismo día — uno abrió la pestaña ayer, el otro hoy. La caché de servidor garantiza que todo el equipo ve el mismo número a la misma hora. → [ADR 0004](./ai-workspace/02-arquitectura/decisiones.md).

**La autenticación es real; las credenciales son de demostración, y se declara.** El login abre una **sesión de servidor** (cookie `HttpOnly` + `SameSite=Strict`, revocable al instante), toda la API exige sesión y los endpoints de administración exigen rol admin **en el backend** (401/403 de verdad, no solo pantallas ocultas). Lo que sigue siendo de demostración es la verificación de credenciales (`1111`, pública): vive detrás del puerto `IdentityProvider`, porque no se conoce el sistema de identidad de la empresa y conectarlo será **una implementación más de ese puerto**, sin tocar sesión, rutas ni frontend. Dos tests vigilan que el literal `"ADMIN"` viva en un único fichero del backend y en ninguno del frontend. Las sesiones viven en memoria: reiniciar el servidor es volver a entrar. → [ADR 0007 y 0009](./ai-workspace/02-arquitectura/decisiones.md).

**El preview del simulador es híbrido.** Se calcula en local, a 0 ms y sin red, con **la misma función pura** que ejecuta el servidor (`@saas/pricing`, importado por los dos): no existen dos implementaciones que puedan divergir. Al guardar, el backend recalcula desde cero y **su número manda**. → [ADR 0003](./ai-workspace/02-arquitectura/decisiones.md).

**El dinero son enteros en unidades menores, nunca `float`**, siempre con su código ISO al lado, y se redondea una sola vez con half-up. `Math.round` **no** es half-up, así que el redondeo vive en una única función testeada. → [ADR 0005](./ai-workspace/02-arquitectura/decisiones.md).

**Un precio publicado es inmutable**: editar un plan crea una versión nueva y archiva la anterior; borrar archiva. Además, cada simulación guarda una foto de los tramos y el impuesto aplicados, así que un presupuesto ya enviado sigue explicando su número aunque el plan cambie. → [ADR 0006](./ai-workspace/02-arquitectura/decisiones.md).

**Sin Docker**, y es una decisión: SQLite es un fichero, no un servicio. Exigir Docker para evaluar una app de Node puro añadiría fricción en vez de quitarla. → [ADR 0008](./ai-workspace/02-arquitectura/decisiones.md).

**La CSP estricta es la del build, no la de `npm run dev`.** El modo dev de Vite inyecta el preámbulo de React Refresh como script en línea y el CSS por JS, así que exige `'unsafe-inline'` en `script-src` y `style-src`: **ahí la CSP no defiende de un XSS y no se pretende que lo haga** — se queda porque las demás directivas hacen de alarma si alguien añade un host externo. La de verdad se comprueba con `npm run preview`: el build corre bajo `style-src 'self'` con cero violaciones. Y es barata porque el resto del diseño la hizo barata — el proxy de divisas hace que baste `connect-src 'self'`, y auto-alojar la fuente hace que baste `font-src 'self'`.
