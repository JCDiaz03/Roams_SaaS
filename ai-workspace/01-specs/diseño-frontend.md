# Roams SaaS — Diseño del Frontend (brief para Claude Design)

> **Mantenimiento — capa DISEÑO FRONTEND.**
>
> * Qué es: brief de diseño de las pantallas del dashboard, dirigido a Claude Design. Describe QUÉ ventanas hay, qué contiene cada una y con qué lenguaje visual. NO es documentación de implementación ni registro de cambios.
> * **Estado: el diseño ya existe** (`SaaS-O-Matic.dc.html`, importado vía el MCP de Claude Design) y las 5 ventanas de Fase 1 están implementadas. Este brief se conserva como el *encargo*; lo que se construyó y sus desviaciones están abajo, en §7.
> * Presente, sin fechas: nada de "(2026-..)", "antes era X / ahora Y". El historial está en git.
> * Estado, no fecha: lo incompleto se marca —`(pendiente de diseño)`, `(solo tema claro)`—, nunca con una fecha.
> * Una sola casa por dato: los porqués de negocio (divisas, tramos, roles) viven en `idea-referencia.md`; aquí solo se resume en 1-2 líneas lo imprescindible para diseñar y se enlaza (`→ referencia §X`). Fases y estado → `roams-roadmap.md`.
> * Este documento debe ser **autosuficiente para diseñar**: Claude Design no leerá los documentos hermanos.

---

## 1. Contexto en 5 líneas

**Roams SaaS** es una herramienta interna para comerciales (perfil **no técnico**): dan de alta clientes corporativos, simulan su consumo (usuarios, GB, llamadas API) con sliders y obtienen un presupuesto mensual desglosado, visualizable en distintas divisas. Hay un rol `admin` que además gestiona los planes de precios. Prioridades: **claridad sobre densidad**, números explicables ("el comercial debe poder leer el desglose por teléfono a un cliente"), y cero jerga técnica en pantalla.

---

## 2. Lenguaje visual: base Roams

El diseño toma como referencia la web corporativa de Roams (roams.es) y sus comparadores (tarifas móvil, seguros de coche, luz y gas). **Inspiración de lenguaje, no clonación**: ni el logo ni los assets de Roams se reutilizan; Roams SaaS lleva su propio wordmark simple dibujado con la misma personalidad.

### 2.1 Personalidad

Cercana, ordenada y luminosa. Mucho blanco, tarjetas redondeadas con sombra suave, botones píldora con icono, iconografía de línea fina (estilo Untitled UI, que es la que usa Roams), precios como protagonistas tipográficos. Todo comunica "comparador de confianza": datos claros, fuente visible, sin ruido.

### 2.2 Tokens (base tema claro)

**Nota para Claude Design**: los valores son una **aproximación descriptiva** al branding de Roams (el CSS exacto no es público); trátalos como punto de partida ajustable manteniendo la personalidad. Definir TODO como variables CSS semánticas — el tema oscuro es un intercambio de variables, nunca estilos duplicados.

| Token | Tema claro (base Roams) | Uso |
|---|---|---|
| `--color-primary` | Fucsia/magenta intenso (≈ `#E6007E`) | CTAs, enlaces, slider activo, foco |
| `--color-primary-soft` | Fucsia al ~8-12 % | Fondos de chip/hover, highlights |
| `--color-ink` | Azul muy oscuro casi negro (≈ `#1B1B3A`) | Titulares y texto principal |
| `--color-text-2` | Gris azulado medio | Texto secundario, labels |
| `--color-bg` | Blanco roto / gris muy claro (≈ `#F7F7FA`) | Fondo de página |
| `--color-surface` | Blanco | Tarjetas, paneles, inputs |
| `--color-border` | Gris claro (≈ `#E5E7EB`) | Bordes de tarjeta e input |
| `--color-success` | Verde | Validación OK, badge activo |
| `--color-warning` | Ámbar | Tipos de cambio desactualizados |
| `--color-danger` | Rojo | Errores de validación y de red |
| `--radius-card` | 16 px | Tarjetas y paneles |
| `--radius-pill` | 999 px | Botones y chips |
| `--shadow-card` | Sombra suave difusa | Elevación de tarjetas |
| Tipografía | Sans geométrica/humanista (Poppins o Inter) | Títulos semibold; **precios en bold de gran tamaño** |

### 2.3 Tema oscuro (obligatorio)

- Conmutador **sol/luna en la topbar**, visible en todas las ventanas incluida la de login. Implementación: atributo `data-theme` en la raíz + intercambio de variables. La preferencia vive en el estado de sesión (nunca en localStorage en prototipos de artifact).
- Derivación: `--color-bg` → azul-gris muy oscuro (≈ `#141425`), `--color-surface` → un paso más claro (≈ `#1E1E32`), `--color-ink` → blanco roto, bordes sutiles **sustituyen a las sombras** como mecanismo de elevación. El fucsia primario se mantiene (subir ligeramente la luminosidad si hace falta contraste sobre oscuro).
- Requisito duro: **contraste AA en ambos temas**, incluidos los estados deshabilitados y los badges.
- Toda pantalla se entrega **en ambos temas**.

### 2.4 Patrones Roams a replicar (extraídos de sus comparadores)

Estos cinco patrones son la identidad estructural de Roams y se reutilizan tal cual:

1. **Tarjeta de resultado/producto**: logo o avatar a la izquierda; título; **chips/badges** de atributos ("Sin permanencia" → aquí "Plan A · v2", "ES"); filas de especificación `valor destacado + label pequeño debajo` ("25GB / Datos incluidos" → aquí "42 / Usuarios activos"); **precio grande a la derecha** con sufijo pequeño ("140,25 **€/mes** · IVA incluido"); CTA píldora.
2. **Barra de herramientas de listado**: acciones "Filtrar / Ordenar / Nueva búsqueda" con icono + contador "**N resultados encontrados** para los filtros seleccionados". Aquí: la cabecera del buscador y del historial de simulaciones.
3. **Calculadora interactiva con resultado vivo** (su "Tu respiro a final de mes"): controles a la izquierda, panel de **resultado grande y protagonista** que se actualiza en tiempo real. Es exactamente nuestro simulador.
4. **Callout de consejo** (su "Nuestra opinión experta" / banner de expertos con icono): caja destacada con fondo suave e icono para notas contextuales. Aquí: "esta métrica no afecta al coste en este plan", "importe convertido: solo referencia".
5. **Tabla comparativa con metodología**: tabla con scroll horizontal (chevrons) y pie "Fuente / cómo se calcula". Aquí: el desglose de tramos del simulador con su pie explicativo.

---

## 3. Arquitectura de navegación

**7 ventanas** + componentes globales. Flujo: Login → Dashboard (buscador) → Detalle de cliente → Simulador. El alta de cliente y las dos ventanas de admin cuelgan de la topbar.

```
[1 Login] ──> [2 Dashboard/Buscador] ──> [3 Detalle cliente] ──> [4 Simulador]
                    │
                    ├──> [5 Alta de cliente]
                    └──(solo admin)──> [6 Planes admin] ──> [7 Crear/editar plan]
```

### Componentes globales (presentes en 2–7)

- **Topbar**: wordmark Roams SaaS (izq.) · buscador global compacto · **selector de divisa de visualización** (desplegable con banderita/código ISO; divisas habituales arriba) · conmutador claro/oscuro · "Hola, {nombre}" con menú (Cerrar sesión; entrada "Administración" solo si rol admin). **Regla del selector — la elección manual manda**: arranca en EUR; al abrir la ficha de un cliente se preselecciona la divisa habitual de su país **solo si el comercial no ha elegido ninguna a mano en esta sesión**; tras una elección manual, la divisa no cambia sola nunca (ni al navegar entre clientes).
- **Badge global de tipos desactualizados** `(estado condicional)`: si los tipos de cambio vienen de fallback, píldora ámbar persistente junto al selector de divisa: "Tipos de cambio del {fecha}". Nunca se ocultan importes convertidos en silencio.
- **Sistema de estados** (obligatorio en toda llamada): *cargando* = skeletons con la silueta del contenido (nunca spinner a pantalla completa); *vacío* ≠ *error* — ilustración ligera + texto distinto; *error de validación* = mensaje junto al campo en `--color-danger`; *error de red* = banner con botón "Reintentar".
- **Toast** de confirmación (guardados) y de error no bloqueante.

---

## 4. Inventario de ventanas

### Ventana 1 — Login

- **Propósito**: acceso mock (usuario libre + contraseña; `ADMIN` desbloquea administración). No aparentar seguridad que no hay: limpio y neutro, sin candados dramáticos.
- **Estructura**: pantalla centrada, tarjeta única (max ~420 px) sobre `--color-bg`; wordmark arriba; campos Usuario y Contraseña; CTA píldora primaria "Entrar" a ancho completo; conmutador de tema en la esquina.
- **Estados**: contraseña incorrecta → mensaje bajo el campo ("Contraseña incorrecta"); botón deshabilitado durante el envío.

### Ventana 2 — Dashboard / Buscador

- **Propósito**: encontrar un cliente por nombre de empresa o identificador fiscal; puerta de entrada tras el login.
- **Estructura**: saludo grande "Hola, {nombre}" + subtítulo de contexto; **barra de búsqueda protagonista** (icono lupa, placeholder "Busca por empresa o identificador fiscal…", debounce); debajo, barra de herramientas patrón Roams con contador "N resultados"; **lista de tarjetas de resultado** (patrón 2.4.1): avatar con iniciales de la empresa, nombre, chips (país, plan), fiscal_id en texto secundario, y a la derecha nº de simulaciones + CTA "Ver cliente". Botón secundario fijo "+ Nuevo cliente" → Ventana 5.
- **Estados**: sin búsqueda aún → estado inicial con clientes recientes; búsqueda sin resultados → vacío con CTA "Dar de alta a {término}"; error de red → banner con reintentar; skeletons de tarjeta al cargar.

### Ventana 3 — Detalle de cliente

- **Propósito**: ver los datos del cliente y su **historial de simulaciones guardadas**; lanzar una nueva simulación.
- **Estructura**: cabecera con breadcrumb (Buscador / {Empresa}); **tarjeta de cliente** (patrón resultado, versión grande): nombre, chips de país y tipo de identificador validado (DNI/NIE/CIF con check verde, o "sin validar" en gris), email, y su **plan** con nombre y aviso discreto si es una versión archivada ("Mantiene su tarifa contratada" — sin jerga de versionado). CTA primaria "Nueva simulación" → Ventana 4. Debajo, **historial en tarjetas responsive** (grid 1-2-3 columnas según ancho): fecha, entradas resumidas (usuarios / GB / llamadas como filas de especificación), y **total grande** en la divisa de visualización con etiqueta pequeña "≈ referencia · facturado en {EUR}" cuando hay conversión.
- **Estados**: historial vacío → ilustración + "Aún no hay simulaciones" + CTA; skeletons; error de red.

### Ventana 4 — Simulador interactivo (la ventana estrella)

- **Propósito**: mover controles de consumo y ver el presupuesto mensual **en tiempo real**, desglosado y convertido. Réplica estructural de la calculadora interactiva de Roams (patrón 2.4.3).
- **Estructura**: dos columnas en escritorio (apiladas en móvil, resultado primero como tarjeta sticky):
  - **Izquierda — controles**: una tarjeta por métrica (Usuarios activos, Almacenamiento GB, Llamadas API), cada una con icono de línea, **slider grande** + input numérico sincronizado. Si el plan del cliente **no factura** una métrica, su tarjeta se muestra atenuada con callout suave (patrón 2.4.4): "Este plan no cobra por esta métrica: puedes registrarla, pero no cambia el precio" — nunca ocultarla.
  - **Derecha — resultado vivo**: **total mensual en tipografía enorme** (estilo precio Roams: número grande, "€/mes" pequeño, "impuestos incluidos" debajo); actualización a 0 ms al arrastrar. Debajo, **desglose expandible** en tabla (patrón 2.4.5): por métrica y tramo ("10 usuarios × 10 € = 100 €", "5 × 8 € = 40 €"), línea de impuesto con el % del país, y total. Si la divisa de visualización ≠ divisa del plan: el convertido en grande con badge "referencia" y el importe de facturación real siempre visible debajo ("Se factura: 169,40 €").
  - CTA primaria "Guardar simulación" bajo el resultado.
- **Estados**: al guardar → botón en estado cargando; éxito → toast + el resultado queda "sellado" con fecha (el número del servidor sustituye al preview si difiere); tipos caídos → badge ámbar global y conversión con última fecha conocida; error de red al guardar → banner reintentable sin perder los valores de los sliders.

### Ventana 5 — Alta de cliente

- **Propósito**: registrar un cliente corporativo con validación fiscal clara.
- **Estructura**: formulario en tarjeta única, una columna, campos generosos: Nombre de empresa · **País** (desplegable poblado desde la API, con búsqueda) · **Identificador fiscal** (con hint contextual **que llega ya resuelto de la API junto al país elegido** — p. ej. para España "DNI, NIE o CIF — se comprueba automáticamente"; la UI solo pinta el texto recibido, sin lógica por país) · Email · **Plan** (tarjetas seleccionables tipo radio con nombre, resumen de tramos en texto pequeño y precio orientativo — patrón tarjeta de producto en miniatura). CTA "Dar de alta".
- **Estados**: validación fiscal fallida → error junto al campo con tono útil ("La letra de control no corresponde. Revisa el identificador"); duplicado → "Esta empresa ya existe" con enlace a su ficha; envío en curso → botón deshabilitado; éxito → redirige al detalle con toast.

### Ventana 6 — Administración de planes `(solo rol admin)`

- **Propósito**: listado de planes con su estado; entrada a crear/editar/archivar.
- **Estructura**: cabecera "Planes de precios" + CTA "+ Nuevo plan"; **tabla-lista de tarjetas horizontales**: nombre + versión como chip discreto ("v2"), chips de métricas que factura (Usuarios / GB / API), divisa, badge de estado (Activo verde / Archivado gris), acciones "Editar" y "Archivar". Los archivados se agrupan colapsados al final.
- **Estados**: confirmación de archivado en modal con lenguaje llano: "El plan dejará de ofrecerse a clientes nuevos. Los clientes actuales no se ven afectados."; lista vacía improbable pero definida.

### Ventana 7 — Crear / editar plan (plantilla) `(solo rol admin)`

- **Propósito**: componer un plan a partir de bloques de tramos por métrica.
- **Estructura**: formulario por secciones: (1) Nombre, descripción y **divisa de facturación** (desplegable ISO, habituales arriba); (2) **tres bloques colapsables**, uno por métrica (Usuarios, Almacenamiento, Llamadas API), cada uno con interruptor "Este plan cobra por {métrica}"; al activarlo, **editor de tramos**: filas con "Hasta cuántos {unidades}" + "Precio por unidad", botón "+ Añadir tramo", el último tramo se muestra fijo como "En adelante" (∞). Los errores de coherencia (cortes no crecientes, sin bloques activos) aparecen en línea sobre la fila afectada. (3) Panel lateral de **vista previa en vivo**: mini-simulador que enseña qué costaría un ejemplo con los tramos escritos.
- **Al editar** un plan existente, aviso fijo en la cabecera (patrón callout): *"Los clientes actuales mantendrán su tarifa. Al guardar se creará una nueva versión del plan."* — es toda la jerga de versionado que el admin ve.
- **Estados**: validación de plantilla en línea; guardado con toast; salir con cambios sin guardar → confirmación.

---

## 5. Responsive

- Escritorio ≥ 1024 px: layouts de dos columnas donde se definen; grid de cards a 2-3 columnas.
- Tablet: simulador apilado (resultado sticky arriba), grid a 2.
- Móvil: una columna; topbar compacta con menú; sliders a ancho completo con el input numérico encima; tablas de desglose con scroll horizontal y chevrons (patrón Roams).

## 6. Qué debe entregar Claude Design

1. Las **7 ventanas** en **tema claro y tema oscuro** (14 pantallas), escritorio; más las 3 críticas en móvil (Dashboard, Detalle, Simulador).
2. Los **estados no felices** de las 3 ventanas críticas: buscador sin resultados, error de validación fiscal en el alta, y simulador con tipos desactualizados.
3. La hoja de **tokens** (variables CSS de ambos temas) como entregable propio, para trasladarla tal cual al código.

**No negociables al diseñar**: el desglose del cálculo siempre visible o a un clic; el importe convertido siempre etiquetado como referencia con el facturado real al lado; las métricas no facturadas se muestran atenuadas, no se ocultan; nada de jerga técnica (versión, snapshot, tramo puede decirse "escalón de precio" en tooltips); contraste AA en los dos temas.

---

## 7. Qué se implementó, y en qué se desvía del prototipo

El prototipo entregado (`SaaS-O-Matic.dc.html`) es la fuente del lenguaje visual, y se portó **el aspecto, no la lógica**: traía su propio motor de tramos, un `roundHalfUp(x) = Math.floor(x + 0.5)` en float, un validador fiscal completo y los tipos impositivos como `tax: 0.21`. Es lo correcto en un mockup y es exactamente lo que las directrices §5 rechazan en producción: en la app, el cálculo lo hace `@saas/pricing` y la validación el registro del backend.

Cuatro desviaciones deliberadas:

| Desviación | Por qué |
|---|---|
| **8 pares de color ajustados** (5-8 % hacia negro), más `--color-primary-strong` y `--color-on-primary` | El AA es requisito duro (§2.3) y el prototipo lo fallaba en ocho pares — el peor, texto blanco sobre el primario en oscuro, **3,44**, que es el botón principal. La causa es estructural: el magenta de marca sobre blanco da **4,50 exacto**, así que sobre cualquier tinte cae. Hay un test (`ui/tokens.test.ts`, 32 pares) que falla el CI |
| **Poppins auto-alojada**, subset latino | El prototipo la carga de `fonts.googleapis.com`: es un tercero, choca con la CSP estricta (referencia §14.2), y una herramienta interna no debería depender de que Google responda. Sin el subset latino se empaquetaba devanagari: 512 KB → 80 KB |
| **Sin banderas** en el selector de divisa | El prototipo usa emoji de bandera. Una bandera junto a una divisa es una imprecisión (el euro no es de un país, el dólar es de veinte) y además no la lee un lector de pantalla. El símbolo lo deriva `Intl` del código ISO |
| **El alta es una pantalla**, no un modal | En el prototipo es un overlay. Como pantalla tiene URL propia, se puede enlazar desde el estado vacío del buscador ("Dar de alta a «X»") y el navegador la trata como lo que es: un formulario con su sitio |

**Estado**: las **7 ventanas** están implementadas y verificadas conduciendo la app real.

Una desviación más, en la ventana 7: **la vista previa en vivo usa `quote()` de `@saas/pricing`**, el mismo motor que el backend, y no una tercera implementación como en el prototipo. Muestra la tarifa **sin impuesto**, porque ahí se enseña el precio del plan y no un presupuesto a un cliente concreto — el impuesto depende del país de cada uno.
