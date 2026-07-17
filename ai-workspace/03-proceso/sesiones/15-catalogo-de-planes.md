# Sesión 15 — La tanda del catálogo de planes (roadmap v2, entera)

**Objetivo.** Cinco ideas de UI del usuario convertidas en features: catálogo de planes visible (dashboard + detalle), valores base del cliente con simulación parametrizada, plan elegido en la simulación con sugeridos, e historial que declara su plan.
**Decisión de partida.** `roams-roadmap_v2.md` (contexto, D1–D8) y las specs 08 y 09, escritas ANTES de codificar. Dos ADRs: 0011 (`plan_id` opcional — revierte una decisión que un test vigilaba) y 0012 (columnas aditivas con `ALTER` idempotente — la primera migración de la historia del proyecto).
**Resultado.** Hecho de punta a punta: backend (+24 tests → 268), frontend (4 componentes nuevos, 6 tocados), E2E ampliados y en verde. **363 tests + 3 E2E.**
**Regla 2**: registrada al cerrar la tanda.

## Prompt de partida

> vamos a hacer algunos cambios en el front que quizas toque el back asique primero ideamos una lista de estas ideas y dime si hay conflicto con las normas del 00-enunciado-reto.docx o de alguna de los .md […]

(La lista literal de las cinco ideas, más la pregunta conceptual sobre planes con métricas ilimitadas y topes con excedente.)

## Cómo se cerró el alcance (las preguntas antes que el código)

Cuatro ambigüedades se resolvieron con el usuario antes de escribir el plan:

1. **¿De dónde salen los valores base?** → Atributos del cliente (columnas nuevas), no un eco de la última simulación. Su contrapropuesta definió además la ficha en tres bloques y que parametrizada/libre compartieran ruta.
2. **¿El selector de plan cambia el contrato del cliente?** → No: visualmente what-if, pero al guardar se guarda con el plan elegido. Con botón de revertir.
3. **¿«Ajustar el plan» de una simulación guardada?** → Confirmado: crea una NUEVA; la guardada es inmutable (§11.2 no se negocia).
4. **¿Topes y excedente estilo telefonía?** → Debatido y **diferido con diseño**: el modelo actual es elástico a propósito (no existe «cantidad contratada»); compromiso+excedente y flat premium quedan en recortes §2.9 y §2.10.

## Conflictos con las normas, y cómo se resolvieron

- **El enunciado no bloqueaba nada** (todo aditivo). Los conflictos eran internos:
- `/planes/:id` era el editor admin → el detalle solo-lectura se queda la URL corta y el editor se va a `/editar` (D1). La URL que circula es la de leer.
- `POST /simulations` **rechazaba** `plan_id` con un guardián → ADR 0011: la regla activo-o-contratado preserva exactamente lo que la prohibición protegía (nadie cotiza con una tarifa archivada ajena), y el guardián se **reescribió como batería de 6 tests**, no se borró.
- `customers` no tenía campos de consumo y el esquema solo corría sobre base nueva → ADR 0012: `ensureColumn()` idempotente que corre siempre al arrancar. **Se verificó sin querer sobre la base real**: el `tsx watch` del servidor de dev del usuario se reinició al editar el backend y migró su `.db` viejo en caliente — columnas añadidas, 5 filas intactas.

## Qué generó

Backend: migración + 3 columnas, `PATCH /customers/:id` acotado (con guardián de que la edición fiscal NO se abrió), `GET /plans/:id` (archivado incluido, sin rol — con test que protege la decisión de un «endurecimiento» futuro), `plan_id` opcional y `plan_name`/`plan_version` desde el snapshot. Frontend: `PlanDetailPage`, `ActivePlansSection`, `BaseValuesBlock`, `PlanSelectorBar`, helper compartido `plan-format.ts` (extraído del panel admin al ganar terceros consumidores), ficha en tres bloques con dos botones de simulación, simulador con inicialización por URL (D6), sugeridos locales con el MISMO `quote()` y «Usar como base» en el historial.

## Qué se rechazó o corrigió por el camino

- **`PrintSheet` imprimía `cliente.plan.name`**: con el plan elegido habría impreso la tarifa equivocada. Ahora imprime el plan de la simulación sellada. Es el defecto que la regla «solo se imprime lo sellado» existía para impedir, y estaba latente desde antes de esta tanda.
- **Sugerir un plan que cotiza a 0 €**: Bitácora (solo almacenamiento) con 15 usuarios y 0 GB salía «más barato» a 0 €. Un plan que no factura nada de lo que el cliente usa no es una sugerencia, es una burla: filtro `0 < total < actual`, escrito en la spec 09 §4.3.
- **Un `PUT /customers/:id` general**: descartado en la spec — abrir la edición de datos fiscales para pasar tres enteros sería alcance gratis. El `additionalProperties: false` del PATCH convierte «la puerta sigue cerrada» en un test.

## Verificación

- Suite entera: **61 + 268 + 34 = 363 tests** en verde; typecheck y lint limpios; build de producción OK.
- **E2E ampliados y en verde (3/3)**: el smoke admin ahora entra por la **parametrizada** de Nébula (el caso literal del enunciado precargado desde el seed, «base: 15» visible), clava la URL `/planes/:id/editar` (D1) y comprueba que tras versionar a v3 la simulación vieja **sigue declarando su v2**; el comercial verifica el chip del plan en el historial y el flujo «usar como base» (sliders precargados con las entradas de la guardada).
- Migración comprobada dos veces: sobre el `.db` real de dev (datos intactos) y con `migrate.test.ts` (base con DDL viejo, doble pasada, CHECK vigente en bases migradas).
