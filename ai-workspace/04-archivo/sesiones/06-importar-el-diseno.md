# Sesión 06 — Importar el diseño

**Objetivo.** Traer el prototipo de Claude Design al proyecto.
**Spec de partida.** `01-specs/diseño-frontend.md` (el brief que generó el prototipo).
**Resultado.** Parcial y a propósito: tokens y primitivas. Commit `e9a75a8`.

## Prompt de partida

> tengo el front hecho con el desing conecta e importa:
> Use the claude_design MCP (https://api.anthropic.com/v1/design/mcp, auth via /design-login) to import this project:
> https://claude.ai/design/p/172edbb5-b6f2-425f-99bb-1c209bf19d02?file=SaaS-O-Matic.dc.html
>
> Implement: SaaS-O-Matic.dc.html

Literal, con la errata de «desing». Se transcribe tal cual porque limpiarlo no aportaría nada y quitaría lo único que prueba que es real.

## Qué generó

Antes de escribir nada: leer el `.dc.html` (82 KB) y **decir que no** a la mitad del encargo.

## Qué se rechazó, y por qué

- **«Implement: SaaS-O-Matic.dc.html» al pie de la letra** → rechazado. El prototipo trae **su propia reimplementación de todo el núcleo**: un motor de tramos (`tierCost`), un `roundHalfUp(x) = Math.floor(x + 0.5)` que opera en float y falla con negativos, un validador fiscal completo, y los tipos impositivos como `tax: 0.21`. Es perfecto en un mockup y es **exactamente lo que las directrices §5 rechazan** en producción: sería una segunda implementación del motor y una tercera del validador. Del prototipo se porta el lenguaje visual; la lógica se tira.
  - Curiosidad que dice mucho: su validador de CIF **ya excluía K/L/M** (bien), pero aceptaba `okNum || okLet` — el validador permisivo que la sesión 05 había rechazado el día anterior.
- **Implementar las cinco pantallas** → rechazado *por ahora*. Consumen la API y `§3.2` estaba entero pendiente: no existía ni una ruta. El propio roadmap ordena §3.2 → §3.3 por eso. Se ofreció la alternativa —tokens y primitivas, que no dependen de nada— y el usuario la eligió.
- **Poppins desde `fonts.googleapis.com`**, como en el prototipo → rechazado. Es una petición a un tercero, choca con la CSP estricta de §14.2, y una herramienta interna no debería depender de que Google responda para pintarse. Auto-alojada. Y con subset latino explícito, porque sin él se empaquetaba **devanagari**: 512 KB de fuentes → 80 KB.
- **Las banderas del selector de divisa** → rechazadas. Una bandera junto a una divisa es una imprecisión (el euro no es de un país, el dólar es de veinte) y no la lee un lector de pantalla. El símbolo lo deriva `Intl` del código ISO.

## El hallazgo: ocho pares fallaban AA

El brief pone el contraste AA como **requisito duro** («incluidos los estados deshabilitados y los badges»). Al medirlo, **ocho pares del prototipo lo fallaban**. El peor: texto blanco sobre el primario en tema oscuro, **3,44** — el botón principal de toda la app.

→ Auditoría completa: [`03-contraste-aa.md`](../auditorias/03-contraste-aa.md).

## Y una corrección a la referencia

`idea-referencia.md` §4.4 afirmaba que `Intl.NumberFormat('es-ES', {currency:'JPY'}).format(140)` da `"140 ¥"`. **Es falso: da `"140 JPY"`.** Hace falta `currencyDisplay: 'narrowSymbol'`, que el documento omitía. Lo curioso es que el prototipo tenía el mismo problema y lo compensaba con un `symbolOf()` a mano — o sea, la tabla de símbolos que §4.4 presume de no tener.

## Qué aprendió el prompt siguiente

Que **un encargo se puede cumplir mejor rechazando parte de él**, y que hay que decirlo antes de empezar y no después. La alternativa (tokens ahora, pantallas cuando haya API) se propuso con su porqué y se preguntó; dos sesiones después, las pantallas se montaron encima sin tirar nada.
