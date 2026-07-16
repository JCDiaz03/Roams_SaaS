# Spec — Autenticación con identidad enchufable

> **Capa SPEC de feature.** El porqué → `../idea-referencia.md` §8; el camino de la decisión → ADR 0009 (que supersede parcialmente 0007). Supersede el §3.3 de `05-auth-mock.md` (la costura se rellena); el §2 (comportamiento del login) y el §4 (divisa en sesión) de aquella spec siguen vigentes. Fase → `../../roams-roadmap.md` §5.1.

---

## 1. Alcance, y la línea que lo parte en dos

Sesión de servidor, aplicación del rol **en el backend**, y el puerto `IdentityProvider` con el mock actual como única implementación.

**La línea divisoria es la misma dato/código de siempre, aplicada a la identidad:**

- **Lo incognoscible** — quién es usuario, cómo se autentica de verdad (SSO, LDAP, OIDC), qué atributos tiene — **no se construye**. Queda detrás del puerto y sigue diferido (→ `../../roams-roadmap.md` §7). Inventarlo hoy sería el modelo equivocado con certeza casi total.
- **Lo invariante** — cómo viaja la identidad (cookie de sesión), dónde vive (servidor), y quién aplica el rol (el backend) — **se construye ya**, porque no depende de nada que la empresa tenga que contarnos: da igual qué IdP haya detrás, la sesión y el 403 funcionan igual.

**Lo que esta spec cierra**: el riesgo aceptado §8.3-1 (endpoints de admin sin protección real). **Lo que NO cierra y se declara**: la contraseña `1111` sigue siendo pública — el sistema pasa de "sin seguridad" a "seguridad real con credenciales de demostración". La estructura protege; el secreto de demostración, no, y no se pretende.

**No entra**: tabla `users` (no hay usuarios que modelar), hash de contraseñas (no hay contraseñas que guardar), conexión a un IdP real.

---

## 2. El puerto `IdentityProvider`

```ts
// domain/auth/ — puro, sin IO, como TaxIdValidator.
export type Identity = { nombre: string; rol: 'admin' | 'sales' }

export interface IdentityProvider {
  /** null = credenciales no válidas. No distingue usuario de contraseña: eso es del caller. */
  authenticate(usuario: string, password: string): Identity | null
}
```

- **`MockIdentityProvider`** es la implementación de hoy y conserva el comportamiento declarado del enunciado: cualquier usuario no vacío + `1111` entra; `ADMIN` (insensible a mayúsculas) → rol `admin`; el resto → `sales`.
- **El literal `"ADMIN"` se muda del frontend al backend** y sigue apareciendo una sola vez en todo el sistema: dentro del mock. El test guardián de `05-auth-mock.md` §6 migra con él — pasa a vigilar `backend/src` (una aparición, quitando comentarios) **y** `frontend/src` (cero).
- Entra por `ServerDeps` como `taxProvider`: la sustitución por el IdP real es cambiar qué implementación se inyecta en `index.ts`. Firma **síncrona hoy**; el día que un proveedor real necesite red, pasa a `Promise` y el compilador dice dónde (mismo criterio que `TaxProvider`).

---

## 3. La sesión: en el servidor, en memoria

```ts
type SesionActiva = Identity & { creadaEn: number }
// Map<sessionId, SesionActiva> en memoria del proceso.
```

- **El id de sesión** son 256 bits de `crypto.randomBytes`, en base64url. No codifica nada: es una clave de mapa, y todo lo demás vive en el servidor.
- **Cookie `sid`**: `HttpOnly` (el JS del cliente no puede leerla: un XSS no roba la sesión), `SameSite=Strict` (no viaja en peticiones cross-site), `Path=/api`. Sin `Max-Age`: cookie de sesión de navegador. `Secure` se activa cuando haya HTTPS delante; en local no lo hay y **se declara** en vez de fingirlo.
- **Caducidad absoluta: 12 h** (una jornada holgada). Sin TTL deslizante: renovar es volver a entrar, y la lógica de sliding-expiration es complejidad sin problema que resolver aquí.
- **En memoria, no en SQLite**, por el mismo criterio que la caché de tipos (→ `04-tipos-de-cambio.md` §3.2): es estado volátil de presentación de una jornada. Reiniciar el servidor = volver a hacer login; aceptable en herramienta interna y **declarado**. Persistirla añadiría limpieza de expiradas y una tabla para un dato que nadie audita.
- **Revocación inmediata**: logout borra la entrada del `Map`. Es la ventaja concreta sobre un token stateless (→ ADR 0009), y la razón principal de la elección.
- **Tope de sesiones** (~1.000, expulsando la más vieja): el `Map` no puede crecer sin límite por diseño, no por confianza en el rate limit.

---

## 4. Contrato

| Endpoint | Comportamiento |
|---|---|
| `POST /auth/login` | `{ usuario, password }` → `200 { nombre, rol }` + `Set-Cookie`. Credenciales malas → `401 AUTH_INVALID_CREDENTIALS` con **mensaje único** ("usuario o contraseña"): no se revela cuál falló |
| `GET /auth/session` | `200 { nombre, rol }` con sesión viva. Es la **rehidratación tras F5**: el frontend deja de perder la sesión al recargar, que era una carencia del mock |
| `POST /auth/logout` | `204`, borra la sesión del servidor y expira la cookie |

- Esquemas Fastify completos, como toda ruta: `maxLength` en `usuario` (60) y `password` (100), `additionalProperties: false`, y esquema `response` (la regla de la casa desde la revisión post-entrega).
- **Rate limit en el login**: contador en memoria por IP, ~10 intentos/min → `429 AUTH_RATE_LIMITED`. No convierte `1111` en secreto (es público); existe para que la **estructura** quede bien construida — el día del IdP real, el freno a fuerza bruta ya está donde tiene que estar.
- El sobre de error es el común (`{ error: { code, message } }`); `401`/`403`/`429` se añaden a `contrato-api.md`.

---

## 5. Aplicación: el hook se rellena

El hook `onRequest` — la costura vacía desde el día 1, cuyo comentario decía "aquí se enchufará la validación real" — **se rellena**:

1. **`POST /auth/login` es la única ruta pública.** Todo lo demás bajo `/api` exige sesión viva → `401 AUTH_REQUIRED`. Herramienta interna: no hay lecturas anónimas que justificar.
2. **El rol se aplica donde vive el recurso, no en el cliente**: `POST/PUT/DELETE /plans` → `403 AUTH_FORBIDDEN` si el rol no es `admin`, declarado como **config de la ruta** (`{ requiereRol: 'admin' }`), no como `if` dentro del handler — visible en code review igual que el esquema.
3. **`GET /plans?include_archived=true` con rol `sales` → `403`.** El parámetro se queda (el recurso es el mismo), pero la frase de `05-auth-mock.md` §5-1 — "el gating por rol es UX, no seguridad" — **deja de ser cierta y hay que actualizarla donde aparezca**: el comentario de `plans.routes.ts`, la referencia §8.3/§12 y el README. Dejar la frase vieja sería lo contrario de lo que este proyecto hace con su documentación.
4. **CSRF**: `SameSite=Strict` + mismo origen por diseño (proxy de Vite, sin CORS) ya lo cierran en navegadores modernos; como cinturón, las mutaciones (`POST/PUT/DELETE`) comprueban que `Origin`, si viene, coincide con el host → si no, `403`. Tres líneas, cero dependencias.

**El frontend conserva su gating visual** (`hasRole('admin')` decide qué pantallas se pintan) — pero ahora es lo que siempre debió ser: UX sobre una autorización que existe de verdad debajo.

---

## 6. En el cliente

- `lib/session.tsx` deja de derivar el rol localmente: `login()` llama a `POST /auth/login` y guarda lo que el servidor diga; al montar la app, `GET /auth/session` rehidrata (F5 mantiene la sesión); `logout()` llama al endpoint **y** limpia el estado local.
- `hasRole()` no cambia de firma: los componentes no se enteran del cambio. Es la comprobación de que la costura del 0007 funcionaba.
- **Un `401` en cualquier llamada = sesión caducada** → el cliente API lo señala y la app vuelve al login. Estado nuevo del contrato de errores del cliente, con su pantalla (no un crash ni un toast críptico).
- La divisa de visualización y el tema **siguen siendo estado del cliente**: son preferencias del rato de trabajo (→ `05-auth-mock.md` §4), no identidad. No viajan al servidor.

---

## 7. Riesgos: cuáles se cierran, cuáles quedan

| Riesgo (referencia §8.3) | Antes | Ahora |
|---|---|---|
| Endpoints de admin sin protección | Real, aceptado y declarado | **Cerrado**: 401/403 en el backend |
| Contraseña visible/conocida | Mock declarado | **Queda, declarado**: credencial de demostración sobre sesión real. La estructura (rate limit, cookie, revocación) es la definitiva; el secreto no |
| Nombre no auditable en presupuestos | Texto libre | **Queda**: la identidad no se verifica contra ningún sistema. Se cierra el día del IdP real (→ diferido) |
| Cookie sin `Secure` en local | — | **Nuevo y declarado**: no hay HTTPS en local. Detrás de un proxy TLS se activa |

---

## 8. Tests

Integración contra la app real (`app.inject`), con un helper del harness que abre sesión y devuelve la cookie — todos los tests existentes de endpoints pasan a usarlo:

- **Login**: correcto → `200` + cookie con `HttpOnly`, `SameSite=Strict` y `Path=/api` (los flags se comprueban, no se suponen). Contraseña mala → `401` con mensaje único. Usuario vacío → `401`.
- **Enforcement**: sin cookie → `401` en un endpoint cualquiera no público. Con rol `sales` → `403` en `POST/PUT/DELETE /plans` **y** en `GET /plans?include_archived=true`; con `admin` → pasan. `GET /plans` a secas con `sales` → `200` (el selector del alta sigue funcionando).
- **Ciclo**: logout → la misma cookie deja de valer (revocación inmediata, el test de la ventaja del ADR). Sesión con `creadaEn` de hace 13 h → `401`.
- **Rate limit**: intento N+1 dentro del minuto → `429`; pasado el margen, vuelve a aceptar.
- **CSRF**: mutación con `Origin` de otro host → `403`; sin `Origin` (curl, tests) → pasa.
- **Rehidratación**: `GET /auth/session` con cookie viva → `200 { nombre, rol }`; sin cookie → `401`.
- **Guardián del literal** (migrado de `05-auth-mock.md` §6, con su mismo gotcha de quitar comentarios antes de buscar): `"ADMIN"` una vez en `backend/src`, **cero** en `frontend/src`.

---

## 9. Qué documentos cambian al implementar

La feature no está terminada hasta que esto esté hecho — es la lista de la regla de coherencia:

- `idea-referencia.md` §8: de "mock declarado" a "sesión real con identidad enchufable"; §14.3: el riesgo 1 se cierra, los que quedan se reescriben como en §7 de esta spec.
- `contrato-api.md`: los tres endpoints, el sobre de `401`/`403`/`429`, y la nota de que toda ruta salvo login exige sesión.
- `05-auth-mock.md`: nota de cabecera — §3.3 superseded por esta spec; §2 y §4 siguen vigentes.
- `plans.routes.ts` y README: la frase "el gating es UX, no seguridad" se actualiza (→ §5.3).
- `recortes-conscientes.md` §2.1 se estrecha; `roams-roadmap.md` §5.1 → ✅ y §7 ya lo refleja.
