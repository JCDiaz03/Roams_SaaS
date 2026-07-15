# Sesión 07 — El backend

**Objetivo.** La API completa: esqueleto Fastify, chequeos de arranque y los ocho endpoints que necesita el frontend.
**Spec de partida.** `01-specs/contrato-api.md` y las specs de feature 01–04.
**Resultado.** Hecho. Commit `49dd58e` — 160 tests de integración.

## Prompt de partida

> ahora el backend §3.2

## Qué generó

Veinte ficheros: `server.ts`, los dos plugins, la caché de países con el chequeo triple, el `TaxProvider`, y las features `countries`, `customers`, `simulations`, `plans` (solo GET) y `rates`. Más un arnés de test que levanta la app real contra una base **en memoria con el esquema y el seed de producción** — sin fixtures paralelos, así que lo que pasa el test es el camino que corre de verdad.

## Qué se aceptó

- **El duplicado se detecta capturando el UNIQUE**, no con un `SELECT` previo. `SELECT`-luego-`INSERT` es una condición de carrera de manual: dos altas simultáneas del mismo CIF pasan las dos el `SELECT` y una revienta igual, solo que con un `500` en vez de un `409`. El `SELECT` para poder enlazar a la ficha existente va en el **camino de fallo**, no en el que corre siempre.
- **Dependencias explícitas por feature**, no un objeto-dios: `countries` no ve la base de datos, `rates` no ve nada del dominio.
- **El prefijo `/api` puesto en un solo sitio.** Si cada feature lo escribiera, la primera que se lo olvide abre el agujero sin que nadie lo note.

## Qué se rechazó, y por qué

- **Un `ORDER BY name` en SQL** → rechazado, después de que un test lo cazara. La colación por defecto de SQLite es `BINARY`: ordena por bytes, así que **`Plan Ágora` caía después de `Bitácora` y `Cúspide`** (la `Á` es `0xC3`, la `B` es `0x42`). Lo humillante: es **el mismo problema de acentos que yo mismo había documentado** para el `LIKE` del buscador, y lo había resuelto en la lista de países con `localeCompare`… y se me pasó en los planes. La regla quedó escrita en la spec 03: todo listado por texto visible se ordena en JS.
- **Una transacción para el `INSERT` de simulación** → rechazada. Es una sola sentencia y `better-sqlite3` la ejecuta atómicamente; envolverla en `BEGIN/COMMIT` sería ceremonia. (La única transacción del backend llegó en la sesión 09, donde sí hacen falta dos escrituras.)

## El hallazgo: `additionalProperties: false` no daba 400

El más grave de todo el proyecto, y lo cazó un test. Fastify configura Ajv con `removeAdditional: true` por defecto: con eso, un campo que sobra **se elimina en silencio** y la petición sigue adelante con un `201`.

Es decir: un `total_minor` en el cuerpo de `POST /simulations` se ignoraba calladamente, y **el invariante 1 —«el frontend nunca envía importes»— dejaba de ser verificable para pasar a ser una promesa**. Mi `contrato-api.md` §1.5 afirmaba exactamente lo contrario.

→ Auditoría completa: [`01-additional-properties-no-da-400.md`](../auditorias/01-additional-properties-no-da-400.md).

## Verificado con el servidor real

No solo con `inject`. Se levantó el servidor y se recorrió con `curl`: el `.db` se crea y siembra solo; `p-1234 567d` se persiste como `P1234567D`; **15 usuarios = 140 € + 21 % = 169,40 €** con su desglose; Fjord (plan archivado) cotiza a **su** tarifa (155 €); `GET /rates` llama de verdad a `open.er-api.com` y filtra de ~160 divisas a 45, con la segunda petición desde caché en 2 ms; y **el arranque se niega** ante un esquema fiscal no registrado, con un mensaje que dice qué hacer.

## Qué aprendió el prompt siguiente

Que **los defaults del framework son parte del contrato**. `additionalProperties: false` es la línea que uno escribe; `removeAdditional` es lo que decide qué significa. Ninguna spec sobrevive a no leer la documentación del framework que la implementa.
