# Sesión 19 — Auditoría pre-publicación: security review y code review del rango entregado

**Objetivo.** Pregunta del usuario: *¿qué falta y cuál es la manera profesional de proceder antes de publicar?* Respuesta: revisar antes de empaquetar. Se ejecutaron una **security review** y una **code review multi-agente** sobre `ca9c90c..HEAD` (los dos commits `v0.2.0` y `v0.2.1`, ~4.100 líneas), y se corrigió todo lo confirmado.
**Resultado.** Seguridad: **cero hallazgos HIGH/MEDIUM**. Code review: **10 hallazgos confirmados (8 de corrección + 2 de limpieza), los 10 corregidos**. Estado final: **373 tests + 4 E2E** en verde. README y versión (`0.3.0`) al día.
**Regla 2**: registrada al cerrar.

## Cómo se revisó

- **Seguridad**: dos agentes independientes, uno por commit del rango (la primera pasada resultó cubrir solo la mitad — el reparto real del trabajo entre `v0.2.0` y `v0.2.1` se descubrió comparando árboles, y se relanzó con el rango completo). Cada candidato trazado hasta conclusión concreta: el SET dinámico y el DDL de la migración son bucles cerrados sobre listas blancas de compilación; el `plan_id` opcional compara contra la verdad de la BD; el `DELETE` físico queda tras rol + FK de red.
- **Code review**: workflow de 22 agentes (4 buscadores por ángulo + 16 verificadores adversariales independientes + síntesis). 21 candidatos verificados, 0 refutados, 10 reportados tras fusión de duplicados.

## Los 10 hallazgos, y su arreglo

| # | Hallazgo (todos CONFIRMED) | Arreglo |
|---|---|---|
| 1 | El input de valor exacto del simulador recortaba al máximo **visual** del slider — bajar el límite en /ajustes hacía que teclear 500 GB guardara 100 GB en silencio, contradiciendo la promesa de la propia página | El tecleo se acota a `LIMITE_MAXIMO` (los topes del backend), no al máximo visual; el slider sigue acotado por su atributo |
| 2 | La ficha pedía el historial con `include_archived=true` sin `limit`: 20 archivadas recientes expulsaban de la página a presupuestos vivos | `limit=100` (el máximo del contrato) con el porqué comentado; a más de 100, la respuesta será paginación real |
| 3 | `BaseValuesBlock` convertía con `Number()` sin validar: «12.5» → 400 críptico; una entrada saneada a vacío **borraba el valor guardado con toast de éxito** | Validación previa (`aValor`): nada viaja si algún campo no es entero, con mensaje claro |
| 4 | «Ver detalle» y volver **descartaba el what-if**: el plan elegido y los arrastres viven en estado React, y la ruta de vuelta era la URL original | La ruta de vuelta la construye `SimulatorPage` codificando el estado vivo en la query (cantidades, `plan=`, `base=1`) — reutiliza el mecanismo D6 |
| 5 | Falsy-zero + closure viejo en /ajustes: teclear 0 aplicaba 70 pero mostraba el límite anterior | El valor que queda se calcula una vez y alimenta límite e input; `aDefecto` usa `LIMITE_POR_DEFECTO` en vez de literales |
| 6 | El `simulation_count` del buscador contaba también las archivadas: dos contadores contándose cosas distintas | `AND archived = 0` en la subconsulta + test guardián (archivar reduce el contador) |
| 7 | El desplegable de divisa perdió semántica del select nativo: nada anunciaba la seleccionada y las flechas no funcionaban | `aria-label` con la divisa vigente, `aria-current` en la elegida, foco en la seleccionada al abrir y navegación con flechas |
| 8 | `/planes/nuevo` sin rol admin caía en `/planes/:id` → `GET /plans/NaN` → 400 con «Reintentar» en bucle | Guard en `PlanDetailPage`: id no-entero → «Ese plan no existe», sin petición |
| 9 | Tres copias frontend de los topes del backend (`TOPE_URL`, `LIMITE_MAXIMO`, `CAMPOS`) | Una sola casa: todo importa `LIMITE_MAXIMO` de `simulator-limits` |
| 10 | `archivarSimulacion` duplicaba la receta snapshot→quote()→vista() del historial, más una relectura evitable | Helper único `vistaDesdeFila()` compartido; el PATCH reusa la fila ya leída con el flag nuevo |

## Lo que la sesión enseña del proceso

El hallazgo 1 y el 3 son la misma lección que la auditoría de cierre de la fase anterior: los defectos que importan **compilan, pasan los tests que existen y mienten en silencio**. Ninguno de los 10 lo habría parado el typecheck; 6 de los 8 de corrección eran caminos de valor-erróneo-sin-error. La revisión adversarial (16 verificadores intentando refutar) es lo que separa «parece un bug» de «es un bug»: 21/21 confirmados, 0 falsos positivos en el informe final.

## Verificación

373 tests (backend 278, con el guardián nuevo del contador) + 4 E2E en verde; typecheck, lint y build limpios tras los 10 arreglos.
