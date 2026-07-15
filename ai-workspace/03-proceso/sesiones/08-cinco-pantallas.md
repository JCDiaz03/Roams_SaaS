# Sesión 08 — Las cinco pantallas

**Objetivo.** Login, dashboard, detalle, alta y simulador, sobre el sistema de diseño de la sesión 06 y consumiendo la API de la 07.
**Spec de partida.** `01-specs/diseño-frontend.md` y `01-specs/features/05-auth-mock.md`.
**Resultado.** Hecho. Commit `e4fe7dd`.

## Prompt de partida

> ahora las 5 pantallas §3.3

Y, a mitad de la sesión, mientras se trabajaba:

> luego actualiza los .md

## Qué generó

La capa de datos (`api-client`, `session`, `rates-context`), la topbar, el selector de divisa y las cinco pantallas. Más el README v1, que llevaba pendiente desde la Fase 0 y es el 10 % de la nota.

## Qué se aceptó

- **El preview local sin debounce ni petición.** `quote()` de `@saas/pricing` con los tramos que ya trae `GET /customers/{id}`: 0 ms, sin red. No hace falta debounce porque no hay dos implementaciones que puedan divergir — el número de aquí **es** el del backend.
- **`AbortController` en el buscador.** Sin él, dos búsquedas seguidas pueden llegar desordenadas y la lenta pisa a la rápida: el bug clásico del buscador con debounce.
- **Los tipos de cambio en contexto**, no un `useRates()` por componente. Con dos serían dos peticiones y, peor, dos estados que pueden discrepar: el badge diciendo que hay tipos y el simulador diciendo que no.

## Qué se rechazó, y por qué

- **Un `if (país === 'ES')` en el alta** → ni se planteó, y esa es la gracia: el hint fiscal llega **resuelto** de `GET /countries` y la UI pinta el texto que recibe. Es el mismo principio que el backend impone al registro, aplicado al otro lado.

## El test que importa

De esta feature, el test valioso **no comprueba que el mock funcione**. Comprueba que el literal `"ADMIN"` aparece **una sola vez** en todo `frontend/src` y que ningún componente compara `rol === 'admin'`. Eso es lo único que hace el mock sustituible en un módulo, que es la única razón por la que un mock es aceptable.

Verificado por mutación: al hacer que la topbar comparase el rol a mano, el test lo cazó.

**Gotcha que quedó documentado**: el test tiene que **quitar los comentarios antes de buscar**. Si no, se caza a sí mismo — el comentario que explica la regla contiene el literal, y un test que prohíbe documentar la regla que protege es un test que alguien acaba borrando.

## Lo que costó: el arnés, no el producto

Perdí bastante rato montando el control de Chrome por CDP. Los síntomas: `Page.navigate` funcionaba, pero `Page.captureScreenshot` **se colgaba para siempre y sin decir nada**. Probé `--headless=new`, luego el clásico, luego `--user-data-dir` (que sí hacía falta)…

La causa: `tabs[0]` era un **`background_page`** de una extensión, no la pestaña. Una página sin visual: navega, pero no hay nada que capturar. Un `filter(t => t.type === 'page')` y listo.

Y una vez funcionando, los pasos 4-7 salían vacíos porque el guion navegaba con `Page.navigate`, que **recarga la SPA y mata la sesión** — que es el comportamiento correcto, no un bug. Se cambió a navegar clicando, por dentro.

## Dos aserciones fallidas, y las dos eran del test

Las capturas demostraron que la app estaba bien:

1. `t.includes('10 × 12,00 €')` fallaba porque **`Intl` mete un espacio DURO** (U+00A0) antes del `€`, y yo comparaba con un espacio normal.
2. `t.includes('no es la divisa de facturación')` fallaba porque ese texto va en `text-transform: uppercase`, y **`innerText` sí aplica el `text-transform`**.

## Qué aprendió el prompt siguiente

Que **conducir la app cuesta más que escribirla, y vale la pena igual**: el flujo completo (login → buscador → ficha de Fjord con su tarifa archivada → simulador → guardar → USD → historial) se recorrió en el navegador con cero errores de consola, y eso es lo que permite decir que funciona sin hedging. El arnés quedó hecho, y en la sesión 09 costó dos minutos reutilizarlo para el flujo de admin.
