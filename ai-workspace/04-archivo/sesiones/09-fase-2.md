# Sesión 09 — Fase 2

**Objetivo.** La administración de planes: validación de plantilla, versionado, archivado y sus dos ventanas.
**Spec de partida.** `01-specs/features/06-admin-planes.md`.
**Resultado.** Hecho. Commit `5dc4eb8` — el reto, completo. 297 tests.

## Prompt de partida

> ahora la Fase 2

## Lo primero: no empezar

La regla 1 del roadmap dice que la Fase 2 **solo se abre si el gate de Fase 1 está en verde**, y ese gate no se había ejecutado nunca. Antes de escribir una línea:

```
git clone → npm install (0 vulnerabilidades) → npm run dev
```

siguiendo solo el README, en un directorio limpio. El `.db` se creó solo y **15 usuarios = 140 € + 21 % = 169,40 €**. En verde. Entonces se abrió la fase.

Es la regla más importante del plan («el 30 % de la nota es la robustez de lo entregado; el alcance extra no puede comprometerla») y era la más fácil de saltarse, porque nadie la estaba mirando.

## Qué generó

`plan-template.validation.ts` (función pura, 19 tests), el servicio de versionado, los tres endpoints, y las ventanas 6 y 7.

## Qué se aceptó

- **El `PUT` en transacción.** Es la **única** del backend y hace falta: son dos escrituras —insertar la versión nueva, archivar la vieja— y una caída entre ellas dejaría **dos versiones activas del mismo plan**. El selector del alta mostraría el plan duplicado sin que nada estuviera «roto» de forma detectable, que es la peor clase de fallo.
- **Devolver todas las violaciones**, cada una con su métrica e índice. El admin que ha escrito cuatro tramos mal no debe descubrirlos de uno en uno, guardando y fallando cuatro veces.
- **La vista previa con el mismo `quote()`** del backend, no una tercera implementación como en el prototipo.

## Qué se rechazó, y por qué

- **Validar «sin huecos ni solapes»** → rechazado: **es inexpresable**. Al representar los tramos solo con su límite superior, cada uno empieza donde acaba el anterior y no hay dónde escribir un hueco. Con un modelo `(from, to)`, `(1,10)` y `(20,50)` sería un hueco perfectamente representable y harían falta dos validaciones más. Es la **representación** la que elimina dos clases enteras de error, no el validador.
- **Un `toLowerCase()` sobre las etiquetas** → rechazado al verlo en una captura: convertía «Llamadas API» en «llamadas **api**». El castellano no se genera bajando mayúsculas; las frases se escriben.

## El hallazgo: mi propia spec inducía al bug

Crear un plan con el nombre de uno archivado devolvía **500**. `crearPlan` fijaba `version = 1`, y eso choca contra el `UNIQUE (name, version)` en cuanto ese nombre ya tuvo una v1.

Y el enunciado que lo indujo era mío: la tabla del §5.5 decía «**Crear** | Inserta plan, `version = 1`». Escrito así, sin matices, en un documento que se lee como autoridad.

La corrección: crear usa la **siguiente versión de ese nombre**. Y es coherente, no un parche: si el `UNIQUE` dice que **el nombre es la identidad del linaje**, reutilizarlo es continuarlo. La versión 1 es el caso particular de un nombre nunca usado. La spec quedó con un §4.4 que lo explica.

## Verificado conduciendo la app

Entrar como `ADMIN` → Administración → editar Ágora → plantilla incoherente **rechazada con el error sobre su fila** («el tramo 2 llega hasta 5, que no supera al anterior (10): quedaría vacío») → arreglar y guardar → **v3 activa, v1 y v2 archivadas**.

Y lo que de verdad prueba la feature: la simulación guardada **antes** sigue diciendo 169,40 € con sus tramos de 10 €/8 €, y Nébula sigue apuntando a la v2 con su tarifa de 10 €, no a los 9 € de la v3. El snapshot y el versionado, funcionando a la vez, en vivo.

## Qué aprendió el prompt siguiente

Que **una spec escrita antes de programar acierta en el diseño y se equivoca en los detalles**, y que las dos cosas son ciertas a la vez. Tres sesiones encontraron datos mal en documentos que yo mismo había escrito (el control letra del CIF, el ejemplo de `Intl`, el «versión 1»). Ninguno invalidó el diseño; todos habrían sido bugs si nadie los hubiera comprobado.

El valor de la Fase 0 no era tener razón en todo. Era tener algo concreto **contra lo que fallar**.
