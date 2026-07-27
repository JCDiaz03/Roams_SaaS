# Sesión 24 — El gate de suministro en rojo: 9 altos a cero

**Objetivo.** El `npm audit --audit-level=high` del CI —el que corre en cada push **y por cron semanal**— salió en rojo con **9 vulnerabilidades altas** sobre un repositorio que nadie había tocado. Dejarlo en verde sin bajarle el listón.
**Herramienta.** Claude Code, sobre el repo.
**Spec de partida.** No hubo spec nueva: esta sesión no añade comportamiento. Hizo de spec la referencia §14.3 (cadena de suministro npm) y la promesa que el README hace en primera persona — «el repositorio se sigue auditando solo, aunque nadie haga push».
**Resultado.** Hecho. **0 vulnerabilidades**, `exit 0`. 375 tests + 4 E2E en verde tras un `npm ci` limpio. Tres avisos distintos, tres tratamientos distintos: uno se parchea, uno obliga a subir un major de herramienta, y uno obliga a migrar una dependencia de producción.

## Prompt de partida

> tengo un auditor de codigo en github de este proyecto y me a aparecido un error: Run npm audit --audit-level=high

Con el informe completo pegado: `brace-expansion`, `fast-uri`, `find-my-way` y `react-router`, y el consejo de npm — «fix available via `npm audit fix --force` · Will install eslint@10.8.0, which is a breaking change».

## Qué generó

Se atacó en tres tandas, de menos a más invasiva, midiendo el contador después de cada una.

- **`npm audit fix` (9 → 7).** `fast-uri` 3.1.3 → 3.1.4 y 4.1.0 → 4.1.1 en sus tres rutas bajo Fastify, `find-my-way` 9.6.0 → 9.7.0, y el `brace-expansion` 5.0.7 → 5.0.8 que cuelga de `@typescript-eslint/typescript-estree`. Sin cambios de major, sin tocar `package.json`.
- **eslint 9.39.5 → 10.8.0 (7 → 2).** La cadena que quedaba era `eslint → minimatch@3.1.5 → brace-expansion@1.1.16`, y el único parche del aviso vive en la 5.0.8. eslint 10 trae `minimatch@10`, que ya la usa. **`eslint.config.js` no se tocó ni una línea**: la config ya era flat desde el día 1 y `typescript-eslint@8.64` declara `eslint: "^8.57 || ^9 || ^10"` en sus peers. De propina, `@eslint/eslintrc` —el puente de compatibilidad con `.eslintrc`— desaparece del árbol, y `minimatch` queda en una única copia deduplicada.
- **`react-router-dom@7.18.1` → `react-router@8.3.0` (2 → 0).** Aquí no había parche que aplicar: 7.18.1 **es** la última de la línea 7 y cae dentro del rango afectado (`7.12.0 - 8.2.0`), y `react-router-dom` no tiene v8 — en la v8 el paquete DOM se pliega dentro de `react-router`. Antes de migrar se comprobó contra el `index.d.ts` de la 8.3.0 que las nueve APIs que usa el frontend (`BrowserRouter`, `Routes`, `Route`, `Link`, `Navigate`, `useNavigate`, `useParams`, `useSearchParams`, `useLocation`) siguen exportadas desde la entrada principal. La migración fue el renombrado del especificador en **16 ficheros**; cero cambios de código.
- **`engines` puesto al día**: `>=22` → `>=22.22.0`, que es el mínimo que pide react-router 8 y ahora es un requisito de **producción**, no de tooling. El README dice el número nuevo y por qué. `.nvmrc` sigue en la 24, que es la del CI.

## Qué se rechazó, y por qué

- **`npm audit fix --force` a ciegas**, que era literalmente lo que sugería el informe. Habría hecho el salto de eslint sin mirar si la config sobrevivía ni qué se llevaba por delante, y **no habría arreglado react-router** — el `--force` no inventa una versión que no existe.
- **Un `overrides` de `brace-expansion` a 5.0.8 en todo el árbol.** Era el atajo evidente para saltarse el major de eslint, y se descartó al abrir el paquete: la v5 exporta `{ expand }` (`exports.expand = expand`), mientras que `minimatch@3` hace `var expand = require('brace-expansion')` y lo llama como función. El override habría instalado sin una queja y roto el linter **en ejecución**. Un aviso que no se puede silenciar sin romper algo es un aviso que hay que arreglar de verdad.
- **Los backports 1.1.16 / 2.1.2 / 3.0.2 de `brace-expansion`** como candidatos a override compatible. Parecían mantenimiento del aviso y no lo eran: se publicaron el 2026-07-08 y el parche real (5.0.8) el 2026-07-23. El rango del GHSA (`<=5.0.7`, uno solo cruzando los cinco majors) los incluye a todos. **Solo la 5.0.8 parchea.**
- **Bajarle el listón al gate** para tragarse react-router — `--omit=dev`, subir a `--audit-level=critical`, o una allowlist de avisos. Y eso que el aviso **no aplica a esta aplicación**: es un bypass de CSRF del **modo RSC**, y aquí hay un SPA de Vite con `BrowserRouter` y cero servidor de React. Pero un gate solo vale lo que vale su umbral: el día que se relaja «solo por este», deja de ser una señal y pasa a ser un adorno. Se migró.

## Qué regla nueva deja

**Un `overrides` que cruza un major no es un parche, es un cambio de API silencioso.** npm lo resuelve mirando el rango de versión y nadie mira la forma del export: instala limpio, el `audit` se pone verde, y el fallo aparece cuando alguien ejecuta el código. Antes de usar un override para saltarse un salto de major, se comprueba **cómo exporta** el paquete nuevo y **cómo lo consume** el que lo va a recibir.

Y la de esta sesión entera, que es el corolario de la anterior: **el umbral del gate se defiende dejando el árbol limpio, no ajustando el umbral.** Aunque el aviso concreto no aplique — y este no aplicaba.

## Verificación

`npm ci` desde cero (lo que corre el CI, no `npm install`) → `npm run lint` → `npm run typecheck` → `npm test` (**61 + 280 + 34 = 375**, verde) → `npm audit --audit-level=high` → **`found 0 vulnerabilities`, `exit=0`**. Y el smoke E2E, porque la sesión toca pantalla: **4/4**, incluida la auditoría de accesibilidad de `vistas.spec.ts`.
