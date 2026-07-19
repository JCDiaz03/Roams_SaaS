# Sesión 10 — Auth real con identidad enchufable (Fase 3, §5.1)

**Objetivo.** Cerrar el mayor riesgo declarado (§8.3: endpoints de admin sin protección) sin inventar el modelo de usuarios de la empresa.
**Spec de partida.** `01-specs/features/07-autenticacion.md` + ADR 0009 — escritos, revisados y commiteados **antes** de la primera línea de código, con tres decisiones de producto validadas explícitamente (toda la API exige sesión; caducidad de 12 h sin renovación; las sesiones mueren al reiniciar).
**Resultado.** Hecho. 15 tests de integración nuevos (219 de backend, 314 en el repo), verificado además contra el servidor real por HTTP.
**Regla 2, esta vez sí**: esta nota se escribe al cerrar la sesión, no transcrita al final.

## Prompt de partida

> me cuadran las tres, committea y empieza la implementacion

(De la conversación anterior venía la pregunta que abrió la feature: *«podemos mejorar el sistema de autentificacion para que sea mas robusto y seguro pero a la vez que sea desacoplado ya que no tengo informacion real de como maneja la empresa los usuarios internamente?»* — la restricción de desacople es del prompt, no un adorno del diseño.)

## Qué generó

`domain/auth/` (puerto `IdentityProvider` + `MockIdentityProvider`), `features/auth/` (almacén de sesiones en memoria, cookie a mano, rutas con rate limit, 15 tests), el hook `onRequest` relleno (401 global + `requiereRol` por config de ruta + cinturón de `Origin`), `requiereRol: 'admin'` en las mutaciones de planes, y el frontend preguntando al servidor (`login/session/logout`) con rehidratación tras F5.

## Qué se aceptó

- **La sesión en memoria y no JWT ni SQLite** (ADR 0009): revocable al instante, cero secretos que rotar, y stateless no aporta nada con un proceso y un consumidor. Se paga con "reiniciar = volver a entrar", declarado.
- **La cookie serializada a mano** (12 líneas) en vez de `@fastify/cookie`: una cookie con flags fijos no justifica una dependencia más en la cadena de suministro.
- **El harness crea la sesión directamente en el store** (sin pasar por el login) y expone `h.inject` con la cookie puesta: los 204 tests existentes cambiaron una línea por fichero (`h.app.inject` → `h.inject`), y el login tiene sus propios tests.

## Qué se rechazó

- **Conectar ya un IdP concreto** (OIDC contra un proveedor elegido a ciegas): construiría la mitad incognoscible adivinándola, y se tira el día que la empresa diga cuál es su sistema. Es el error que el ADR 0007 evitó, con más código.
- **`/admin/*` como prefijo protegido**: el recurso es el mismo (`/plans`); lo que cambia con el rol es quién puede escribirlo y cuánto se ve. El `requiereRol` declarado en la config de la ruta es visible en code review, como el esquema.
- **Ocultar la credencial de demostración**: la `1111` sigue en la pantalla del login. La estructura (sesión, revocación, rate limit, 403) es la definitiva; el secreto no lo es, y disimularlo sería fingir.

## El detalle que costó una iteración

El test del cinturón anti-CSRF («con el propio host, pasa») supuso que el host por defecto de `app.inject()` era `localhost:80` y falló: la comprobación correcta era fijar **las dos** cabeceras (`Origin` y `Host`) y comprobar que **coincidan**, no adivinar el default del inyector.

## La comprobación de la apuesta

El ADR 0007 apostó que sustituir el mock costaría **un módulo**. Costó exactamente eso: `derivarRol` desapareció del frontend, `hasRole()` no cambió de firma y ningún componente se enteró. El literal `"ADMIN"` se mudó al `MockIdentityProvider` del backend con su guardián detrás — el del frontend ahora comprueba **cero** apariciones.
