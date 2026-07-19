# Directrices para la IA y estructura del proyecto

> **Mantenimiento — capa ARQUITECTURA.**
>
> * Qué es: las reglas bajo las que la IA genera cada línea de este proyecto, y el porqué del árbol de carpetas. Es el documento que sostiene el 25 % de "criterio técnico y control de calidad".
> * **Relación con `/CLAUDE.md`**: el `CLAUDE.md` de la raíz es la versión **ejecutable** de este documento —lo que el modelo lee en cada sesión, sin porqués, para que quepa y se cumpla—. Aquí está el **razonamiento** detrás de cada regla. Si los dos se contradicen, manda el `CLAUDE.md` y este documento tiene un bug.
> * Las decisiones con alternativas descartadas → `decisiones.md`. El qué se construye → `../01-specs/idea-referencia.md`.

---

## 1. La tesis: dónde está el trabajo de ingeniería

El enunciado lo dice sin rodeos: la IA escribe el código, y lo que se evalúa es el criterio. Eso cambia dónde se pone el esfuerzo, no cuánto.

Un modelo genera con soltura el 80 % de este proyecto: una ruta Fastify, un componente de React, un `CREATE TABLE`. Lo que **no** hace por defecto es respetar un invariante que no se le ha dicho. Pedirle "un endpoint que calcule el precio con IVA" produce, con toda naturalidad, código correcto en apariencia y equivocado en lo que importa: un `float` para el dinero, un `if (country === 'ES')` para el IVA, y un redondeo en cada paso. Nada de eso es un fallo del modelo — es lo que produce cualquiera que no conozca las reglas de este dominio.

De ahí la forma de estas directrices: **no explican cómo escribir código, declaran los invariantes y el criterio de rechazo**. Es la diferencia entre revisar cada línea generada y hacer que la línea equivocada no llegue a generarse.

**Tres capas, en este orden:**

1. **Prevención** — el invariante está en el `CLAUDE.md`, así que el modelo lo aplica antes de que exista el problema.
2. **Imposibilidad** — la regla está en el tipo, el esquema, el `CHECK` o el linter, así que el código equivocado no compila, no arranca o no pasa CI. Siempre que se pueda, se sube una regla de la capa 1 a esta.
3. **Detección** — la regla está en la lista de rechazo (§5) y se cazará en revisión.

La capa 2 es la única que no depende de que alguien se acuerde. Ejemplos concretos de este proyecto: `dangerouslySetInnerHTML` prohibido por ESLint, no por costumbre; `CHECK (total_minor = base_minor + tax_minor)` en la tabla, no en un test; `additionalProperties: false` para que "el frontend nunca envía importes" sea un `400`, no una promesa; chequeo de integridad al arrancar, no una nota en el README.

---

## 2. Los invariantes: lo que no se negocia

Estos cinco no se discuten en una sesión de vibe coding. Si el código generado los rompe, se rechaza sin evaluar el resto — no hay contexto en el que la alternativa sea mejor. El razonamiento completo está en `../01-specs/idea-referencia.md` §3; aquí queda el enunciado y **la señal que delata su incumplimiento**.

| Invariante | Cómo se detecta que está roto |
|---|---|
| **1. El backend es la única fuente de verdad** del coste, el impuesto y la validación fiscal | Un campo de importe en el cuerpo de una petición. Un cálculo en el frontend cuyo resultado se envía |
| **2. Nada de `float` para dinero**: enteros `_minor` + código ISO | Un `number` con decimales en un importe. `parseFloat`, `toFixed`, `* 100`. Un sufijo `_cents` |
| **3. Ningún tipo de cambio entra en un importe persistido** | Un `rate` en cualquier función que escriba en base de datos. Una columna de divisa de visualización |
| **4. Se redondea una sola vez, al final, en la divisa de facturación, con half-up** | Un `Math.round` fuera de `@saas/pricing`. `Math.round` a secas (es half-even para negativos y half-up solo por accidente) |
| **5. Precios y tramos viven en la base de datos** | Un `10`, un `8` o un `5` literales en el código de cálculo. Una constante `TIERS` |

**El invariante 4 merece un párrafo**, porque es el que más silenciosamente se rompe: `Math.round(x)` en JavaScript **no es half-up**, es "half hacia +∞", que coincide con half-up solo para positivos. Redondear importes negativos (un abono, un descuento) con `Math.round` da un resultado distinto del estándar de facturación europea. Hoy no hay negativos, así que el bug no se manifestaría; por eso el redondeo vive en **una única función de `@saas/pricing`** con sus tests, y no en treinta `Math.round` correctos por casualidad.

---

## 3. El árbol del proyecto y por qué es este

### 3.1 Monorepo con workspaces

```
/backend            (workspace: Fastify + SQLite)
/frontend           (workspace: React + Vite)
/packages/pricing   (workspace: @saas/pricing — motor, redondeo, enum Currency)
/ai-workspace       (documentación del proceso; NO es workspace)
package.json        (workspaces + scripts raíz: dev, test, seed)
```

**Los workspaces no son gusto por el monorepo: son el mecanismo que hace cumplir el §10.** El preview del slider debe calcular exactamente lo mismo que el backend persiste. Con dos repos, la única forma de compartir el motor es publicar un paquete (fricción absurda a esta escala) o copiarlo (dos implementaciones que divergen el primer martes). Con workspaces, `@saas/pricing` se importa desde los dos lados y **la divergencia no es que sea improbable: es que no es expresable**.

Corolario para la IA: `packages/pricing` **no puede importar nada de `backend/` ni de `frontend/`**, y no puede tocar IO. Es una función pura y ese es todo su valor. Si algo del motor necesita leer de la base de datos, el motor está mal cortado — los datos se le pasan como argumento.

### 3.2 Backend: vertical slicing

```
backend/src/
  features/
    customers/     (rutas + esquemas + repo + servicio: alta y buscador)
    simulations/   (cálculo, snapshot, historial)
    plans/         (plantilla, versionado, admin)
    rates/         (proxy + caché + fallback)
    countries/
  domain/          (TaxProvider, TaxIdValidator + registro, ES_NIF, PassThrough
                    — funciones puras, SIN IO)
  infra/           (conexión SQLite + migración/seed; caché de arranque de countries;
                    StandardCountryRateProvider)
  server.ts        (registro de features, error handler, middleware de auth)
```

**Corte por feature, no por capa.** La razón es de navegación: en un corte por capa (`controllers/`, `services/`, `repositories/`), tocar el alta de clientes significa abrir tres carpetas y adivinar qué fichero de cada una; y las tres carpetas crecen hasta ser el "archivo masivo" que el enunciado pide evitar, solo que repartido. Con corte por feature, **todo lo del alta está en `features/customers/`** y un cambio se localiza leyendo el nombre de una carpeta.

Efecto secundario que importa aquí: es también el corte que mejor le sienta a una IA. El contexto que necesita para trabajar en una feature **cabe en una carpeta**, y el radio de un cambio equivocado se queda dentro de ella.

**Dónde está el límite**: `domain/` e `infra/` existen porque hay cosas que **no son de ninguna feature**. El registro de validadores lo usan `customers` y `countries`; la conexión SQLite la usan todas. Meterlas en una feature crearía una dependencia entre features, que es lo único que el vertical slicing tiene que evitar. **Las features no se importan entre sí**: si dos necesitan lo mismo, eso baja a `domain/` (si es lógica pura) o a `infra/` (si toca el mundo).

### 3.3 Puertos: solo cuatro, y por qué no más

Existen exactamente cuatro interfaces sustituibles: **`TaxProvider`** (§6.2), **el registro de `TaxIdValidator`** (§7.2), **la costura de auth** (§8) y **el motor en `@saas/pricing`** (§10).

El criterio no es "toda dependencia externa se abstrae" — es **"aquí sabemos que va a cambiar, y sabemos por qué"**:

- `TaxProvider`: al integrar con el sistema real habrá reverse charge intracomunitario. Es un hecho, no una hipótesis.
- Registro de validadores: cada país nuevo es un validador nuevo. Ya hay diez países y un solo algoritmo.
- Auth: el mock **se sabe** que es temporal. La costura es la mitad del argumento de que no genera deuda.
- El motor: lo importan dos consumidores. La interfaz **es** el mecanismo de compartirlo.

**En el resto de fronteras, sobra.** No hay `ICustomerRepository` con su implementación SQLite y su mapper de DTOs. El motivo no es pereza: una interfaz con **una sola implementación y ningún cambio previsto** no desacopla nada — añade un salto de indirección que hay que atravesar en cada lectura, y un fichero por frontera que mantener. Se paga un coste cierto por una flexibilidad hipotética.

Esta es la regla que **más veces hay que defender frente a una IA**: pedir "una arquitectura limpia" produce hexagonal completa con puertos, adaptadores, DTOs y mappers en cada frontera, porque es el patrón más representado en el material de entrenamiento. Es la respuesta correcta para un sistema con varias implementaciones reales, y sobre-arquitectura en una app de once endpoints. **El recorte es la decisión, y está documentada** (→ `decisiones.md`).

### 3.4 Frontend: espejo

```
frontend/src/
  features/   (login, search, customer, simulator, admin)
  ui/         (componentes del sistema de tokens → ../01-specs/diseño-frontend.md)
  lib/        (cliente API, sesión, formato de divisa)
```

Mismo corte y mismo criterio. `lib/` es el `infra/` del frontend: lo que no es de ninguna feature.

---

## 4. Convenciones

**Idioma.** Nombres, comentarios y documentación en **castellano**; identificadores de código en **inglés** (`unit_price_minor`, `hasRole`, `SpanishTaxIdValidator`). La frontera es nítida: si lo lee un humano, castellano; si lo lee el compilador, inglés. Los mensajes de error de cara al usuario son castellano, y de producto (→ `contrato-api.md` §1.2).

**Tamaño de archivo.** No hay número mágico. La regla es: **un fichero que necesita un índice mental para navegarse es una feature mal cortada**, y la respuesta es cortar la feature, no partir el fichero por la mitad. Un `customers/routes.ts` de 200 líneas coherentes está bien; uno de 80 que mezcla alta y buscador con el proxy de divisas, no.

**Comentarios.** Solo para lo que el código no puede decir: un invariante, un gotcha, un porqué no obvio. Nunca para narrar la línea siguiente ni para justificar el cambio ante el revisor. Si un comentario explica **qué** hace el código, sobra el comentario o sobra el código.

**Nombres de dinero.** Sufijo `_minor` siempre, `_cents` nunca (→ referencia §4.4: "cents" asume dos decimales y el yen no los tiene). Todo importe viaja con su código ISO al lado.

**Tests.** Los algoritmos (motor, redondeo, validación fiscal) se testean **en aislamiento y antes** que cualquier endpoint o UI (→ `roams-roadmap.md` §3.1). No es dogma de TDD: es que son las dos piezas donde un fallo es silencioso y caro, y las únicas que se pueden testear sin nada montado alrededor.

---

## 5. Qué se rechaza en revisión, aunque la IA lo proponga

Lista de rechazo directo. Cada entrada es algo que un modelo propone **con buenas razones genéricas** y que aquí está mal por una razón específica. Un rechazo se argumenta con el porqué, no con "no".

| Se rechaza | Por qué está mal **aquí** |
|---|---|
| Una segunda implementación del cálculo "para el preview" | Es exactamente lo que `@saas/pricing` existe para impedir (§3.1). Divergen el primer martes |
| `if (pais === 'ES')` en la validación fiscal | Lo resuelve el registro de estrategias (§7.2). Un `if` por país es la deuda que el diseño compra el registro para no tener |
| `if (pais === 'ES')` **en el frontend**, para el hint | Mismo error, otra capa. El hint viaja resuelto en `GET /countries` (→ `contrato-api.md` §3.1) |
| Borrado físico de planes | Rompe integridad referencial y presupuestos ya enviados. Se archiva (§5.5) |
| Editar un precio publicado en sitio | Un precio publicado es inmutable. Editar crea versión (§5.5) |
| Capas hexagonales completas con DTOs y mappers en cada frontera | Sobre-arquitectura en once endpoints. Los cuatro puertos están elegidos (§3.3) |
| Comparar el rol con el string `"ADMIN"` fuera del login | El rol se deriva **una vez**; los componentes preguntan `hasRole()` (§8.2). Es la diferencia entre un mock y una deuda |
| Abrir CORS para "arreglar" el cruce 5173↔3000 | Para eso está el proxy de dev de Vite. Es mismo origen (§14.1) |
| `Math.round` para dinero fuera de `@saas/pricing` | No es half-up (§2). Una sola función de redondeo, testeada |
| Un `try/catch` que devuelve el error al cliente | El handler de producción no filtra stack traces (§14.2) |
| Concatenar el término del buscador en el SQL | Sentencias preparadas al 100 %, y escape de `%`/`_` en el `LIKE` (§14.2) |
| `dangerouslySetInnerHTML` | Prohibido por ESLint. No hay caso de uso en este dashboard |
| Una regex con `(a+)+` o similar | Ancladas y lineales. Sin backtracking catastrófico (§7.5) |
| Un campo de texto sin `maxLength` en el esquema | Tope anti-DoS obligatorio en **todos** (§7.5) |
| Una ruta fuera de `/api` | El proxy de Vite y la separación SPA/API dependen de ello |
| "Añado un índice para acelerar el `LIKE '%x%'`" | Un comodín inicial no usa índice B-tree. La respuesta sería FTS5, y no hace falta (→ `../01-specs/modelo-datos.md` §2.4) |

**Y la categoría que no cabe en una tabla**: lo que está bien pero **no se ha pedido**. Una IA propone con entusiasmo un sistema de caché, un pool de conexiones, un logger estructurado con correlación de trazas, un `docker-compose`. Cada uno es defendible en abstracto y ninguno resuelve un problema que este proyecto tenga. El criterio es el mismo que rechaza los puertos de más: **coste cierto por beneficio hipotético**. Si aparece la necesidad, aparece la pieza — y si se diseñó y no se hizo, va a `../03-proceso/recortes-conscientes.md`, que es donde un recorte se convierte en criterio demostrado en vez de en un olvido.

---

## 6. Cómo se trabaja con la IA en este proyecto

1. **Ninguna feature se implementa sin su spec** en `../01-specs/`. Si no existe, se escribe primero. No es burocracia: la spec **es** el prompt: el trabajo de precisar el problema hay que hacerlo igual, y hacerlo antes lo deja escrito.
2. **El documento madre es `idea-referencia.md`.** Sus secciones (`§4.2`, `§7.3`…) son la referencia canónica y se citan en los prompts. Ante cualquier duda de negocio, manda él.
3. **Cada sesión deja rastro** en `../03-proceso/sesiones/`: prompt de partida, qué se generó, **qué se rechazó y por qué**. Lo tercero es lo que tiene valor; lo primero es contexto. **Y el rastro se escribe al cerrar la sesión, no al final del proyecto**: esta regla se incumplió en la primera entrega precisamente porque vivía solo aquí y no en el `CLAUDE.md` que la IA relee en cada sesión — hoy está en los dos (→ nota de procedencia, `../03-proceso/sesiones/00-como-se-registro-esto.md`). Una regla que no vive donde se relee no es una regla: es una esperanza.
4. **El código generado se audita, no se acepta.** Lo que se busca no es que compile, sino los invariantes del §2, y son justo lo que un modelo no sabe que existe hasta que se le dice.
5. **Un rechazo se argumenta.** "No" no enseña nada — ni al modelo en el siguiente turno, ni a quien lea el proceso. Por eso la tabla del §5 tiene dos columnas y la segunda es la que importa.
6. **La suite entera en verde antes de cerrar la sesión** (`npm test`; el smoke E2E si se tocó pantalla). Una sesión cerrada en rojo deja el rastro mintiendo: el diario diría "hecho" de algo que no funciona.
