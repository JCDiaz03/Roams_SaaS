# Decisiones de arquitectura (ADR)

> **Mantenimiento — capa ARQUITECTURA.**
>
> * Qué es: registro único de decisiones. Una entrada por decisión, con contexto, alternativas descartadas y consecuencias.
> * **El resultado de cada decisión ya vive en su sección de `../01-specs/idea-referencia.md`. Aquí se cuenta el camino**: qué se consideró, por qué se descartó, qué se paga. Sin duplicar el destino.
> * Una decisión no se reescribe cuando cambia: se añade una entrada nueva que la supersede. El historial es el valor.
> * Todas están **aceptadas** salvo mención expresa.

---

## 0001 — TypeScript full-stack

**Contexto.** El enunciado admite Node.js (TypeScript) o Python indistintamente. Hay que elegir con un motivo del proyecto, no por gusto.

**Alternativas consideradas.**

- **Python + FastAPI.** Muy buen ajuste al backend: Pydantic da validación por esquema tan declarativa como Fastify, y `Decimal` resuelve el dinero mejor que cualquier cosa que tenga JavaScript. **Se descarta por el frontend**: obliga a dos lenguajes, y con dos lenguajes **el motor de tarificación no se puede compartir**. El preview del slider pasa a ser una segunda implementación —o un endpoint con debounce— y el problema del §10 deja de tener solución limpia. La ventaja de `Decimal` es real pero pequeña: el diseño ya usa enteros en unidades menores, donde `Decimal` no aporta nada.
- **Elm en el frontend.** Considerada en serio por una razón concreta: **el XSS es inexpresable por diseño** (no hay forma de inyectar HTML sin pasar por un puerto explícito), y la seguridad es criterio de evaluación. Se descarta por coste de contexto: obliga a un puente de interoperabilidad para reutilizar el motor de TypeScript, y ningún evaluador puede juzgar el código en un vistazo. La misma garantía se consigue al 90 % con React + una regla de ESLint (→ referencia §14.2), y ese 10 % no vale el precio.
- **TypeScript en ambos extremos.** Elegida.

**Decisión.** TypeScript full-stack. **El motivo decisivo es uno solo**: el módulo de tarificación compartido (→ referencia §10). Todo lo demás son ventajas de acompañamiento — `Intl.NumberFormat` resuelve símbolos y decimales de divisa sin tablas propias (→ referencia §4.4), y el ecosistema lo conoce cualquier evaluador.

**Consecuencias.** Se asume la aritmética de JavaScript, que es el punto débil de la elección: `number` es IEEE 754 y `Math.round` no es half-up. Se paga con enteros en unidades menores, `bigint` en el redondeo y **una única función de redondeo testeada** (→ `features/01-motor-tramos-y-simulaciones.md` §2.3). Es un coste acotado y localizado; la alternativa era no poder compartir el motor.

---

## 0002 — Monorepo con npm workspaces

**Contexto.** Front y back necesitan **la misma** función de tarificación (consecuencia de 0001 y de 0003). Hay que decidir cómo se comparte.

**Alternativas consideradas.**

- **Dos repos + paquete publicado en un registro.** Es la solución de libro y la correcta cuando hay varios consumidores y ciclos de vida distintos. Aquí significa publicar y versionar un paquete para dos consumidores que se despliegan juntos, y que un cambio de un tramo pase por *publicar → bump → instalar*. Fricción absurda a esta escala.
- **Dos repos + copiar el motor.** Es la que se acaba tomando de facto cuando la anterior duele. **Es exactamente lo que el diseño existe para impedir**: dos implementaciones que divergen el primer martes.
- **Monorepo con workspaces.** Elegida.

**Decisión.** npm workspaces: `/backend`, `/frontend`, `/packages/pricing`. Sin Nx, sin Turborepo, sin Lerna — no hay grafo de builds que orquestar ni caché que justificar con tres paquetes.

**Consecuencias.** Los workspaces **no son gusto por el monorepo: son el mecanismo que hace cumplir el §10**. Con ellos, la divergencia front/back no es improbable, es inexpresable. El precio es una regla que hay que sostener: `packages/pricing` no puede importar nada de `backend/` ni de `frontend/`, y no toca IO (→ `directrices-ia.md` §3.1). Si alguna vez lo hiciera, el frontend arrastraría `better-sqlite3` y el paquete dejaría de ser compartible.

---

## 0003 — Preview híbrido con módulo compartido

**Contexto.** El enunciado pide que el slider refleje la proyección **en tiempo real**, y la fluidez del frontend es criterio de evaluación. A la vez, el invariante 1 dice que el backend es la única fuente de verdad del coste. Las dos cosas tiran en direcciones opuestas.

**Alternativas consideradas.**

- **Preview solo-frontend** (el cliente calcula y envía el resultado). Fluido y **viola el invariante 1**: el número que se persiste lo produce el cliente. Descartada sin discusión.
- **`POST /simulations/preview` con debounce.** Respeta el invariante —una sola fuente de verdad— y es la solución correcta si el motor no se puede compartir. Cuesta **~200-250 ms de retardo perceptible** al arrastrar y una ráfaga de peticiones por gesto. Descartada: con el módulo compartido, su única ventaja desaparece y el coste se queda.
- **Híbrido con módulo único.** Elegida.

**Decisión.** El frontend calcula el preview **en local** con la misma función pura (`@saas/pricing`), usando los tramos y el `tax_rate_bp` que ya trae `GET /customers/{id}`. Al guardar, el backend **recalcula desde cero** y su número manda.

**Consecuencias.** Esta decisión **es la razón de ser de 0001 y 0002**: la cadena entera (TypeScript → workspaces → paquete puro) existe para sostenerla. A cambio: 0 ms de preview, cero peticiones por gesto y **la divergencia deja de ser un riesgo que mitigar para ser algo que no se puede escribir**. El test de paridad (→ referencia §15) se mantiene igualmente, como cinturón y tirantes: no protege de un bug de hoy, protege del día que alguien tenga la idea de optimizar uno de los dos lados.

---

## 0004 — Proxy de tipos de cambio en el backend

**Contexto.** El enunciado dice, literalmente, que **la interfaz** debe conectar con una API pública de tipos de cambio. Lo natural es llamar desde el navegador. Hacerlo desde el backend es una desviación de la letra y hay que justificarla o no hacerla.

**Alternativas consideradas.**

- **Llamada directa desde el navegador.** Cumple la letra. **Rompe el negocio**: con caché en el navegador, dos comerciales cotizan al mismo cliente con tipos distintos el mismo día — uno abrió la pestaña ayer, el otro hoy. En una herramienta cuyo producto es un presupuesto, eso no es un detalle técnico.
- **Proxy en el backend con caché de servidor.** Elegida.

**Decisión.** `GET /rates` como *cache-aside* / BFF, con TTL = `time_next_update_unix` y fallback marcado como desactualizado.

**Consecuencias.** **El motivo es de negocio, no técnico**, y ese orden importa: todo el equipo ve el mismo número a la misma hora. Los beneficios técnicos (una llamada real al día, un punto único de fallback, cero CORS, el proveedor no expuesto por si mañana exige API key) son reales y **secundarios** — si el argumento fuera solo técnico, la desviación no compensaría.

**Sobre la literalidad**: se sigue cumpliendo. La interfaz consume tipos de una API pública; el backend es una capa intermedia estándar. **La desviación se documenta en el README con su porqué**, que es donde el evaluador la va a buscar. Esconderla es lo único que la convertiría en un problema.

---

## 0005 — Dinero en enteros con `minor_unit`

**Contexto.** Hay que fijar la representación del dinero antes de escribir la primera línea del motor. Es la decisión más cara de revertir de todas: aparece en el esquema, en el contrato y en cada componente.

**Alternativas consideradas.**

- **`float` / `number` para euros.** Lo que sale por defecto. `0.1 + 0.2 !== 0.3`, y en un cálculo de tramos con IVA el error se acumula. Descartada por el invariante 5.
- **Una librería de decimales** (`decimal.js`, `big.js`). Resuelve la precisión y **no resuelve el problema real**: sigue sin haber divisa pegada al importe, y el redondeo sigue dependiendo de que cada llamada pase el modo correcto. Añade una dependencia en el paquete que más puro queremos.
- **Enteros en céntimos, con sufijo `_cents`.** Correcto para el euro. **Falso en cuanto el desplegable ofrece JPY**: el yen no tiene decimales, y `_cents` sería un nombre que miente sobre lo que guarda.
- **Enteros en unidades menores (`_minor`) + código ISO + `minor_unit` en el enum.** Elegida.

**Decisión.** Todo importe es un entero en unidades menores **de su divisa**, siempre acompañado de su código ISO 4217. El enum `Currency` lleva `minor_unit` (EUR: 2, JPY: 0, KWD: 3) desde el día 1. Se guarda el código, **nunca el símbolo**: el símbolo se deriva al pintar con `Intl.NumberFormat`.

**Consecuencias.** Sin `minor_unit`, el problema de los decimales queda **escondido, no resuelto**: el desplegable permite elegir JPY y ahí "×100" deja de ser cierto. Cuesta un campo del enum y cierra dos roturas futuras — el redondeo (un yen no tiene céntimos) y la pasarela (Stripe espera JPY en yenes enteros). Que el seed lleve **Japón como país** (→ `../01-specs/modelo-datos.md` §3.1) no es decoración: es lo que hace que esta decisión esté ejercitada en pantalla y no solo escrita aquí.

El coste asumido: cada importe viaja como par `(entero, ISO)` y el formateo es responsabilidad del cliente. Es más verboso que un `number` y es la única forma de que no haya una suposición "EUR" invisible incrustada en treinta sitios.

---

## 0006 — Versionado de planes y snapshot de simulación

**Contexto.** Los planes son datos editables por un admin. Una simulación guardada tiene que poder explicar su número mañana. Y un cliente dado de alta con el Plan A tiene que seguir tarificando como su Plan A. **Son dos problemas distintos** y es fácil verlos como uno.

**Alternativas consideradas.**

- **Edición libre del plan.** "El admin edita con conocimiento de causa". **No se sostiene**, y no por competencia del admin: **no puede ver las consecuencias desde su pantalla** — no sabe qué presupuestos se enviaron con ese tramo ni qué clientes están dados de alta con ese plan. Ninguna advertencia arregla información que no está en la pantalla.
- **Solo snapshot** (la simulación guarda su foto; el plan se edita libremente). Protege el pasado y **deja desprotegido el contrato presente**: el cliente que firmó el Plan A cotiza mañana con una tarifa que no firmó.
- **Solo versionado** (el plan se versiona; la simulación referencia `plan_id`). Protege el contrato presente y **deja el historial dependiendo de leer el plan**: es más robusto que la edición libre, pero ata cada card del historial a un `JOIN` que puede cambiar de significado.
- **Snapshot + versionado.** Elegida.

**Decisión.** Un precio publicado es **inmutable**: editar crea versión nueva y archiva la anterior; borrar archiva. Y cada simulación guarda su `pricing_snapshot`.

**Consecuencias.** **Son complementarios, no alternativos**: el snapshot protege el **pasado** (simulaciones ya guardadas), el versionado protege el **contrato presente** (que el cliente siga tarificando como su plan). Ninguno de los dos sustituye al otro, y el error de diseño habitual es creer que sí.

Es además la práctica de industria: en Stripe un `Price` no permite cambiar su importe — creas uno nuevo y archivas el viejo. Consecuencias concretas asumidas: `DELETE` archiva (desviación de la semántica HTTP, declarada en `../01-specs/contrato-api.md` §4.3); el `id` que devuelve `PUT` no es el de la URL; y **nunca hay borrado físico**, lo que a cambio da una regla uniforme y cero problemas de integridad referencial.

---

## 0007 — Auth mock con costura

**Contexto.** El enunciado pide login con contraseña `1111` y un rol admin. No se conocen ni los datos ni el sistema de identidad interno de la empresa.

**Alternativas consideradas.**

- **Auth real** (usuarios en base de datos, hash de contraseñas, tokens). Inventar hoy un modelo de usuarios —tablas de roles, `sales_rep_id`— cuesta más que añadirlo cuando se conozca el sistema real, y casi con certeza sería el modelo equivocado. Se descarta y se documenta como diferido (→ `roams-roadmap.md` §6).
- **Mock a pelo**, con `if (usuario === "ADMIN")` donde haga falta. Cumple el enunciado y **genera deuda real**: sustituirlo obliga a encontrar y tocar veinte sitios, y el que se olvide no falla — deja de proteger, en silencio.
- **Mock con costura.** Elegida.

**Decisión.** El login deriva **una vez** una sesión `{ nombre, rol }`; los componentes preguntan `hasRole('admin')`. El middleware de auth del backend existe desde el día 1 aunque hoy no valide nada.

**Consecuencias.** **La deuda no depende de que el auth sea falso, sino de dónde vive la comprobación de rol.** Con la derivación única, sustituir el mock por auth real = sustituir **un módulo**; deuda ≈ 0. El string `"ADMIN"` aparece **una sola vez** en el frontend, y hay un test que lo comprueba (→ `../01-specs/features/05-auth-mock.md` §6) — es el único test de esa spec que protege el diseño en vez del mock.

**Riesgos aceptados y declarados** (→ referencia §8.3): el rol comprobado solo en frontend **no es seguridad** —cualquiera puede llamar a los endpoints de admin—; la contraseña es visible en el código del cliente; el nombre en presupuestos no es auditable. Aceptables en herramienta interna con mock declarado. **Lo que no vale es creerse protegido**, y por eso el README lo declara fuera del modelo de amenazas y los endpoints de admin **no** viven bajo un `/admin/*` que daría ilusión de protección.

---

## 0008 — Sin Docker en la v1

**Contexto.** "README y despliegue" es el 10 % de la nota y el criterio es explícito: levantar back y front en local **en pocos pasos y sin fricciones**. Un Dockerfile es el reflejo automático.

**Alternativas consideradas.**

- **Dockerfile / `docker-compose` como camino principal.** Descartada: **añadiría fricción en lugar de quitarla**. Exigiría Docker instalado y un build de imagen para evaluar una app de Node puro, y el evaluador que no lo tenga se queda fuera del camino documentado.
- **Entrega compilada** (un build listo para servir). Descartada: el proceso y el código son la mayor parte de la evaluación; un build los ocultaría.
- **`git clone` → `npm install` → `npm run dev`.** Elegida.

**Decisión.** Sin Docker. Arranque en tres comandos, con **seed automático si el `.db` no existe**, versión de Node fijada con `engines` + `.nvmrc`, y `concurrently` levantando back y front desde la raíz.

**Consecuencias.** **El stack no tiene dependencias de sistema que justifiquen contenedores**: SQLite es un fichero, no un servicio; no hay Postgres, ni Redis, ni colas. Docker resuelve el problema de orquestar servicios y aislar dependencias del sistema, y aquí no hay ninguno de los dos — sería ceremonia con coste cierto y beneficio cero.

**Cuándo dejaría de ser cierto**, que es la parte que hace que esto sea una decisión y no una excusa: en cuanto haya un servicio real que orquestar (una base de datos que sea un proceso, una caché compartida entre instancias, un worker). Ese día `docker-compose` entra por la puerta grande. Queda como diferido documentado (→ `roams-roadmap.md` §6).

El único riesgo real es `better-sqlite3`, que compila binario nativo: si el evaluador tuviera una versión de Node sin binario precompilado disponible, `npm install` pediría herramientas de compilación. Lo mitiga el `engines` + `.nvmrc` fijando una versión LTS con binarios publicados, y el README diciendo cuál es.

---

## 0009 — Sesión de servidor en memoria con `IdentityProvider` (supersede parcialmente 0007)

**Contexto.** Fase 3: el core está entregado y el margen de plazo se invierte en profundidad (→ `roams-roadmap.md` §5). El mayor riesgo declarado del proyecto es el §8.3-1 —los endpoints de admin no tienen protección real— y a la vez **sigue sin conocerse el sistema de identidad de la empresa**, que fue la razón entera del 0007. La pregunta no es "¿mock o auth real?": es **qué mitad del auth se puede construir sin inventar nada**.

**Alternativas consideradas.**

- **Conectar ya un IdP concreto** (OIDC contra Keycloak/Azure AD/lo que sea, elegido por nosotros). Construye la mitad incognoscible adivinándola: el día que la empresa diga cuál es su sistema, lo elegido se tira. Es exactamente el error que el 0007 evitó, con más código. Descartada — la conexión al IdP real **sigue diferida**.
- **JWT stateless firmado.** La opción de moda, y peor aquí en los tres ejes que importan: **no es revocable** sin una lista negra (que es reinventar la sesión de servidor con más piezas), añade **un secreto que gestionar y rotar**, y su ventaja real —que N servicios validen sin estado compartido— no existe con **un** proceso y **un** consumidor. Stateless resuelve un problema que este sistema no tiene.
- **Tabla `sessions` en SQLite.** Sobrevive al reinicio, a cambio de persistir estado volátil de una jornada y mantener limpieza de expiradas. El mismo criterio que dejó la caché de tipos en memoria (0004): reiniciar = volver a entrar, aceptable en herramienta interna. Descartada.
- **Sesión en memoria + puerto `IdentityProvider`.** Elegida.

**Decisión.** `Map` en memoria con ids de `crypto.randomBytes`, cookie `HttpOnly` + `SameSite=Strict`, caducidad absoluta de 12 h, y el rol aplicado **en el backend** (401/403). La verificación de credenciales queda detrás del puerto `IdentityProvider`, cuya única implementación hoy es el mock del enunciado (cualquier usuario + `1111`, `ADMIN` → admin). Spec completa → `../01-specs/features/07-autenticacion.md`.

**Consecuencias.** El riesgo §8.3-1 **se cierra**: el sistema pasa de "sin seguridad, declarado" a "seguridad real con credenciales de demostración, declarado" — la estructura (sesión, revocación, rate limit, enforcement) es la definitiva; el secreto de demostración no lo es y no se pretende. El diferido **se estrecha** a lo único incognoscible: implementar el puerto contra el sistema real. Se paga: las sesiones mueren al reiniciar el proceso (aceptado y declarado), y la frase "el gating por rol es UX, no seguridad" —escrita en tres sitios— deja de ser cierta y hay que actualizarla en todos, porque una documentación que sobrevive a su verdad es deuda de la peor clase.

**Qué supersede del 0007 y qué no.** La costura del backend (el hook vacío) se rellena, que era su destino escrito. Lo que NO cambia: la derivación única de la sesión, `hasRole()` como única pregunta de los componentes, y cero tablas de usuario. El 0007 apostó a que sustituir el mock costaría un módulo; esta decisión es la comprobación de esa apuesta.

---

## 0010 — Smoke E2E con Playwright, contra el build real

**Contexto.** La verificación de pantallas fue siempre manual —"conduciendo la app con Chrome" (`roams-roadmap.md` §3.3, §4)—: válida el día que se hizo, invisible en el siguiente push. Los arreglos de frontend de la revisión post-entrega salieron sin conducir, y la Fase 3 (§5.2) existe para cerrar esa clase de hueco.

**Alternativas consideradas.**

- **Seguir verificando a mano.** Gratis hoy, se paga en cada push, y no escala a un repo con CI: nadie re-conduce cinco pantallas por un refactor de CSS.
- **Tests de componente (Testing Library/jsdom).** Ejercitan el componente y **no** el sistema: ni proxy, ni CSP, ni cookie `HttpOnly`, ni la serialización del backend — exactamente las fronteras donde vivían los últimos defectos. Complementarios en un equipo grande; aquí serían una tercera suite que mantener con peor señal.
- **E2E exhaustivo** (cada pantalla, cada estado de error). Duplicaría los 219 tests de integración a través del canal más caro y frágil. Los estados finos ya tienen dueño (la suite de integración y los tests de UI que existan); el E2E paga cuando cruza TODO el sistema a la vez.
- **Cypress.** Equivalente funcional; Playwright gana en lo concreto de este repo: `webServer` múltiple integrado (fixture + backend + preview en una config), trazas en el fallo, y nada que dependa de un servicio de pago.
- **Smoke con Playwright.** Elegida.

**Decisión.** Tres tests **en serie** (comparten una base sembrada y el de admin muta planes) contra el sistema ensamblado de verdad: backend real con base **en memoria** (cada ejecución arranca como un evaluador), build de producción servido por `vite preview` con la **CSP estricta**, y tipos de cambio desde un **fixture local** (`RATES_URL`, variable de entorno del servidor — no un parámetro de petición: el "sin SSRF" del §14.1 no se toca). Los dos recorridos son los de las verificaciones manuales de Fase 1 y Fase 2, más logout. Cada pantalla pasa por **axe-core** con umbral `serious`/`critical`, y "cero errores de consola" —el criterio de la verificación manual— es una aserción.

**Consecuencias.** Se paga arranque (~20 s en local) y un navegador en CI (job aparte, para no retrasar la señal rápida de lint+test). **Rindió el primer día, dos veces**: cazó que el cinturón anti-CSRF (comparar `Origin` contra `Host`) rechazaba a la propia aplicación detrás del proxy —invisible para `app.inject`, que no atraviesa proxy alguno— y un fallo real de contraste AA que el test de tokens no podía ver (el atenuado componía opacidad sobre un color que ya era secundario). Es exactamente la clase de defecto que solo existe en el sistema ensamblado, que es la única razón de tener E2E.
