# Spec — Tipos de cambio

> **Capa SPEC de feature.** El porqué de negocio → `../idea-referencia.md` §9, §4.1, §13.1. El contrato HTTP → `../contrato-api.md` §3.6. La pantalla → `../diseno-frontend.md` (topbar y ventana 4).

---

## 1. Alcance

`GET /rates`: proxy con caché de servidor sobre `open.er-api.com/v6/latest/EUR`, y el selector de divisa que lo consume.

**El límite de esta feature es el invariante 3**: ningún tipo de cambio entra jamás en un importe persistido (→ referencia §3). Todo lo que hay aquí es **presentación** — el paso 5 del orden de cálculo (→ referencia §4.2), y nada más. Si alguna pieza de esta feature acaba llamada desde `simulations`, algo se ha roto.

---

## 2. Por qué el backend está en medio

La interfaz consume tipos **a través de `GET /rates`** en vez de llamar a la API pública desde el navegador.

**El motivo principal es de negocio, no técnico** (→ referencia §9): con caché en el navegador, dos comerciales pueden cotizar al mismo cliente con tipos distintos el mismo día —uno abrió la pestaña ayer, el otro hoy—. La caché de servidor garantiza que **todo el equipo ve el mismo número a la misma hora**. Los beneficios técnicos (una llamada real al día en vez de una por navegador, un único punto de fallback, cero CORS, el proveedor no expuesto por si mañana exige API key) son reales y son secundarios.

**Sobre la literalidad del enunciado** —"la interfaz debe conectar con una API pública de tipos de cambio"—: se cumple. La interfaz consume tipos de una API pública; el backend es una capa intermedia estándar (*cache-aside* / BFF). La desviación de la letra se documenta con su porqué **en el README**, que es donde el evaluador la va a buscar. Eso no es saltarse el requisito: es ingeniería, y esconderla sería lo único que lo convertiría en un problema.

---

## 3. La caché

### 3.1 TTL: el que dice la propia API

La respuesta de `open.er-api.com` trae `time_last_update_unix` y **`time_next_update_unix`**. El TTL **es** ese instante: se caduca ahí, alineado con el ciclo real del proveedor, no a 24 h fijas adivinadas desde el momento de la primera petición.

La diferencia es concreta: con TTL fijo de 24 h, una caché poblada a las 23:50 sirve datos viejos durante casi un día completo después de que el proveedor ya haya publicado los nuevos. Con `time_next_update_unix`, la primera petición pasada esa marca refresca. **El dato para decidir ya viene en el payload; ignorarlo y adivinar un número es la definición de acoplamiento por descuido.**

Defensa mínima: si el campo falta o es absurdo (pasado, o a más de 48 h vista), se cae a un TTL de 24 h desde ahora. No se confía ciegamente en un tercero para algo que puede dejar la caché envenenada o inútil.

### 3.2 Forma y ciclo

Caché **en memoria del proceso**, una sola entrada. No se persiste en SQLite: son datos volátiles de presentación, y perderlos al reiniciar cuesta una petición HTTP.

```ts
type RatesCache = {
  rates: Record<string, number>;   // ya filtrado
  as_of: string;                   // ISO, de time_last_update_unix
  next_update: string;             // ISO, de time_next_update_unix
  fetched_at: string;
};
```

*Cache-aside*: en cada `GET /rates`, si hay entrada fresca se sirve; si no, se pide, se filtra, se guarda y se sirve.

**Sin refresco proactivo en background.** Un `setInterval` que refresca cada N horas parece más elegante y añade un temporizador que hay que apagar al cerrar el servidor, que falla en silencio si nadie lo mira y que pide tipos a las 4 de la mañana cuando no hay nadie cotizando. *Cache-aside* pide cuando alguien pregunta, que es exactamente cuando hace falta. → recorte consciente.

**Una petición en vuelo, no N.** Si llegan cinco peticiones con la caché caducada, se dispara **una** llamada externa y las cinco esperan a la misma promesa. Es una variable con la promesa en curso, no una librería: sin ella, el *cache stampede* convierte "una llamada real al día" —el argumento central del §2— en "una por comercial que refresque a la vez".

### 3.3 Filtrado del payload

La API devuelve **~160 divisas** y se usan las del enum `Currency` (→ referencia §4.3, §9). Se filtra **al recibir**, antes de guardar: la caché guarda solo lo que se sirve.

Que el filtro se aplique al recibir y no al servir importa: es lo que hace que el enum `Currency` sea la única definición de "en qué divisas trabaja este sistema", y que la API externa no pueda introducir por la puerta de atrás una divisa que el resto del sistema no conoce.

---

## 4. Fallback: el número viejo se enseña, nunca se esconde

| Situación | Respuesta |
|---|---|
| Caché fresca | `200`, `stale: false` |
| Caché caducada y la API responde | `200` con datos nuevos, `stale: false` |
| Caché caducada y la API **falla** | `200` con **el último tipo conocido**, `stale: true`, `as_of` de cuando se obtuvo |
| **Sin caché** y la API falla (primer arranque sin red) | `503 RATES_UNAVAILABLE` |

**La tercera fila es la decisión.** Sigue siendo un `200` y no un `503` porque **los datos son utilizables**: un tipo de ayer orienta perfectamente para una cotización, y la decisión de mostrarlo es de la UI, que pinta el badge ámbar "Tipos de cambio del {fecha}" (→ referencia §13.1). Un `503` haría que el frontend descartara datos que sí valen.

Lo que no se hace jamás es servir el número viejo **en silencio**: un dashboard que enseña un tipo de hace tres días sin avisar es peor que uno que dice que no sabe (→ referencia §9). Por eso `stale` y `as_of` son parte del contrato, no metadatos opcionales.

**La cuarta fila es el único caso sin salida**: no hay número viejo que enseñar. La UI cae a EUR con aviso visible; los importes de facturación siguen siendo correctos porque **la divisa de facturación no depende de esta API** (→ referencia §4.1). Ese es el rendimiento del invariante: la caída del proveedor externo degrada la presentación y **no toca el negocio**.

**Timeout explícito** en la llamada saliente (unos segundos). Sin él, una API que acepta la conexión y no responde deja `GET /rates` colgado y, con la promesa compartida del §3.2, arrastra a todos los que esperan. Al vencer, se comporta como "la API falla".

---

## 5. Seguridad

- **Sin SSRF**: la URL es **fija y de configuración del servidor**. Ninguna entrada del usuario compone la URL, ni la base, ni un parámetro (→ referencia §14.1). `GET /rates` no acepta ningún parámetro, y eso es a propósito.
- **El payload externo se trata como no confiable**: se valida la forma antes de guardarlo en caché (que `rates` exista, que sea un objeto, que los valores sean números finitos y positivos). Un proveedor que empieza a devolver `null` en una divisa no debe poder meter un `NaN` en el selector.
- **Sin CORS**: el navegador solo habla con el propio backend (→ referencia §14.1). En desarrollo lo mantiene literal el proxy de Vite.

---

## 6. En el cliente

- **La conversión es solo visual** y se hace en el frontend: `mostrado = total_minor × rate`, formateado con `Intl.NumberFormat` a partir del código ISO (→ referencia §4.4). El resultado no se envía a ningún sitio.
- **El importe convertido se marca siempre como referencia**, con el importe de facturación real visible al lado ("Se factura: 169,40 €"). → `../diseno-frontend.md`, ventana 4.
- **Preselección de divisa**: la sesión guarda `{ currency, source: 'auto' | 'manual' }`. Detalle en `05-auth-mock.md` §4, porque es estado de sesión.
- **Estados** (→ referencia §13.1): skeleton al cargar; `stale: true` → badge ámbar persistente; `503` → selector deshabilitado o caída a EUR con aviso.
- **La cruzada existe y es real**: el catálogo tiene planes facturados en USD y JPY (→ `../modelo-datos.md` §3.2), así que mostrar su total en otra divisa cruza por la base EUR — `USD→GBP = rates[GBP] / rates[USD]`. Vive en el conversor de presentación del frontend (`convertMinor`), nunca en un importe persistido (→ referencia §4.1, invariante 3).

---

## 7. Tests

- **TTL**: con `time_next_update_unix` en el futuro → segunda petición **no** llama a la API. Con la marca en el pasado → sí llama.
- **`time_next_update_unix` ausente o absurdo** → TTL de 24 h, sin reventar.
- **Fallback**: caché poblada + API caída → `200`, `stale: true`, `as_of` de la entrada vieja.
- **Sin caché + API caída** → `503 RATES_UNAVAILABLE`.
- **Filtrado**: payload con 160 divisas → la respuesta solo trae las del enum.
- **Payload corrupto** (`rates: null`, un valor `"abc"`, un negativo) → no envenena la caché; se comporta como fallo.
- **Una sola llamada en vuelo**: cinco peticiones concurrentes con caché caducada → **una** llamada externa (se cuenta con el doble de la API).
- **Timeout**: API que no responde → se comporta como fallo al vencer, no cuelga.
- **`GET /rates` no acepta parámetros**: cualquier query extra no altera la URL saliente. Es el test que ancla el "sin SSRF" del §5.
