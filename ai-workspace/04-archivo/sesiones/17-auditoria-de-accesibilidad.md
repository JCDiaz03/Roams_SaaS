# Sesión 17 — Auditoría de accesibilidad y Lighthouse en todas las vistas

**Objetivo.** Petición del usuario: sin letras pequeñas («por si hay una persona mayor en el equipo») y Lighthouse en todas las vistas. Más dos retoques de Ajustes (revertir el layout a dos columnas; texto de ayuda y campos a ancho completo).
**Resultado.** Suelo tipográfico de 12px en todo el frontend; axe extendido a las vistas que quedaban fuera de los smokes (con un hallazgo real corregido); Lighthouse sobre las 8 vistas con 5 arreglos — final: **accesibilidad 100 y SEO 100 en todas, best-practices 100 (96 en login por un 401 que es contrato), performance 85→98 en el simulador** con el CLS de 0,25 a 0.
**Regla 2**: registrada al cerrar.

## El suelo tipográfico

21 declaraciones por debajo de 12px (10,5 / 11 / 11,5) subidas a **12px como mínimo del sistema**: fechas y etiquetas de cards, hints de sliders, chips, pies de formulario, leyendas del desglose. Los textos de lectura siguen en 13–14px y los importes en 15–34px. El barrido fue mecánico (`grep font-size` ordenado + sed) para no dejar ninguna por opinión.

## axe en las vistas que faltaban

Smoke nuevo `e2e/vistas.spec.ts`: ajustes (con el clamp de límites comprobado: teclear 10 usuarios guarda 70), catálogo del dashboard abierto y detalle de plan. **Cazó un fallo real al primer arranque**: el summary «Planes activos (N)» usaba `text-2` sobre el fondo de página (no sobre una Card) y se quedaba por debajo del 4,5:1. Corregido a tinta principal. Con este, las 9 pantallas pasan por axe en CI.

## Lighthouse, con sesión de verdad

Contra el build servido con la CSP estricta (`preview`) y el backend real; las vistas autenticadas se auditaron pasando la cookie de sesión con `--extra-headers` — Lighthouse no sabe hacer login en una SPA, pero sí llevar una cookie.

| Hallazgo | Vista(s) | Arreglo |
|---|---|---|
| `favicon.ico` → 404, un error de consola en TODAS las vistas (best-practices 96) | todas | Favicon SVG (el logo) declarado en `index.html` + `frontend/public/favicon.svg` |
| Sin `meta description` ni `robots.txt` (SEO 83) | todas | Ambos añadidos (`robots.txt` permisivo: válido y rastreable) |
| Sin landmark `<main>` (a11y 98) | login | La pantalla de login es la única fuera del layout con `<main>` de `routes.tsx`; su raíz pasó de `div` a `main` |
| **CLS 0,25** (performance 85) | simulador | Dos causas: el estado de carga no reservaba el hueco de migas y barra de plan (esqueletos añadidos con sus medidas), y la de verdad — **el swap de Poppins**: el texto cambiaba de métrica al cargar la fuente. Arreglo: `@font-face 'Poppins Fallback'` = Arial con las métricas de Poppins (`ascent/descent/line-gap-override` + `size-adjust`), detrás de Poppins en `--font-sans`. CLS final: **0** |
| 401 de `GET /auth/session` en consola | login | **No se toca**: es el contrato («no hay nadie» = 401, spec 07) y el mismo caso que el smoke E2E ya filtra como esperado. Único punto no-100 del informe, y es deliberado |

## Puntuaciones finales (build de producción, escritorio del auditor)

| Vista | Perf | A11y | Best | SEO |
|---|---|---|---|---|
| Login | 98 | 100 | 96¹ | 100 |
| Dashboard | 98 | 100 | 100 | 100 |
| Ficha de cliente | 99 | 100 | 100 | 100 |
| Simulador | 98 | 100 | 100 | 100 |
| Detalle de plan | 98 | 100 | 100 | 100 |
| Admin listado | 98 | 100 | 100 | 100 |
| Admin plantilla | 95 | 100 | 100 | 100 |
| Ajustes | 98 | 100 | 100 | 100 |

¹ El 401 contractual del sondeo de sesión.

## Verificación

363 tests + **4 E2E** (el smoke de vistas nuevo incluido) en verde; typecheck, lint y build limpios.
