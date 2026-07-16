# Recortes conscientes

> **Mantenimiento — capa PROCESO.**
>
> * Qué es: lo que se **diseñó y deliberadamente no se implementó**, con su porqué. Es el espejo del §6 Diferido de `../roams-roadmap.md`, contado desde el proceso: allí está la lista, aquí el razonamiento y la costura que lo deja preparado.
> * Regla de entrada: **solo entra lo que se pensó**. Un recorte es una decisión con alternativa evaluada; lo que no se pensó no es un recorte, es un hueco — y llamarlo recorte es maquillar.
> * No duplica los ADR: un ADR elige **entre** opciones; un recorte aplaza **una** que se sabe buena.

---

## 1. Por qué este documento existe

Un entregable de 5 días se juzga tanto por lo que tiene como por lo que le falta, y la diferencia entre "no le dio tiempo" y "decidió que no" **no se ve en el código**. Solo se ve aquí.

El criterio que gobierna toda la lista es el mismo que rechaza los puertos de más en `../02-arquitectura/directrices-ia.md` §3.3: **coste cierto por beneficio hipotético**. Cada entrada dice qué se gana, qué cuesta, **qué costaría hacerlo el día que haga falta** —que es la parte que demuestra que se pensó— y dónde está la costura que lo deja preparado.

**Un recorte bien hecho tiene tres propiedades**: se sabe qué se pierde, se sabe cuándo dejaría de ser aceptable, y **hacerlo más tarde no cuesta más que hacerlo ahora**. Si la tercera falla, no es un recorte: es deuda, y hay que decirlo con esa palabra.

---

## 2. Recortes de producto

### 2.1 Conexión al sistema de identidad corporativo (SSO / OIDC / LDAP)

> **Este recorte se estrechó en la Fase 3** (→ ADR 0009): la sesión de servidor, la cookie `HttpOnly`, el rate limit del login y el rol aplicado en el backend (401/403) **ya están construidos**. La predicción original —"rellenar el hook y sustituir un módulo"— se ejecutó y se cumplió. Lo que sigue recortado es solo lo de abajo.

**Qué se pierde**: la identidad no se verifica contra ningún sistema real — cualquiera con la credencial de demostración (pública y declarada) entra, y el nombre en los presupuestos sigue sin ser auditable.
**Por qué se aplaza**: no se conocen ni los datos ni el sistema de identidad interno de la empresa. Implementar hoy un `OidcProvider` contra un IdP elegido a ciegas sería casi con certeza el equivocado, y habría que tirarlo. → ADR 0007, 0009.
**Coste de hacerlo el día que haga falta**: **una implementación más del puerto `IdentityProvider`** y cambiar qué se inyecta en `index.ts`. Sesión, cookie, enforcement y frontend no se tocan; hay tests que fijan que el literal del usuario mágico vive en un solo módulo.
**Cuándo deja de ser aceptable**: en cuanto la herramienta salga de la red interna, o en cuanto un presupuesto tenga valor contractual y "quién lo emitió" tenga que ser una identidad verificada y no un nombre tecleado.

### 2.2 `VIESProvider` / reverse charge intracomunitario

**Qué se pierde**: una venta B2B intracomunitaria con NIF-IVA válido lleva IVA cuando no debería.
**Por qué se aplaza**: la v1 aplica el **tipo estándar del país del cliente**, que es correcto para el caso mayoritario y para todas las ventas nacionales. El reverse charge exige validar el NIF-IVA contra VIES en tiempo real, y eso es una dependencia externa con su propio fallback y su propio modo degradado.
**Coste de hacerlo**: una implementación más de `TaxProvider` (→ referencia §6.2). **El motor no se toca**: pide el tipo a una interfaz, no a un `if`. Es exactamente para esto que el puerto existe.
**Cuándo deja de ser aceptable**: el día que la herramienta cotice de verdad a clientes de otros países de la UE, no solo los simule.

### 2.3 Pasarela de pagos

**Qué se pierde**: nada hoy — la herramienta **no factura ni cobra** (→ referencia §1), produce presupuestos.
**Por qué se aplaza**: está fuera de alcance por definición del producto.
**Coste de hacerlo**: el diseño ya lo contempla en lo único que le afectaría: **un tipo cacheado sirve para enseñar, nunca para cobrar** (→ referencia §4.2). Al cobrar hay que revalidar, **fijar (*lock*) el tipo en el instante de la transacción** y persistirlo con el cobro. Y `minor_unit` ya está en el enum, que es lo que Stripe espera (JPY en yenes enteros).
**Nota**: es el recorte que más se beneficia de 0005. Sin `minor_unit`, integrar una pasarela sería una migración de datos; con él, es una feature.

### 2.4 Planes con divisa de facturación ≠ EUR

**Qué se pierde**: nada hoy — todos los planes son EUR.
**Por qué se aplaza**: no hay ningún cliente que lo pida, y hacerlo bien es *price localization* (una lista de precios independiente en USD, el modelo de Stripe), **no una conversión**. Un cliente que firmó a 10 $/usuario no acepta 10,73 $ el mes siguiente porque se movió el EUR/USD (→ referencia §4.1).
**Coste de hacerlo**: **la columna `currency` ya existe en `plans`** desde el día 1 aunque hoy solo contenga `EUR`, precisamente para que "EUR" no quede como suposición invisible incrustada en treinta sitios. Faltaría la cruzada de tipos (`USD→GBP = rates[GBP] / rates[USD]`, la API tiene base EUR) y el selector de divisa en la plantilla de planes — que también existe ya.
**Este es el ejemplo del recorte con coste futuro nulo**: la parte cara (que el sistema sepa que un importe tiene divisa) está hecha; la barata (que haya más de una) espera.

### 2.5 Modelos de tarificación `volume` / `flat`

**Qué se pierde**: nada — el enunciado pide *graduated* y es lo que hay.
**Por qué se aplaza**: no hay un plan que los necesite. Implementar dos estrategias sin un caso de uso es escribir código para un futuro imaginado.
**Coste de hacerlo**: el Strategy sobre `pricing_model` deja el hueco (→ referencia §5.3). Sería una estrategia nueva **y** ampliar el `CHECK (pricing_model IN ('graduated'))` de la tabla, en el mismo commit — el `CHECK` con un solo valor está ahí a propósito, para que no se pueda sembrar un modelo que nadie sabe calcular (→ `../01-specs/modelo-datos.md` §2.3).

### 2.6 Validadores fiscales de otros países (`PT_NIF`, `FR_SIREN`…)

**Qué se pierde**: los nueve países no españoles del seed guardan el identificador **sin validar** (`unvalidated`).
**Por qué se aplaza**: el enunciado exige España. Los demás son cada uno un algoritmo con su documentación y su batería de tests, y **la mayoría de países probablemente nunca la tendrán** (→ referencia §7.1) — el pass-through no es un estado transitorio, es el estado final del caso mayoritario.
**Coste de hacerlo**: una clase + una entrada en el registro + rellenar `tax_id_scheme`. **Cero cambios en endpoints** (→ referencia §7.2). El chequeo de arranque garantiza que rellenar la columna sin escribir la clase **revienta el arranque** en vez de degradar en silencio a pass-through, que es el fallo que este diseño más teme.

### 2.7 Consulta de existencia real del `fiscal_id` (AEAT / VIES)

**Qué se pierde**: un CIF estructuralmente válido que nunca se emitió pasa la validación.
**Por qué se aplaza**: **no-objetivo explícito de la v1** (→ referencia §7.6). No es un recorte por tiempo: es un límite de alcance declarado. El `mod 23` dice que la letra cuadra con los dígitos, no que ese DNI exista.
**Por qué está escrito igualmente**: porque es el malentendido clásico con un perfil no técnico (*"pero si el sistema lo validó, ¿no?"*), y un recorte que nadie sabe que existe acaba siendo una promesa que alguien hace en una reunión.

### 2.8 Panel de administración de impuestos

**Qué se pierde**: cambiar un tipo impositivo exige tocar el seed y redesplegar; no hay pantalla para ello.
**Por qué se aplaza**: los tipos estándar cambian una vez por década (España: 2010, 2012 — y de ahí las dos filas del seed). Un panel para eso es superficie de administración —validación, histórico editable, permisos— para una operación menos frecuente que un redeploy. Se reevaluó con el margen de plazo de la Fase 3 (→ `../roams-roadmap.md` §5.5) y se descartó otra vez.
**Coste de hacerlo**: la tabla `tax_rates` ya conserva histórico con regla de vigencia, así que el modelo de datos está; faltaría el endpoint + pantalla y, la parte crítica, **invalidar la caché de arranque al escribir** — el supuesto declarado en referencia §6.1 dice explícitamente que caché-hasta-reinicio es correcta *porque* este panel no existe, y ese mismo párrafo dice qué hacer el día que exista.
**Cuándo deja de ser aceptable**: cuando la cobertura pase de ~10 países a decenas y los cambios de tipo dejen de ser eventos raros, o cuando quien mantenga los tipos deje de ser quien despliega.

---

## 3. Recortes de implementación

Más pequeños, y son donde se ve el criterio del día a día. Cada uno tiene su razonamiento completo en su spec; aquí queda el registro.

| Recorte | Qué se pierde | Por qué | Dónde |
|---|---|---|---|
| **Estados Unidos fuera del seed** | No se puede dar de alta un cliente en US | No hay tipo indirecto federal: el *sales tax* es estatal y depende del nexo. Ponerlo a `0` sería **escribir una mentira en la base de datos**; ponerlo bien es un modelo de jurisdicciones subestatales que no es este proyecto. USD sigue disponible como divisa de **visualización**, que es independiente del país | `../01-specs/modelo-datos.md` §3.1 |
| **NIF especiales `K`, `L`, `M`** | Un `L1234567L` se rechaza como inválido, sin un mensaje que lo distinga de "no soportado" | La herramienta es **B2B**: un NIF de menor o de no residente no es cliente corporativo. **El recorte obliga a sacarlos del conjunto de iniciales del CIF**: dentro, se les aplicaría el checksum ponderado cuando su control real sale de un `mod 23` — dar por bueno lo que no lo es. Sería una rama más en el mismo validador | `../01-specs/features/02-validacion-fiscal-y-alta-cliente.md` §4.4 |
| **Búsqueda insensible a tildes** | `nebula` no encuentra `Nébula` | `upper()` de SQLite no toca los acentuados. Quitar tildes exige tabla de transliteración o ICU. Los datos los teclea el propio comercial | `../01-specs/features/03-buscador-y-detalle.md` §2.3 |
| **FTS5 en el buscador** | `LIKE '%x%'` hace *table scan* | Miles de filas en una herramienta interna: el scan es submilisegundo. **Lo que no se hace es fingir que un índice B-tree lo arregla** — no lo usa. A escala, FTS5 resolvería scan **y** tildes de una vez, y por eso los dos recortes esperan al mismo día | `../01-specs/features/03-buscador-y-detalle.md` §2.4 |
| **Refresco proactivo de tipos** | La primera petición tras caducar el TTL paga la latencia de la API externa | Un `setInterval` añade un temporizador que apagar, que falla en silencio si nadie lo mira, y que pide tipos a las 4 de la mañana cuando no hay nadie cotizando. *Cache-aside* pide cuando alguien pregunta | `../01-specs/features/04-tipos-de-cambio.md` §3.2 |
| **Cruzada de divisas** (`USD→GBP`) | Nada hoy | Todos los planes son EUR y la API tiene base EUR. Es una división cuando haga falta | `../01-specs/features/04-tipos-de-cambio.md` §6 |
| **`/api/v1`** | Nada hoy | No hay ningún consumidor externo al que romper: el único cliente se despliega con el servidor. `/api/v2` convive con `/api` el día que lo haya | `../01-specs/contrato-api.md` §1.1 |
| **Validación de plantilla en `@saas/pricing`** | La vista previa de la Ventana 7 no puede validar en local: con cortes incoherentes (50 y luego 10) enseña un número sin sentido hasta que el backend rechaza al guardar, porque el motor confía en sus entradas | El paquete compartido es el motor y el redondeo; su valor es que lo importan **los dos** lados. La validación la usa hoy uno. Bajarla es cómo un paquete compartido se convierte en vertedero | `../01-specs/features/06-admin-planes.md` §3.4 |

---

## 4. Recortes de infraestructura

### 4.1 `docker-compose`

**Por qué**: el stack **no tiene dependencias de sistema que orquestar** — SQLite es un fichero, no un servicio. Docker resuelve orquestar servicios y aislar dependencias del sistema, y aquí no hay ninguno de los dos: exigirlo para evaluar una app de Node puro **añadiría fricción en lugar de quitarla**, justo lo contrario del criterio de "levantar en pocos pasos y sin fricciones". → ADR 0008.
**Cuándo deja de ser aceptable**: en cuanto haya un servicio real (una base de datos que sea un proceso, una caché compartida, un worker). Ese día entra por la puerta grande.

### 4.2 Hexagonal completa (DTOs, mappers, repositorios abstractos en cada frontera)

**Por qué**: en una app de once endpoints es sobre-arquitectura. **Los puertos existen solo donde el cambio es seguro** —`TaxProvider`, registro de validadores, auth, motor— y son cuatro porque son los cuatro sitios donde se sabe qué va a cambiar y por qué. Una interfaz con una sola implementación y ningún cambio previsto **no desacopla nada**: añade un salto de indirección en cada lectura y un fichero por frontera. → `../02-arquitectura/directrices-ia.md` §3.3.
**Por qué merece estar en esta lista y no solo en las directrices**: porque es **el recorte que más veces hay que defender frente a una IA**. Pedir "una arquitectura limpia" produce hexagonal completa por defecto — es el patrón más representado en el material de entrenamiento. Rechazarlo diez veces con la misma razón **es** el trabajo de dirección que el enunciado llama "no aceptar soluciones subóptimas"; el sesgo, aquí, empuja hacia el exceso y no hacia la carencia.

### 4.3 Lo que ni siquiera llegó a proponerse en serio

Cerrando el círculo del criterio: pool de conexiones (SQLite es un fichero y `better-sqlite3` es síncrono), logger estructurado con correlación de trazas (un proceso, un evaluador), caché de consultas (la única lectura caliente ya está en un `Map` en memoria), rate limiting (herramienta interna sin exposición pública).

Cada uno es defendible en abstracto y **ninguno resuelve un problema que este proyecto tenga**. Van escritos porque el criterio no se demuestra solo con lo que se decidió no hacer después de pensarlo mucho, sino también con lo que se reconoció como reflejo automático y se dejó pasar sin gastar una hora en ello.
