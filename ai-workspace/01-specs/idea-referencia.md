# Roams SaaS — Requisitos y Diseño del Sistema

> **Mantenimiento de este documento — capa REFERENCIA.**
>
> * Qué es: foto del estado ACTUAL del diseño para que cualquier programador entienda qué se construye, cómo funciona y por qué. NO es un registro de cambios ni una hoja de ruta.
> * Presente, sin fechas: nada de "(2026-..)", "última actualización", "antes era X / ahora Y", "se añadió/eliminó/decidió". El historial está en git.
> * Conserva el porqué, no el cuándo: documenta decisiones, invariantes y gotchas no obvios; fuera anécdotas y números de fase.
> * Estado, no fecha: si algo está incompleto márcalo con un estado —`(parcial)`, `(no cableado)`, `(mock)`—, nunca con una fecha.
> * Una sola casa por dato: explica aquí lo propio de este doc; lo de otra capa resúmelo en 1-2 líneas y enlaza (`→ ver X.md`). No dupliques fases ni tareas.
> * Documentos hermanos: hoja de ruta y estado → `roams-roadmap.md`; diseño de pantallas → `diseño-frontend.md`; proceso de trabajo con IA → carpeta `/ai-workspace`.

---

## 1. Qué es Roams SaaS

Herramienta **interna** para el equipo comercial de la empresa: permite registrar clientes corporativos, simular su consumo (usuarios, almacenamiento, llamadas API) y obtener presupuestos mensuales de suscripción SaaS, visualizables en múltiples divisas.

- **Usuarios**: comerciales de la empresa, **no** los clientes finales. Perfil **no técnico** → la UI prioriza claridad: sin jerga, sin exponer conceptos internos (versionado de planes, códigos de error) en crudo.
- **Piezas**: frontend SPA (dashboard) + API REST + SQLite.
- **Qué NO es**: no factura ni cobra. Produce **simulaciones/presupuestos**. La pasarela de pagos, la telemetría de consumo real y la autenticación corporativa quedan fuera de alcance (los puntos de acoplamiento para incorporarlas existen, ver §3.6, §8, §9).

**Analogía de producto**: una calculadora de costes tipo AWS. El comercial mueve los controles de demanda y ve el coste mensual resultante, desglosado y convertido a la divisa que elija.

---

## 2. Stack tecnológico

**TypeScript en ambos extremos.**

| Pieza | Elección | Por qué |
|---|---|---|
| Backend | **Node.js + Fastify** | La validación por esquema JSON es parte del contrato de cada ruta, no un middleware olvidable: una ruta sin esquema se ve en code review. En producción su gestor de errores devuelve mensajes genéricos sin stack trace por defecto (→ §14). |
| Base de datos | **SQLite** vía `better-sqlite3` | Requisito del proyecto. El driver expone sentencias preparadas como camino natural: la inyección SQL se cierra usando la API tal cual está diseñada. |
| Frontend | **React + Vite** | Escapado de HTML por defecto (→ §14). Ecosistema conocido por cualquier evaluador. |
| Compartido | **Paquete `pricing` puro** (monorepo) | El motor de tramos es UNA función pura importada por front y back. No existen dos implementaciones que puedan divergir (→ §10). |

**Por qué TypeScript y no Python**: el enunciado admite ambos. TS gana por dos motivos concretos de este proyecto: (1) el módulo de tarificación compartido elimina la divergencia front/back del preview del slider; (2) `Intl.NumberFormat` resuelve símbolos y decimales de divisa sin tablas propias (→ §4.4). La alternativa Python/FastAPI y la opción Elm (XSS inexpresable por diseño) quedan documentadas como consideradas y descartadas en `/ai-workspace`.

### 2.1 Organización del repositorio y arranque

**Monorepo con npm workspaces** — los workspaces son lo que permite que `@saas/pricing` se importe desde front y back sin publicar ni duplicar:

```
/backend            (workspace: Fastify + SQLite)
/frontend           (workspace: React + Vite)
/packages/pricing   (workspace: motor de tramos, redondeo half-up, enum Currency)
/ai-workspace       (documentación del proceso; no es workspace)
package.json        (workspaces + scripts raíz: dev, test, seed)
```

**Arranque sin fricción (el criterio del README)**: la entrega es el repositorio; el evaluador clona y arranca desde el fuente. Camino único y corto: `git clone` → `npm install` → `npm run dev` (raíz, levanta backend y frontend con `concurrently`). Piezas que lo hacen posible:

- **Seed automático en el primer arranque**: si el fichero `.db` no existe, el backend crea el esquema y lo puebla. Cero pasos manuales de base de datos.
- Versión de Node fijada con `engines` en `package.json` + `.nvmrc`.
- **Sin Docker en v1 (decisión)**: el stack no tiene dependencias de sistema que justifiquen contenedores — SQLite es un fichero, no un servicio; no hay Postgres, Redis ni colas. Un Dockerfile como camino principal añadiría fricción (exigir Docker para evaluar una app de Node puro) en lugar de quitarla. Un `docker-compose` queda como diferido documentado para cuando haya servicios reales que orquestar.
- **Sin entrega compilada**: el proceso y el código son la mayor parte de la evaluación; un build los ocultaría.

**Estructura interna del backend: vertical slicing con costuras selectivas** — cortes por feature, no hexagonal ceremonial:

```
backend/src/
  features/
    customers/     (rutas + esquemas + repo + servicio: alta y buscador)
    simulations/   (cálculo, snapshot, historial)
    plans/         (plantilla, versionado, admin)
    rates/         (proxy + caché + fallback)
    countries/
  domain/          (interfaces TaxProvider y TaxIdValidator + registro + ES_NIF y
                    PassThrough — funciones puras, SIN IO; las implementaciones que
                    tocan datos viven en infra/)
  infra/           (conexión SQLite + migración/seed; caché de arranque de countries
                    + tipo vigente; StandardCountryRateProvider leyendo de esa caché)
  server.ts        (registro de features, error handler, middleware de auth)
```

Cada feature agrupa su ruta, su esquema y su acceso a datos: código navegable y sin "archivos masivos". **Los puertos existen solo donde el cambio es seguro** — `TaxProvider` (§6.2), registro de validadores (§7.2), auth (§8), motor en `pricing` — y no en cada frontera: la hexagonal completa (DTOs con mappers, capas estrictas) en una app de once endpoints es sobre-arquitectura, y el recorte es una decisión consciente documentada en `/ai-workspace/02-arquitectura`.

El frontend es espejo: `features/` (login, search, customer, simulator, admin) + `ui/` (componentes del sistema de tokens, → `diseño-frontend.md`) + `lib/` (cliente API, sesión, formato de divisa).

---

## 3. Principios de diseño (invariantes)

1. **El backend es la única fuente de verdad** del coste, el impuesto y la validación fiscal. El frontend nunca envía importes calculados; envía **entradas** (usuarios, GB, llamadas) y el servidor calcula, redondea y persiste.
2. **El dinero se calcula, redondea y persiste en la divisa de facturación del plan** (hoy EUR en todos los planes).
3. **Ningún tipo de cambio entra jamás en un importe persistido.** *(Invariante duro; corolario: la misma simulación explica el mismo número mañana.)*
4. **La divisa de visualización no afecta al negocio.** Cambiar el desplegable no altera base, impuesto ni total.
5. **Nada de `float` para dinero.** Enteros en **unidades menores de su divisa** (`_minor`), siempre acompañados del código ISO 4217. "Céntimos" asume 2 decimales y no todas las divisas los tienen (→ §4.4).
6. **Se guarda el código ISO de la divisa, nunca el símbolo.** El símbolo es presentación y se deriva al pintar.
7. **Puntos de desacople obligatorios**: impuestos (§6), planes/tarificación (§5), autenticación (§8). Son las tres piezas que con seguridad cambiarán al integrarse con el sistema real de la empresa; cada una vive detrás de una interfaz sustituible.

```
[ Frontend / Dashboard ]  --HTTP/JSON-->  [ Backend / API REST ]  <-->  [ SQLite ]
        |                                          |
        └── importa ──> [ pkg pricing ] <── importa┘
                                                   |
                                                   └--1 vez/día--> [ open.er-api.com ]
```

---

## 4. Divisas y orden de cálculo

### 4.1 Divisa de facturación ≠ divisa de visualización

Dos conceptos distintos que **no se derivan uno del otro**:

| | Divisa de **facturación** | Divisa de **visualización** |
|---|---|---|
| Qué es | En la que está definido el precio del plan | La que el comercial elige en el desplegable |
| Quién la fija | El plan (dato en BD) | El usuario, en cada momento |
| Se persiste | **Sí**, junto a cada importe | **No, nunca** |
| Usa tipo de cambio | **Jamás** | Sí, solo para pintar |
| Hoy | EUR en todos los planes | EUR / USD / GBP / ... |

**Si algún día hay un plan con precio base en $, NO se convierte desde EUR**: se define como lista de precios independiente en USD (*price localization*, el modelo de Stripe: un `Price` tiene divisa fija y no se convierte). Motivo: un cliente que firmó a 10 $/usuario no acepta 10,73 $ el mes siguiente porque se movió el EUR/USD. Por eso la columna `currency` existe en `plans` desde el día 1 aunque hoy solo contenga `EUR`: evita que "EUR" quede como suposición invisible incrustada en treinta sitios.

### 4.2 Orden canónico de cálculo

```
1. base_minor  = tarificación del plan (tramos)              -> entero, divisa del plan
2. tax_rate_bp = tipo estándar del PAÍS DEL CLIENTE          -> entero, puntos básicos
3. tax_minor   = round_half_up(base_minor * rate_bp / 10000) -> entero, divisa del plan
4. total_minor = base_minor + tax_minor                      -> divisa del plan
5. mostrado    = total_minor * tipo_de_cambio                -> solo VISTA, no se persiste
```

**El tipo impositivo va en puntos básicos enteros** (`2100` = 21 %), no en decimal. Un `REAL` para el tipo mete el float justo en `base × rate`, que es el cálculo que el invariante 5 protege: el tipo no es dinero, pero multiplica dinero. Cuatro dígitos dan hasta dos decimales de porcentaje, suficiente para cualquier tipo estándar real (Suiza está al 8,1 % = `810`).

Por qué este orden:
- El impuesto lo determina el **país del cliente**, nunca la divisa seleccionada. Cliente en UK → VAT 20 % siempre, se muestre en EUR, USD o GBP.
- Conversión e IVA son conmutativos, **pero el redondeo no lo es**: convertir y redondear a céntimos antes del IVA arrastra error. → Redondear **una vez, al final, en la divisa de facturación**, con modo **half-up** (mitad hacia arriba), el estándar de facturación europea. El modo vive en una única función del paquete `pricing` y se testea con casos de `.5` exacto.
- Pasos 1–4 = backend. Paso 5 = presentación.

**Dónde cae el único redondeo, con precisión.** `base_minor` es `Σ (unidades × precio)`: producto y suma de enteros, exacto. La única fracción del sistema aparece en el impuesto, y por eso hay exactamente **un** redondeo. Parece que «redondear el impuesto» (paso 3) y «redondear el total» (paso 4) fueran dos lecturas distintas de este orden, y no lo son: como `base_minor` es entero, `round_half_up(base + tax_exacto) = base + round_half_up(tax_exacto)` — el mismo entero, siempre. Y la del paso 3 es la única implementable, porque `tax_minor` se persiste y una columna `INTEGER` no admite una fracción. Lo que este orden prohíbe es otra cosa: redondear **antes** de tener el total en la divisa de facturación, o redondear en la divisa de visualización.

**Futuro (pasarela de pagos)**: un tipo cacheado sirve para *enseñar*, nunca para *cobrar*. Al cobrar se revalida, se fija (*lock*) el tipo en el instante de la transacción y se persiste con el cobro.

### 4.3 Divisas soportadas: `enum Currency` estático

Un **enum estático en código**, generado a partir de la lista de la API de tipos. El admin elige de un desplegable; se guarda el código ISO 4217 (`EUR`, `JPY`), nunca el símbolo.

Por qué estático y no leído de la API en caliente: **cero acoplamiento en tiempo de ejecución**. Si el proveedor de tipos cae o deja de listar una divisa, el formulario de planes sigue funcionando. La API solo aporta tipos de cambio para mostrar; no define en qué se puede facturar.

### 4.4 `minor_unit` obligatorio en el enum

```ts
enum-like Currency {
  EUR: { code: 'EUR', minor_unit: 2 },
  JPY: { code: 'JPY', minor_unit: 0 },   // yen: sin decimales
  KWD: { code: 'KWD', minor_unit: 3 },   // dinar kuwaití: 3 decimales
  ...
}
```

Sin `minor_unit`, el problema de los decimales queda escondido, no resuelto: el desplegable permite elegir JPY y ahí `unit_price_minor` deja de ser "×100". Referencia ISO 4217: la mayoría = 2; JPY, KRW = 0; KWD, BHD, OMR, JOD, TND = 3. Cuesta un campo y cierra dos roturas futuras: el redondeo (un yen no tiene céntimos) y la pasarela (Stripe espera JPY en yenes enteros).

Los símbolos y decimales al pintar se derivan con `Intl.NumberFormat` a partir del código ISO — cero tablas de símbolos que mantener. **`currencyDisplay: 'narrowSymbol'` no es opcional**: con el `'symbol'` por defecto, `es-ES` mezcla símbolos y códigos según la divisa (`"140,00 €"` pero `"140 JPY"` y `"140,00 GBP"`), y el precio deja de ser el protagonista tipográfico que pide el diseño:

```js
const f = (c) => new Intl.NumberFormat('es-ES',
  { style: 'currency', currency: c, currencyDisplay: 'narrowSymbol' })

f('JPY').format(140)   // "140 ¥"      (sin decimales: minor_unit 0)
f('EUR').format(140)   // "140,00 €"
f('GBP').format(140)   // "140,00 £"
f('KWD').format(140)   // "140,000 KWD"  (tres decimales; sin símbolo narrow definido)
```

Contrapartida asumida: USD pasa de `"US$"` a `"$"`, ambiguo con otros dólares. Se acepta porque el importe convertido va siempre etiquetado como referencia y con su código ISO en el selector (§4.1).

**UX**: el enum puede tener 160 divisas; el desplegable muestra las habituales (EUR/USD/GBP) arriba. Cosmética, no arquitectura.

---

## 5. Planes y tarificación

### 5.1 El modelo

Varios planes; el comercial da de alta la empresa **con un plan elegido** y ese plan determina la tarificación. Los tramos del enunciado del reto son el **seed** del Plan A, no una constante del código: nº de tramos, cortes, precios y divisa son configurables por el admin y **viven en BD, nunca en código**.

- **Plan A** (seed, literal del enunciado): tramos por usuario → 10 € (0–10), 8 € (11–50), 5 € (>50).
- **Plan B** (seed): tramos por GB → 13 € (hasta 100), 7 € (hasta 500), 4 € (hasta 2.000), 2 € (>2.000).

### 5.2 La abstracción: multi-métrica

Un plan no es "una lista de precios": es **un conjunto de métricas facturables, cada una con su tabla de tramos**. Métricas soportadas: `users`, `storage_gb`, `api_calls`. Un mismo plan puede cobrar varias a la vez; el total mensual es la suma de lo que aporte cada métrica.

- Esto explica **para qué sirven** almacenamiento y llamadas API en la simulación: son métricas facturables que unos planes cobran y otros no. Las llamadas API son una **estimación que el operario ajusta**, no telemetría real.
- Extensible sin tocar el motor: añadir `ram_gb` = filas nuevas en `plan_tiers`, cero cambios en el cálculo.
- **UX**: si el plan del cliente no factura una métrica, el simulador muestra el campo igualmente indicando que no afecta al coste. Ocultarlo confunde más ("¿por qué no puedo poner el almacenamiento?").

### 5.3 Algoritmo: Graduated (Cumulative) Tiered Pricing

Cada unidad paga según el tramo en el que cae. Ejemplo Plan A con 15 usuarios: `10×10 + 5×8 = 140 €`. **NO es volume pricing** (daría 15×8 = 120 €); el ejemplo del enunciado (140 €) lo confirma.

- Patrón **Strategy** sobre el modelo de tarificación: hoy `graduated`; deja hueco a `volume` o `flat` sin tocar el resto.
- El **motor de tramos es único y agnóstico a la métrica**: recorre una tabla acumulando; no sabe si cuenta usuarios o gigas. Vive en el paquete compartido `pricing` (→ §10).

### 5.4 Plantilla de creación de planes (admin)

El admin crea un plan configurando: métrica(s), nº de tramos, cortes, precio por unidad de cada tramo y divisa de facturación. La plantilla tiene **un bloque de tramos por métrica, los tres opcionales, mínimo uno relleno**. Un bloque vacío = esa métrica no se factura (se sigue registrando en la simulación, pero aporta 0). La divisa es **del plan**, no de cada bloque.

**Validación de la plantilla (backend, obligatoria)** — en cuanto el admin decide cortes, puede meter un disparate:

- Cortes **estrictamente crecientes** · **sin huecos ni solapes** · **último tramo abierto** (`up_to = NULL` = ∞; si no, hay unidades sin precio) · al menos un tramo · precios ≥ 0 · divisa ∈ `Currency` · métrica soportada · al menos un bloque relleno.

**UX**: pedir los cortes como **"hasta cuántos usuarios"** (límite superior), no "cantidad por tramo". Más difícil de romper y es como funciona el acumulativo.

### 5.5 Ciclo de vida: versionar y archivar — un precio publicado es INMUTABLE

Ni edición libre, ni borrado físico. Es la práctica de industria (en Stripe un `Price` no permite cambiar su importe: creas uno nuevo y archivas el viejo).

Por qué "el admin edita con conocimiento de causa" no se sostiene: no es un problema de competencia del admin, es que **no puede ver las consecuencias desde su pantalla** — no sabe qué presupuestos se enviaron con ese tramo ni qué clientes están dados de alta con ese plan.

| Acción del admin | Comportamiento real |
|---|---|
| Crear | Inserta plan, `version = 1`, `active = true` |
| Editar | **Crea versión nueva** (`version+1`, activa) y archiva la anterior. Los clientes existentes **siguen apuntando al `plan_id` antiguo** |
| Borrar | **Archiva** (`active = false`). Nunca borrado físico: regla uniforme, cero problemas de integridad referencial |

**Snapshot vs versionado — complementarios, no alternativos**: el snapshot (→ §11.2) protege el **pasado** (simulaciones ya guardadas); el versionado protege el **contrato presente** (que un cliente dado de alta con el Plan A siga tarificando como su Plan A en la próxima simulación).

**UI para perfil no técnico**: nada de jerga de versionado. El admin ve "Editar plan" y un aviso: *"Los clientes actuales mantendrán la tarifa anterior. Se creará una nueva versión."* Los planes archivados no aparecen al dar de alta clientes nuevos, pero sí en el histórico.

---

## 6. Países e impuestos

### 6.1 La tabla `countries` como entidad agregadora

El país no es un string suelto: agrupa tres datos que otras piezas consumen — el tipo impositivo, el esquema de identificador fiscal y la divisa habitual de presentación. Vive en **una tabla SQL**, no en un enum:

- **`countries`**: `code` (ISO 3166-1 alfa-2, PK), `name`, `tax_id_scheme` (clave del registro de validadores → §7.2; `NULL` = sin validación), `display_currency` (ISO 4217, **solo presentación**: preselecciona el desplegable de divisas del cliente; **jamás** afecta a la facturación, que es del plan → §4.1)

**La línea divisoria dato/código**: lo que cambia sin desplegar (cobertura de países, tipos impositivos) es **dato** → tabla. Lo que es lógica (los algoritmos de checksum) es **código** → registro de validadores (§7.2). La tabla solo guarda la **clave** que los conecta.

**La fuente de países válidos ES la cobertura fiscal**: solo se puede dar de alta un cliente de un país con fila en `countries` y tipo en `tax_rates`. Una sola fuente, y el caso "cliente sin impuesto calculable" es inexpresable. El desplegable del formulario de alta se alimenta de `GET /countries`.

**Rendimiento (no-problema, explícito)**: la tabla es minúscula — el seed lleva ~10 países, y aunque llevara los ~200 del mundo serían unos KB — y de solo lectura en v1. Al arrancar se carga **una vez en un `Map` en memoria** cada país **junto con su tipo impositivo vigente ya resuelto** (`code → { name, scheme, display_currency, rate_vigente }`); validación y cálculo hacen lookups O(1) sin tocar SQLite por petición. **Supuesto declarado**: en v1 los tipos impositivos solo cambian vía seed/redeploy (no hay panel de administración de impuestos), así que caché-hasta-reinicio es correcta; el día que exista ese panel, la escritura debe invalidar la caché.

**Chequeo de integridad en el arranque (doble, fallo ruidoso)** — convierte los "inexpresables" en garantías, no en afirmaciones:

1. Todo `tax_id_scheme` no nulo debe existir en el registro de validadores (→ §7.3).
2. Todo país de `countries` debe tener un tipo vigente en `tax_rates`. Sin esto, "cliente sin impuesto calculable es inexpresable" sería solo una frase.

### 6.2 Tipo impositivo

- Tipo **estándar por país**. Tabla `tax_rates` (PK compuesta `(country, vigente_desde)`, `country` FK → `countries.code`, `rate_bp` en **puntos básicos enteros**, → §4.2) — separada de `countries` para conservar el histórico de tipos. **Regla de vigencia declarada**: la fila vigente es la de mayor `vigente_desde` ≤ hoy. Una fila con fecha **futura** es legítima —un tipo anunciado y no aplicable aún— y **no debe aplicarse**: el `<= hoy` no es cosmético.
- **Desacoplado obligatorio**: el cálculo pide el tipo a una interfaz (`TaxProvider`, en `domain/`), no a una constante ni a un `if`. La implementación actual, `StandardCountryRateProvider`, vive en `infra/` y lee de la caché de arranque (§6.1) — sin IO por petición; mañana un `VIESProvider` con *reverse charge* intracomunitario se enchufa sin tocar el motor.
- **Se persiste el `tax_rate_bp` aplicado**, no solo el importe: si el IVA español pasa del 21 % al 22 %, las simulaciones viejas deben seguir explicando su número. Y se persiste **el valor**, no una FK a `tax_rates`: una FK seguiría apuntando a «el tipo de España» y la simulación vieja cambiaría de explicación. Es el mismo motivo que el snapshot (§11.2), aplicado al impuesto.

---

## 7. Validación del identificador fiscal

### 7.1 El problema es por-país, no solo español

El reto exige validación estricta para España, pero "identificador fiscal" es un concepto distinto en cada país, con tres trampas conocidas: **colisión de nombres** ("NIF" existe en España y en Portugal con algoritmos distintos), **mismo algoritmo con distinto nombre local**, y la mayoritaria: **países sin algoritmo implementado** (probablemente nunca lo tendrán).

### 7.2 Diseño: registro de estrategias por esquema

- Interfaz **`TaxIdValidator`**: `validate(id_normalizado) → { valid, type }`, más un **`hint` de presentación** (p. ej. `ES_NIF` → "DNI, NIE o CIF — se comprueba automáticamente"; `PassThroughValidator` → "Identificador fiscal"). El hint viaja ya resuelto en `GET /countries` (→ §12): el frontend pinta lo que recibe y **nunca compara códigos de país** — el conocimiento vive junto al algoritmo, el mismo principio que §7.3 impone al backend.
- **Registro en código**: `Map<scheme, TaxIdValidator>` — p. ej. `'ES_NIF' → SpanishTaxIdValidator`. Las claves van **espaciadas por país** (`ES_NIF`, `PT_NIF`), lo que disuelve la colisión de nombres; y dos países pueden apuntar **al mismo validador** con etiqueta local distinta (mismo algoritmo, distinto nombre).
- La fila de `countries` dice **qué esquema aplica** (`tax_id_scheme`, → §6.1); el registro dice **cómo**. Añadir la validación de un país = una clase + una entrada en el registro + rellenar la columna. Cero cambios en endpoints.
- **Dos niveles de despacho, pero solo el primero es Strategy**: el registro elige el validador del país; que el validador español distinga internamente DNI/NIE/CIF por formato es **detección de formato dentro de una estrategia**, no otra capa de estrategias. Mantenerlo así evita sobre-arquitectura.

### 7.3 Fallbacks (explícitos, ninguno es un `if España`)

| Caso | Comportamiento |
|---|---|
| País con `tax_id_scheme = NULL` | **`PassThroughValidator`**: guarda tal cual, `fiscal_id_type = 'unvalidated'`. Es una estrategia más del registro, no un `if` |
| País sin fila en `countries` | **Rechazo en la validación de entrada**: "cliente de país no soportado" es inexpresable (→ §6.1) |
| La tabla referencia un esquema que NO está en el registro (deriva dato↔código) | **Fallo ruidoso al arrancar** — chequeo de integridad en el startup. Nunca degradar en silencio a pass-through |

### 7.4 Normalización y unicidad

- **Normalizar antes de validar**: mayúsculas, sin espacios ni guiones (`"b-1234 5678"` ≡ `"B12345678"`). **Se persiste la forma normalizada.** Es el gotcha clásico que rompe validaciones con datos reales tecleados por humanos.
- **`fiscal_id` es UNIQUE** en `customers` (sobre la forma normalizada): dos altas con el mismo identificador son casi con certeza un duplicado accidental, y el error resultante es explicable al comercial ("esta empresa ya existe").

### 7.5 Topes anti-DoS

Ninguna validación procesa entrada sin acotar:

- **`maxLength` declarado en el esquema Fastify** de cada campo: `fiscal_id` ≤ 20, `company_name` ≤ 200, `email` ≤ 254, término de búsqueda ≤ 100. El validador nunca ve entradas arbitrariamente largas.
- Expresiones regulares **ancladas y lineales** (sin backtracking catastrófico → sin ReDoS).
- Límite de tamaño del cuerpo de la petición en Fastify.

### 7.6 Alcance: qué se valida y qué NO

**SÍ**: que el identificador es **estructuralmente válido** y su **carácter de control cuadra**, según el esquema del país.
**NO (no-objetivo explícito)**: que el identificador **exista** o pertenezca a alguien. No se consulta AEAT ni VIES. Conviene dejarlo escrito porque es un malentendido clásico con perfiles no técnicos ("pero si el sistema lo validó, ¿no?"): el `mod 23` dice que la letra cuadra con los dígitos, no que ese DNI se haya emitido nunca.

### 7.7 El esquema español (`ES_NIF`) — implementación propia, el enunciado lo exige

"DNI/NIF/CIF" no es un algoritmo, son dos; el validador **detecta el tipo por formato** y aplica el control que toque:

- **DNI** (persona física): 8 dígitos + letra. Letra = `nº mod 23` indexando en `TRWAGMYFPDXBNJZSQVHLCKE`.
- **NIE**: empieza por `X`/`Y`/`Z` → sustituir `X→0, Y→1, Z→2` y mismo `mod 23`.
- **CIF / NIF jurídico** (empresas): letra de organización + 7 dígitos + control. **Checksum ponderado distinto**: pares + impares duplicados con reducción de dígitos; el control es número, letra (`JABCDEFGHI`) o cualquiera según el tipo de organización.

Al ser B2B, el **CIF será el caso mayoritario** → el mejor testeado. Batería de tests con válidos e inválidos de cada tipo (→ §15).

---

## 8. Autenticación: sesión real, identidad enchufable

### 8.1 Comportamiento

- Pantalla de login: usuario + contraseña. Credenciales de **demostración** (declaradas en pantalla): cualquier usuario con `1111`; el usuario `ADMIN` obtiene rol admin.
- El login abre una **sesión de servidor** (cookie `HttpOnly` + `SameSite=Strict`, caducidad absoluta de 12 h); el dashboard saluda "Hola {nombre}" y un F5 no pierde la sesión (`GET /auth/session` rehidrata).
- **Toda la API exige sesión** salvo el propio login (`401 AUTH_REQUIRED`); las rutas de administración exigen además rol admin (`403 AUTH_FORBIDDEN`). Detalle → `features/07-autenticacion.md`.
- Cerrar sesión revoca en el servidor (la cookie deja de valer al instante) y vuelve al login.

### 8.2 La línea que parte el auth en dos

**Contexto**: no se conocen ni los datos ni el sistema de identidad interno de la empresa, y eso no ha cambiado. Lo que se hace es partir la feature por la línea dato/código de siempre, aplicada a la identidad (→ ADR 0009):

- **Lo incognoscible** —quién es usuario, cómo se autentica de verdad (SSO/LDAP/OIDC)— vive detrás del puerto **`IdentityProvider`** (`authenticate(usuario, password) → { nombre, rol } | null`). La implementación de hoy es la de demostración; conectar el sistema real = **otra implementación del puerto**, cero cambios en sesión, rutas o enforcement.
- **Lo invariante** —cómo viaja la identidad, dónde vive la sesión, quién aplica el rol— está construido y es definitivo: no depende de nada que la empresa tenga que contarnos.

Reglas concretas que se conservan del diseño original:
1. El rol lo deriva **el servidor, una sola vez, en el login**. `"ADMIN"` aparece una única vez en el sistema (el `MockIdentityProvider`) y **cero** en el frontend; dos tests lo vigilan.
2. Los componentes preguntan `hasRole('admin')`; el gating visual es UX **sobre** la autorización real del backend, no en vez de ella.
3. La divisa de visualización y el tema siguen siendo estado del cliente: preferencias del rato de trabajo, no identidad.
4. Sigue sin haber tablas de usuarios ni hash de contraseñas: no hay usuarios que modelar hasta conocer el IdP.

### 8.3 Riesgos: cerrados y restantes

1. ~~Un rol comprobado solo en frontend no es seguridad~~ — **cerrado**: los endpoints de admin devuelven 401/403 en el backend, con el CSRF cubierto por `SameSite=Strict` + comprobación de `Origin` en mutaciones.
2. **La credencial `1111` es pública y se declara**: el sistema es "seguridad real con credenciales de demostración". La estructura (sesión, revocación, rate limit del login) es la definitiva; el secreto no lo es y no se pretende.
3. **El nombre en presupuestos sigue sin ser auditable**: la identidad no se verifica contra ningún sistema. Se cierra el día del IdP real (→ diferido).
4. Las sesiones viven en memoria y **mueren al reiniciar el servidor**: volver a entrar. Mismo criterio que la caché de tipos (§9).

→ El README declara el estado tal cual: qué protege de verdad y qué es demostración (→ §14).

---

## 9. Tipos de cambio: proxy en backend con caché de servidor

La interfaz consume tipos de cambio de `open.er-api.com/v6/latest/EUR` **a través del backend** (`GET /rates`), que actúa como capa de caché (*cache-aside* / BFF).

**El motivo principal es de negocio, no técnico**: con caché en el navegador, dos comerciales pueden cotizar al mismo cliente con tipos distintos el mismo día (uno abrió el navegador ayer, el otro hoy). La caché de servidor garantiza que **todo el equipo ve el mismo número a la misma hora**. Además: una llamada real al día (no una por navegador), un único punto de fallback, cero CORS, y el proveedor externo no se expone al cliente (si mañana exige API key, no se filtra).

**Sobre la literalidad del enunciado** ("la interfaz debe conectar con una API pública"): se sigue cumpliendo — la interfaz consume tipos de una API pública; el backend es una capa intermedia estándar. La desviación de la letra se documenta con su porqué en el README: eso no es saltarse el requisito, es ingeniería.

**TTL y payload:**
- La API expone `time_last_update_unix` / `time_next_update_unix`; los datos son inmutables ~1 día. **TTL = `time_next_update_unix`**: caducar ahí, alineado con su ciclo real, no a 24 h fijas adivinadas.
- **Fallback**: si la API cae, servir el último tipo conocido **marcado visiblemente como desactualizado**. Un dashboard que enseña un número viejo en silencio es peor que uno que avisa.
- **Payload**: ~160 divisas, se usan unas pocas → filtrar a las soportadas al recibir y guardar solo esas.
- Si hiciera falta una cruzada (plan en USD): la API tiene base EUR → `USD→GBP = rates[GBP] / rates[USD]`.

---

## 10. Simulación interactiva: preview híbrido con módulo compartido

El slider debe reflejar la proyección "en tiempo real" (literal del enunciado, y la fluidez del frontend es criterio de evaluación).

**Decisión: híbrido con módulo único.**

- El frontend obtiene vía `GET /customers/{id}` **el plan del cliente embebido con sus tramos** (aunque esté archivado, → §12) y el `tax_rate_bp` de su país, y vía `GET /rates` los tipos de cambio. Mientras se arrastra el slider, el preview se calcula **en local**: lookup en memoria + recorrido de tramos → 0 ms.
- Al guardar, `POST /simulations` recibe **solo las entradas** (usuarios, GB, llamadas) — nunca importes — y el backend recalcula desde cero, redondea (§4.2) y persiste con snapshot. **Su número manda**; si difiere del preview, el front muestra el del backend.
- **No hay dos implementaciones**: el recorrido de tramos es una función pura del paquete compartido `pricing`, importada por front y back. La divergencia es inexpresable, no mitigada. (Un test de paridad se mantiene como cinturón y tirantes → §15.)
- Los **parámetros** (precios, cortes, tipos) tienen una sola fuente: la BD, servida por el backend. El front nunca los define.

Alternativas descartadas: preview solo-frontend (violaría el invariante #1: el cliente produciría el número persistido) y `POST /simulations/preview` con debounce (una sola fuente de verdad, pero ~200-250 ms de retardo perceptible al arrastrar + ráfaga de peticiones; con el módulo compartido su única ventaja desaparece).

---

## 11. Modelo de datos

### 11.1 Tablas

- **`countries`**: `code` (ISO 3166-1 alfa-2, PK), `name`, `tax_id_scheme` (NULL = sin validación), `display_currency` (solo presentación) — → §6.1
- **`customers`**: `id`, `company_name`, `fiscal_id` (**UNIQUE**, forma normalizada → §7.4), `fiscal_id_type` (resultado de la validación: DNI/NIE/CIF/`unvalidated`), `email`, `country` (FK → `countries.code`), `plan_id` (FK), `created_at`
- **`plans`**: `id`, `name`, `version`, `description`, `pricing_model` (`graduated`), `currency` (ISO, ∈ `Currency`), `active`, `created_at`
- **`plan_tiers`**: `id`, `plan_id` (FK), `metric` (`users`|`storage_gb`|`api_calls`|...), `up_to` (NULL = ∞), `unit_price_minor`, `sort_order`
- **`tax_rates`**: PK `(country, vigente_desde)`, `country` (FK → `countries.code`), `rate_bp` — vigente = mayor `vigente_desde` ≤ hoy (§6.2)
- **`simulations`**: `id`, `customer_id` (FK), `active_users`, `storage_gb`, `api_calls`, `plan_id`, `pricing_snapshot` (JSON), `currency`, `base_minor`, `tax_rate_bp`, `tax_minor`, `total_minor`, `created_at`

Plan A = 3 filas `metric='users'`; Plan B = 4 filas `metric='storage_gb'`; plan multi-métrica = filas de varias métricas, el motor las suma sin enterarse. Los importes usan sufijo **`_minor`** (unidades menores de *su* divisa), no `_cents`: "cents" asume 2 decimales y no es cierto para todas las divisas (§4.4).

Índices: `customers.company_name` y `customers.fiscal_id` (el buscador ataca esos dos campos).

### 11.2 Snapshot: la decisión clave

Como los planes son datos editables (con panel admin, editables **en caliente**), una simulación guardada **no puede depender de leer el plan actual** para explicarse. Cada simulación guarda **el resultado + un `pricing_snapshot`** con los tramos y el tipo impositivo usados: una **foto inmutable del momento**. Sin snapshot, un admin tocando un tramo alteraría presupuestos ya enviados a clientes. (Relación con el versionado → §5.5.)

---

## 12. API REST

**Requeridos por el enunciado**
- `POST /customers` — Alta. Valida `fiscal_id` **antes de guardar** si `country == ES` (§7).
- `POST /simulations` — Registra simulación de coste mensual: calcula tramos + impuesto y persiste con snapshot (§10, §11.2).

**Necesarios para el frontend**
- `GET /countries` — Países soportados: código, nombre, `display_currency` y **`fiscal_id: { validated, hint }` ya resuelto por el validador del país** (§7.2). El desplegable y el hint del alta se pintan de aquí, sin ningún `if (país)` en el cliente.
- `GET /customers?search=...` — Buscador por nombre o fiscal_id.
- `GET /customers/{id}` — Detalle. **Embebe el plan del cliente con sus tramos** (aunque esté archivado — un cliente puede apuntar a una versión antigua, §5.5) **y el `tax_rate_bp` de su país**: todo lo que el preview local necesita en una sola petición (§10).
- `GET /customers/{id}/simulations` — Historial (cards).
- `GET /plans` — Planes **activos** con sus tramos: listados y alta de clientes. Acepta **`?include_archived=true`** para el panel de administración (Ventana 6) — parámetro y no endpoint aparte porque el recurso es el mismo; el parámetro exige rol admin **de verdad** (403, §8.3). El plan de un cliente concreto se obtiene por su detalle, no por aquí.
- `GET /rates` — Proxy de divisas (§9).

**Admin**
- `POST /plans` — Crear plan desde plantilla; valida tramos (§5.4).
- `PUT /plans/{id}` — "Editar" → crea versión nueva y archiva la anterior (§5.5).
- `DELETE /plans/{id}` — Archiva (`active=false`), no borra.

El `enum Currency` es estático y vive en el paquete compartido: una sola definición, sin endpoint.

Contrato detallado (esquemas de petición/respuesta, códigos de error) → `/ai-workspace/01-specs`.

---

## 13. Frontend — Dashboard comercial

Perfil no técnico → prioridad a la claridad. Diseño de pantallas → `diseño-frontend.md`.

- **Login** (§8) + saludo "Hola {nombre}" + paneles admin condicionados por `hasRole('admin')`.
- **Buscador** por nombre de empresa o identificador fiscal (con *debounce*).
- **Cards responsive**: datos del cliente + historial de simulaciones.
- **Simulador**: slider/controles por métrica con preview en tiempo real (§10) y conversión a la divisa seleccionada.
- **Selector de divisa**: consume `GET /rates`; el cambio es **solo visual** (§4.1) y el importe convertido se marca siempre como **referencia**, no divisa de facturación. **Preselección — la elección manual manda**: la sesión guarda `{ currency, source: 'auto' | 'manual' }`; arranca en EUR con `source: 'auto'`; al entrar en la ficha de un cliente se preselecciona su `display_currency` (§6.1) **solo si `source === 'auto'`**; en cuanto el comercial elige una divisa a mano, `source` pasa a `'manual'` y nada la vuelve a cambiar en toda la sesión.
- **Desglose visible**: mostrar "10 usuarios × 10 € + 5 × 8 €" en vez de un total opaco. Un comercial tiene que poder **explicar el número al cliente por teléfono**.

### 13.1 Estados de carga y error (criterio de evaluación explícito)

Cada llamada define sus tres estados — cargando / éxito / error:

- `GET /rates`: skeleton mientras carga; si falla → selector deshabilitado o caída a EUR con aviso visible. Tipos servidos desde fallback → badge **"tipos desactualizados (fecha)"**; nunca un número viejo en silencio.
- Buscador: estado vacío ("sin resultados") ≠ error de red. Mensajes distintos.
- `POST /customers` / `POST /simulations`: botón deshabilitado durante el envío; errores de validación (fiscal_id inválido) **junto al campo**, no en alert genérico.

---

## 14. Seguridad — modelo de amenazas

Herramienta interna sin datos de pago; el modelo de amenazas es acotado y **explícito**. Tres categorías:

### 14.1 Superficie eliminada por diseño
- **Sin WebSockets**: el "tiempo real" del slider es cálculo local (§10) y los tipos se refrescan a diario. La clase entera de vulnerabilidades de canal persistente (hijacking, auth por cabecera no revalidada) no existe porque el canal no existe.
- **Sin CORS abierto ni proveedor expuesto**: el proxy (§9) hace que el navegador solo hable con el propio backend. En desarrollo esto se mantiene literal con el **proxy de dev de Vite** hacia el backend (mismo origen para el navegador): nadie debe "arreglar" el cruce de puertos 5173↔3000 abriendo CORS con `*`.
- **Sin SSRF**: la única URL externa es fija, en configuración del servidor; ninguna entrada del usuario compone URLs.

### 14.2 Vectores cerrados por defecto por el stack
- **Inyección SQL (OWASP A03)**: `better-sqlite3` con sentencias preparadas en el 100 % de las consultas. Único cuidado no cubierto por la parametrización: escapar `%` y `_` del término de búsqueda en el `LIKE` del buscador.
- **Validación de entrada**: esquema JSON declarado en **cada** ruta Fastify (email, `usuarios >= 0`, país ∈ `countries`, plan existente…). Una ruta sin esquema es visible en review.
- **Topes anti-DoS**: `maxLength` en todos los campos de texto, regex ancladas sin backtracking catastrófico y límite de cuerpo de petición (→ §7.5).
- **XSS**: React escapa por defecto; `dangerouslySetInnerHTML` prohibido por regla de ESLint. Remate: **CSP estricta sin `unsafe-inline`**, enviada como **cabecera** desde Vite (`server` y `preview`) — no como `<meta>`, porque `frame-ancestors` no funciona en meta y es lo que cierra el clickjacking.

  **Es barata porque el resto del diseño la hizo barata**, y esa es la lección: el proxy de divisas (§9) hace que `connect-src 'self'` baste, y auto-alojar la fuente hace que `font-src 'self'` baste. Sin esas dos decisiones, la CSP necesitaría abrir hosts. Verificado recorriendo la app bajo `style-src 'self'`: cero violaciones.

  **Lo que la CSP NO cubre, dicho sin adornos**: el modo dev de Vite exige `'unsafe-inline'` en `script-src` (inyecta el preámbulo de React Refresh en línea) y en `style-src` (inyecta el CSS por JS). Con eso, **la CSP de desarrollo no defiende de un XSS**, y llamarla estricta sería teatro. Se mantiene porque las demás directivas siguen enteras y hacen de **alarma de deriva**: el día que alguien añada una fuente de Google o un script de terceros, revienta en desarrollo. La CSP real es la del build, y se comprueba con `npm run preview`.
- **Fuga de información (tu stack trace)**: gestor de errores de producción devuelve mensajes genéricos con código; el detalle va al log del servidor, nunca al cliente.

### 14.3 Riesgos aceptados y documentados
- **Credenciales de demostración** (§8.3): la sesión, la revocación y el 401/403 de los endpoints de admin son reales; lo que no verifica nada es el `IdentityProvider` de demostración (`1111`, pública y declarada). El nombre en presupuestos no es auditable hasta conectar el IdP real.
- **Cadena de suministro npm**: dependencias mínimas, lockfile commiteado, `npm audit` en CI + cron, Dependabot y CodeQL.
- La cookie de sesión va **sin `Secure` en local** (no hay HTTPS); detrás de un proxy TLS se añade.

---

## 15. Calidad — tests mínimos

- **Validación fiscal** por tipo (DNI/NIE/CIF), válidos e inválidos de cada uno; el CIF con la batería más amplia (caso mayoritario B2B).
- **Normalización**: `"b-1234 5678"` valida y persiste igual que `"B12345678"`; el UNIQUE salta sobre la forma normalizada (§7.4).
- **Fallbacks del registro**: país sin esquema → `unvalidated`; país inexistente → rechazo; esquema no registrado → el arranque falla (§7.3).
- **Integridad de arranque (doble)**: país sin tipo vigente en `tax_rates` → el arranque falla; regla de vigencia: con dos filas, se aplica la de mayor `vigente_desde` ≤ hoy y nunca una futura (§6.1, §6.2).
- **Motor de tramos + impuesto, incluyendo bordes**: 0 usuarios, exactamente 10, exactamente 50, 51; multi-métrica (suma de bloques); métrica no facturada aporta 0.
- **Redondeo**: half-up con caso de `.5` exacto (§4.2), y el total persistido no cambia según la divisa de visualización.
- **Validación de plantilla**: cortes no crecientes, huecos, solapes, último tramo cerrado, 0 tramos, 0 bloques (§5.4).
- **Versionado**: editar un plan no altera simulaciones guardadas ni el plan de clientes ya dados de alta (§5.5).
- **Paridad preview/persistencia**: misma batería de casos por la función compartida invocada desde front y back (cinturón y tirantes del módulo único, §10).
- **Buscador**: término con `%`/`_` no se comporta como comodín; término por encima de `maxLength` se rechaza (§7.5, §14.2).

---

## 16. Documentos hermanos y proceso

- Hoja de ruta, fases y estado → `roams-roadmap.md`.
- Diseño de pantallas para Claude Design → `diseño-frontend.md`.
- Proceso de trabajo con IA (specs por feature, directrices de arquitectura, hilos y auditorías) → `/ai-workspace`. El README del repo enlaza aquí y documenta: arranque en local, decisión del proxy (§9), auth mock (§8.3) y preview híbrido (§10).
