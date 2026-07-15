# Spec — Validación fiscal y alta de cliente

> **Capa SPEC de feature.** El porqué de negocio → `../idea-referencia.md` §7 completo. El contrato HTTP → `../contrato-api.md` §2.1 y §3.1. Las tablas → `../modelo-datos.md` §2.1, §2.4. La pantalla → `../diseño-frontend.md` ventana 5.
>
> Validador y endpoint se especifican juntos porque el registro de validadores existe para servir al alta.

---

## 1. Alcance

- Normalización del identificador fiscal, registro de estrategias por esquema y el validador español (`ES_NIF`: DNI, NIE y CIF).
- `POST /customers` y `GET /countries`.

**Lo que se valida**: que el identificador es **estructuralmente válido** y que su **carácter de control cuadra**.
**Lo que NO** (no-objetivo explícito, → referencia §7.6): que el identificador **exista** o pertenezca a alguien. No se consulta AEAT ni VIES. El `mod 23` dice que la letra cuadra con los dígitos, no que ese DNI se haya emitido nunca. Conviene tenerlo escrito porque es el malentendido clásico con un perfil no técnico: *"pero si el sistema lo validó, ¿no?"*.

---

## 2. Normalización

**Se normaliza antes de validar, y se persiste la forma normalizada** (→ referencia §7.4).

```
normalizar(entrada) = quitar espacios y guiones -> mayúsculas
"b-1234 5674"  ->  "B12345674"
" 12345678z "  ->  "12345678Z"
```

Regla exacta: eliminar todo carácter que no sea `[A-Za-z0-9]`, después `toUpperCase()`. **Nada más** — no se rellenan ceros a la izquierda ni se corrigen caracteres parecidos (`O` por `0`). Eso sería adivinar la intención del usuario, y adivinar mal en un identificador fiscal es peor que rechazar.

**Por qué importa tanto para ser una línea de código**: es el gotcha que rompe las validaciones con datos reales tecleados por humanos, y arrastra dos consecuencias que no son obvias:

1. **El UNIQUE actúa sobre la forma normalizada** (→ `../modelo-datos.md` §2.4). Sin normalizar, `b12345674` y `B12345674` son dos empresas distintas para la base de datos y la misma para el mundo.
2. **La respuesta del alta devuelve el identificador normalizado**, no el que se tecleó (→ `../contrato-api.md` §2.1). El comercial escribió `"b-1234 5674"` y debe ver en pantalla lo que quedó guardado.

**`toUpperCase()` sin locale, a propósito.** `toLocaleUpperCase('tr')` convierte `i` en `İ`; con locale del sistema, la misma entrada valida distinto según la máquina que corre el servidor. Los identificadores fiscales son ASCII: `toUpperCase()` y punto. Es un bug real de los que solo aparecen en producción y en un solo país.

---

## 3. El registro de estrategias

### 3.1 Estructura

```ts
type FiscalIdType = 'DNI' | 'NIE' | 'CIF' | 'unvalidated';

interface TaxIdValidator {
  readonly hint: string;                    // texto de presentación, ya resuelto
  readonly validates: boolean;              // false = PassThrough
  validate(normalizado: string): { valid: boolean; type: FiscalIdType };
}

const REGISTRO: Map<string, TaxIdValidator> = new Map([
  ['ES_NIF', new SpanishTaxIdValidator()],
]);

const PASS_THROUGH = new PassThroughValidator();
```

**La fila de `countries` dice qué esquema aplica; el registro dice cómo** (→ referencia §7.2). Añadir un país con validación = una clase + una entrada en el `Map` + rellenar `tax_id_scheme`. **Cero cambios en endpoints.**

**Las claves van espaciadas por país** (`ES_NIF`, `PT_NIF`): "NIF" existe en España y en Portugal con algoritmos distintos, y una clave `NIF` sería una colisión esperando a ocurrir. El espaciado también permite que dos países apunten **al mismo validador** con etiqueta local distinta (mismo algoritmo, otro nombre).

**El `hint` vive en el validador, no en una tabla ni en el frontend.** Es lo que hace que `GET /countries` lo sirva ya resuelto y que el cliente **nunca compare un código de país** (→ `../contrato-api.md` §3.1). El conocimiento vive junto al algoritmo: quien añade `PT_NIF` escribe su hint en la misma clase, y no hay una segunda lista que se olvide de actualizar.

### 3.2 Resolución y fallbacks

Ninguno es un `if España` (→ referencia §7.3):

| Caso | Comportamiento |
|---|---|
| País con `tax_id_scheme` no nulo, presente en el registro | Se usa ese validador |
| País con `tax_id_scheme = NULL` | **`PassThroughValidator`**: guarda tal cual, `type = 'unvalidated'`. Es una estrategia más, no una rama |
| País sin fila en `countries` | **Rechazo en la entrada**: `422 COUNTRY_NOT_SUPPORTED`. "Cliente de país no soportado" es inexpresable (→ referencia §6.1) |
| `tax_id_scheme` no nulo que **no está** en el registro | **Fallo ruidoso al arrancar** (→ `../modelo-datos.md` §4). Nunca degradar en silencio a pass-through |

**La cuarta fila es la que justifica el chequeo de arranque.** Sin él, un seed que escribe `tax_id_scheme = 'PT_NIF'` antes de que exista la clase produce el peor fallo posible: los clientes portugueses se dan de alta **sin validar**, con `unvalidated`, y nadie se entera hasta que alguien audita los datos. La deriva dato↔código es silenciosa por naturaleza; por eso se convierte en un fallo de arranque, que es todo lo contrario.

`PassThroughValidator` devuelve `{ valid: true, type: 'unvalidated' }` **siempre**. `unvalidated` es un valor de primera clase en la columna (→ `../modelo-datos.md` §2.4), no un hueco: la base de datos distingue "no se pudo comprobar" de "no se comprobó por descuido".

---

## 4. `SpanishTaxIdValidator` (`ES_NIF`)

"DNI/NIF/CIF" no es un algoritmo, son dos. El validador **detecta el tipo por formato** y aplica el control que toque (→ referencia §7.7).

**Dos niveles de despacho, pero solo el primero es Strategy** (→ referencia §7.2): el registro elige el validador del país; que dentro se distinga DNI/NIE/CIF por formato es **detección de formato dentro de una estrategia**, no otra capa de estrategias. Mantenerlo así evita la sobre-arquitectura de un registro anidado para tres formatos que solo coexisten en un país.

### 4.1 DNI — persona física

Formato: `^\d{8}[A-Z]$`. La letra es `nº mod 23` indexando en:

```
T R W A G M Y F P D X B N J Z S Q V H L C K E
0 1 2 3 4 5 6 7 8 9 …
```

`12345678` → `12345678 mod 23 = 14` → índice 14 = `Z` → `12345678Z` válido.

### 4.2 NIE — extranjero

Formato: `^[XYZ]\d{7}[A-Z]$`. Se sustituye la inicial (`X→0`, `Y→1`, `Z→2`), se concatena con los 7 dígitos y se aplica **el mismo `mod 23`**.

`X1234567` → `01234567 mod 23` → letra correspondiente.

### 4.3 CIF — persona jurídica (el caso mayoritario)

Formato: `^[ABCDEFGHJKLMNPQRSUVW]\d{7}[0-9A-J]$`.

La letra inicial es el **tipo de organización**. El conjunto excluye `I`, `O`, `T`, `Ñ` y `X`/`Y`/`Z` a propósito: `O` e `I` se confunden con `0` y `1`, y `X/Y/Z` son NIE.

**Checksum ponderado** sobre los 7 dígitos centrales (posiciones 1..7):

```
pares   (posiciones 2, 4, 6)        -> se suman tal cual                  -> A
impares (posiciones 1, 3, 5, 7)     -> se duplican y se SUMAN SUS DÍGITOS -> B
C = A + B
control_numérico = (10 - (C mod 10)) mod 10
control_letra    = "JABCDEFGHI"[control_numérico]
```

Ejemplo completo, `B12345674`:

```
dígitos      1  2  3  4  5  6  7
pares (2,4,6):    2 +  4 +  6                         = 12
impares (1,3,5,7): 1→2, 3→6, 5→10→1+0=1, 7→14→1+4=5   = 14
C = 26  ->  control = (10 - 6) mod 10 = 4  ->  "B12345674" ✓
```

**El `mod 10` exterior no es decorativo**: si `C mod 10 == 0`, `10 - 0 = 10`, que no es un dígito. Sin el segundo `mod`, todo CIF cuyo checksum acabe en 0 se valida contra "10" y se rechaza siempre. Es el off-by-one clásico de este algoritmo.

**Qué control admite cada tipo de organización** — y aquí está el detalle que casi todas las implementaciones se saltan:

| Inicial | Control |
|---|---|
| `A`, `B`, `E`, `H` | **Número** obligatorio |
| `K`, `P`, `Q`, `R`, `S`, `N`, `W` | **Letra** obligatoria |
| `C`, `D`, `F`, `G`, `J`, `L`, `M`, `U`, `V` | **Cualquiera de los dos** |

Un validador que acepte siempre ambos es **más permisivo de lo correcto** y deja pasar `A1234567J` (una S.A. con letra de control, que no existe). Se implementa la tabla: es un `switch` de tres ramas sobre el tipo de organización, no sobre el país — no vulnera ninguna regla del §5 de las directrices.

### 4.4 Recorte consciente: los NIF especiales `K`, `L`, `M`

Existen NIF de persona física que empiezan por `K` (menores), `L` (españoles no residentes) y `M` (extranjeros sin NIE), con control `mod 23` como el DNI. **No se implementan.** Motivo: la herramienta es **B2B** —se dan de alta empresas, y el CIF es el caso mayoritario (→ referencia §7.7)—; un NIF `K/L/M` no es cliente corporativo de este producto. Consecuencia asumida: un identificador `L1234567X` se rechaza como inválido, no como "no soportado". Si apareciera el caso, es una rama más en el mismo validador. → `../../03-proceso/recortes-conscientes.md`.

### 4.5 Regex: ancladas y lineales

Las tres del §4 están **ancladas** (`^…$`) y son **lineales**: sin cuantificadores anidados, sin alternancias solapadas, sin backtracking catastrófico (→ referencia §7.5). Con `maxLength: 20` en el esquema y regex lineales, el validador nunca ve una entrada que pueda hacerle daño — las dos defensas son independientes y ninguna basta sola: el `maxLength` protege del tamaño, el anclaje protege de la forma.

---

## 5. `POST /customers`

Contrato completo → `../contrato-api.md` §2.1.

### 5.1 Secuencia

1. **Esquema Fastify**: forma, tipos y `maxLength`. Falla → `400 VALIDATION_ERROR`, sin llegar al servicio.
2. **Resolver el país** en la caché de arranque. No está → `422 COUNTRY_NOT_SUPPORTED` sobre `country`.
3. **Normalizar** el `fiscal_id` (§2).
4. **Resolver el validador**: `tax_id_scheme` del país → registro; `NULL` → `PassThrough`.
5. **Validar**. `valid: false` → `422 FISCAL_ID_INVALID` sobre `fiscal_id`.
6. **Resolver el plan**. No existe → `422 PLAN_NOT_FOUND`. Archivado → `422 PLAN_ARCHIVED` (→ §5.3).
7. **Insertar** con el `fiscal_id` normalizado y el `fiscal_id_type` que devolvió el validador. Choque de UNIQUE → `409 FISCAL_ID_DUPLICATE` con el cliente existente.
8. `201` con el cliente, incluido el `fiscal_id` normalizado.

**El orden 2→4 es la feature**: el país determina el validador, y el validador determina el resultado. En ningún punto se compara `country === 'ES'`. Si un día hay que tocar este flujo para añadir un país, el diseño ha fallado.

### 5.2 El duplicado se detecta con el UNIQUE, no con un `SELECT` previo

El paso 7 **inserta y captura la violación de UNIQUE**; no consulta antes si existe. Un `SELECT` previo seguido de `INSERT` es una condición de carrera de manual: dos altas simultáneas del mismo CIF pasan las dos el `SELECT` y una revienta igual, solo que con un `500` en vez de un `409`.

Consecuencia práctica: para poder devolver `existing_customer` en el error (→ `../contrato-api.md` §2.1), **el `SELECT` se hace en el manejador del error**, cuando ya se sabe que hay duplicado y no hay carrera que perder. Se paga una consulta en el camino de fallo en vez de una en el camino de éxito, que es el que corre siempre.

### 5.3 Por qué el plan archivado **sí** es un error aquí

Un cliente nuevo no puede darse de alta en un plan archivado (`422 PLAN_ARCHIVED`), y sin embargo un cliente existente **sí** puede simular con el suyo aunque esté archivado (→ `01-motor-tramos-y-simulaciones.md` §3.1). No es una inconsistencia: archivar significa *"deja de ofrecerse a clientes nuevos; los actuales no se ven afectados"* (→ referencia §5.5), y esas dos frases son exactamente estas dos reglas. Merece estar escrito porque la simetría aparente invita a "unificar" y romper una de las dos.

---

## 6. `GET /countries`

Contrato → `../contrato-api.md` §3.1. Sirve el desplegable del alta y el hint fiscal.

- **Se sirve de la caché de arranque**: cero consultas a SQLite por petición (→ referencia §6.1). La tabla es minúscula y de solo lectura en v1.
- **El `hint` y `validated` los aporta el validador**, no la tabla: `REGISTRO.get(scheme)?.hint ?? PASS_THROUGH.hint`. Es la misma resolución que usa el alta, y por eso el hint que ve el usuario y la validación que sufre no pueden desincronizarse.
- **Orden**: alfabético por `name` con locale español (`Á` ordena junto a `A`). España primero no; el desplegable lleva búsqueda (→ `../diseño-frontend.md`, ventana 5) y un orden "útil" que nadie puede predecir es peor que uno alfabético.

---

## 7. Tests

Cubren §15 de la referencia. Se escriben **antes** que el endpoint (→ `roams-roadmap.md` §3.1).

**CIF — la batería más amplia** (caso mayoritario B2B):
- Válidos con control **numérico**: `B12345674`, `A87654323`.
- Válido con control **letra**: `P1234567E`.
- **Tipo de organización vs. tipo de control**: `A1234567J` (S.A. con letra) → **inválido**. `P12345674` (asociación con número) → **inválido**. Son los dos casos que un validador permisivo deja pasar.
- Control equivocado: `B12345675` → inválido.
- Inicial prohibida: `I12345674`, `O12345674`, `T12345674` → inválidos.
- Longitud: 6 y 8 dígitos → inválidos.
- **`C mod 10 == 0`**: un CIF cuyo checksum acabe en 0, para cazar el `10 - 0 = 10` (§4.3).

**DNI / NIE:**
- `12345678Z` válido; `12345678A` inválido (letra que no cuadra).
- Letras excluidas del alfabeto de control (`I`, `Ñ`, `O`, `U`) → inválidas.
- `X1234567L`, `Y…`, `Z…` con las tres sustituciones; una con la inicial mal sustituida → inválida.

**Normalización:**
- `"b-1234 5674"` valida y **persiste** como `"B12345674"` (→ referencia §15).
- El UNIQUE salta con la forma normalizada: alta de `"B12345674"` y luego de `"b-1234 5674"` → `409`.
- La respuesta del `201` devuelve el normalizado, no lo tecleado.

**Registro y fallbacks:**
- País sin esquema (`GB`) → `201` con `fiscal_id_type: 'unvalidated'`, sin tocar el algoritmo español.
- País inexistente (`XX`) → `422 COUNTRY_NOT_SUPPORTED`.
- **Esquema no registrado → el arranque falla.** Se prueba con una tabla de países manipulada; el test asserta que el proceso **no** arranca. Es el test que convierte "nunca degradar en silencio" de frase en garantía.

**Endpoint:**
- CIF inválido → `422` con `field: 'fiscal_id'`. El `field` es lo que la UI necesita para pintar el error junto al campo (→ referencia §13.1).
- Plan archivado → `422 PLAN_ARCHIVED`.
- `company_name` de 201 caracteres → `400` (`maxLength`), no `500`.
- Campo de más en el cuerpo → `400` (`additionalProperties: false`).

**`GET /countries`:**
- `ES` trae `validated: true` y el hint del validador español; `GB` trae `validated: false` y el hint genérico.
- El hint **no está hardcodeado en el test contra un string del frontend**: se compara con `REGISTRO.get('ES_NIF').hint`. Un test que copia el literal solo prueba que alguien lo copió dos veces.
