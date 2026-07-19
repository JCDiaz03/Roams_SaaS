# Sesión 11 — Smoke E2E con Playwright (Fase 3, §5.2)

**Objetivo.** Convertir en repetible la verificación que siempre fue manual: los dos recorridos de las Fases 1 y 2, conducidos por un navegador de verdad en cada push.
**Decisión de partida.** ADR 0010 — smoke (no E2E exhaustivo), contra el build con la CSP estricta y el backend real con base en memoria.
**Resultado.** Hecho. 3 tests E2E (~18 s en local), job nuevo en CI, y **dos bugs reales cazados antes de que la suite estuviera en verde**.
**Regla 2**: registrada al cerrar la sesión.

## Prompt de partida

> haz el commit y sigue con el 5.2

## Qué generó

`playwright.config.ts` (tres `webServer`: fixture de tipos, backend con `DB_PATH=:memory:`, build+preview), `e2e/` (helpers + smoke comercial + smoke admin), el fixture `rates-server.ts`, el override `RATES_URL` en config del backend, y el job `e2e` del CI.

## Los dos bugs que cazó

1. **El cinturón anti-CSRF rechazaba a la propia aplicación.** La comparación `Origin` vs `Host` era correcta en `app.inject` (219 tests en verde) y falsa en el mundo real: el proxy de Vite reescribe el `Host` (`changeOrigin`), así que **toda mutación desde el navegador devolvía 403**. El primer arranque del smoke lo enseñó en el login. Se corrigió a `Sec-Fetch-Site`, que el navegador calcula contra el origen que el usuario ve y sobrevive a cualquier proxy. La lección incómoda y valiosa: una suite de integración entera puede estar en verde con la app rota, si el defecto vive en una frontera que esa suite no atraviesa.
2. **Un contraste real por debajo de AA.** El test de tokens comprueba pares declarados; no puede ver una opacidad compuesta. Las tarjetas atenuadas del simulador (`opacity: 0.72` sobre `--color-text-2`) caían del umbral, y axe lo señaló con el selector exacto. El arreglo respeta la intención (el conjunto sigue leyéndose apagado) subiendo solo el hint a la tinta principal.

## Qué se aceptó

- **Workers = 1 y cero retries**: los specs comparten una base sembrada y el de admin muta planes; un smoke que necesita reintentar está contando un problema real.
- **Fixture local de tipos** en vez de la API pública: un E2E que falla por la red de un tercero es un E2E que se acaba ignorando. `RATES_URL` es variable de entorno del servidor —configuración, no parámetro de petición—, así que el "sin SSRF" del §14.1 queda intacto.
- **El probe de arranque del backend acepta un 401**: desde la spec 07 no existe ningún endpoint anónimo con 200, y el 401 de `/api/countries` ya demuestra que el proceso está vivo.
- **Filtrar exactamente un error de consola esperado**: el 401 de `GET /auth/session` en la pantalla de login es contrato (spec 07), y Chromium lo pinta igualmente. Todo lo demás hace fallar el test.

## Qué se rechazó

- **E2E exhaustivo**: duplicaría la suite de integración por el canal más caro. El smoke cubre lo que solo el sistema ensamblado puede romper.
- **Tests de componente (jsdom)** como sustituto: no atraviesan proxy, CSP ni cookies — justo donde vivían los dos bugs de arriba.
- **`test.describe.configure({ retries })` para "estabilizar"**: la estabilidad se compró con serialización y fixture, no escondiendo flakiness.

## Los dos detalles que costaron una iteración cada uno

- `vite preview` escucha en `localhost`, que en Windows puede resolver a `::1`: el probe a `http://127.0.0.1:4173` esperaba para siempre contra un servidor sano. El `webServer` apunta ahora a `localhost`, con el porqué comentado en la config.
- `getByText('v3')` era flaky de manual: el toast «actualizado a la v3» también contiene la subcadena y vive ~2,6 s fuera de `main` — dos coincidencias en modo estricto según el instante. El ancla (`main` + texto exacto) lo hace determinista; se comprobó con tres ejecuciones seguidas en verde. Un smoke con retries habría escondido esto para siempre.
