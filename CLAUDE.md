# Roams SaaS — directrices para la IA

> Este fichero es la versión **ejecutable** de [`ai-workspace/02-arquitectura/directrices-ia.md`](ai-workspace/02-arquitectura/directrices-ia.md): aquí el resumen que cabe en cada sesión, allí el porqué de cada regla. **Si los dos se contradicen, manda este** y el otro tiene un bug.

## Antes de escribir código

- Ninguna feature se implementa sin su spec en `ai-workspace/01-specs/`. Si no existe, se escribe primero.
- El documento madre es `ai-workspace/01-specs/idea-referencia.md`. Sus secciones (`§4.2`, `§7.3`…) son la referencia canónica; ante cualquier duda de negocio, manda él.

## Invariantes que no se negocian

> **Ojo con la numeración**: estos cinco son el resumen operativo, con numeración propia. La numeración **canónica** es la de los 7 principios de `idea-referencia.md` §3 — cuando el workspace cita «invariante 5» (ADRs, contrato, modelo de datos), habla de la referencia (el 5 = nada de float), no de esta lista.

1. El backend es la única fuente de verdad del coste, el impuesto y la validación fiscal. El frontend envía entradas, nunca importes.
2. Nada de `float` para dinero: enteros en unidades menores (`_minor`) acompañados del código ISO.
3. Ningún tipo de cambio entra jamás en un importe persistido. La divisa de visualización no afecta al negocio.
4. Se redondea una sola vez, al final, en la divisa de facturación, con half-up, y por la única función de redondeo del sistema.
5. Los precios y tramos viven en la base de datos, nunca en código.

## Convenciones de código

- Corte por feature (`features/<nombre>/`), no por capa técnica. Cada feature agrupa ruta, esquema, repositorio y servicio.
- El motor de tarificación es una función pura en `@saas/pricing`, importada por front y back. **Nunca se reimplementa** en ninguno de los dos lados.
- Los puertos existen solo donde el cambio es seguro: `TaxProvider`, registro de `TaxIdValidator`, auth y el motor. En el resto de fronteras, sobra.
- Archivos pequeños y navegables. Un fichero que crece hasta necesitar índice mental es una feature mal cortada.
- Nombres y comentarios en castellano; identificadores de código en inglés.

## Reglas de seguridad (revisables en code review)

- Toda ruta Fastify declara su esquema JSON, con `maxLength` en **todos** los campos de texto.
- Toda ruta de la API cuelga de `/api`. Es lo que mantiene el proxy de Vite en una regla y evita que un endpoint choque con una pantalla del SPA.
- El 100 % de las consultas usa sentencias preparadas. En el `LIKE` del buscador se escapan `%` y `_`.
- Regex ancladas y lineales, sin backtracking catastrófico.
- `dangerouslySetInnerHTML` está prohibido.
- El error handler de producción no devuelve stack traces al cliente.
- Nada de abrir CORS para "arreglar" el cruce de puertos en desarrollo: para eso está el proxy de Vite.

## Al cerrar cada sesión

- La sesión se registra **antes de cerrarla**, no al final del proyecto: el diario bruto en `ai-workspace/04-archivo/sesiones/` y su reflejo en la tabla de `ai-workspace/03-proceso/vibe-coding.md` — prompt de partida, resultado y qué se rechazó, con su porqué. (Regla que se incumplió en la primera entrega precisamente porque no vivía en este fichero → nota de procedencia en `vibe-coding.md`.)
- Caso desarrollado o ficha de auditoría, **solo si pagan su peaje**: una lección distinta de las ya contadas, o un defecto silencioso con regla transferible.
- Si la sesión matiza o supersede una regla escrita, **se grepea la frase vieja en todo el repo** (docs incluidos) y se matiza donde sobreviva.
- La suite entera en verde (`npm test`; el smoke E2E si la sesión tocó pantalla) antes de dar la sesión por cerrada.

## Qué rechazar aunque la IA lo proponga

- Una segunda implementación del cálculo de tramos "para el preview".
- `if (pais === 'ES')` en la validación fiscal: eso lo resuelve el registro de estrategias.
- Borrado físico de planes **usados** (con clientes o simulaciones), o edición de un precio publicado en sitio. El plan jamás usado sí se elimina, con la condición decidida por el servidor (→ ADR 0013).
- Capas hexagonales completas con DTOs y mappers en cada frontera.
- Comprobar el rol comparando el string `"ADMIN"` fuera del login.
