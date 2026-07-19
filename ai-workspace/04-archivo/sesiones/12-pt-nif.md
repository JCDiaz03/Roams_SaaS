# Sesión 12 — `PT_NIF`: la promesa del registro, ejecutada (Fase 3, §5.3)

**Objetivo.** El segundo validador fiscal, como demostración medible de que "añadir un país = una clase + una entrada + una columna, cero cambios en endpoints" (referencia §7.2).
**Spec de partida.** `02-validacion-fiscal-y-alta-cliente.md`, ampliada con el §3.3 en esta misma sesión.
**Resultado.** Hecho. 16 tests nuevos (235 de backend, 330 en el repo), y el diff es la prueba: ni un endpoint ni un componente tocados.
**Regla 2**: registrada al cerrar la sesión.

## Prompt de partida

> haz el commit y sigue con el 5.3

## Qué generó

`pt-nif.validator.ts` (prefijos asignados por la AT + mod 11 con el pliegue de restos 0/1 → control 0), su línea en el registro, el tipo `'NIF'` en `FiscalIdType` **y en el `CHECK` de `customers` en el mismo commit**, PT con esquema en el seed, y Lusitânia Dados Lda. como quinto cliente de demo (NIF sintético `512345678`, sembrado sin normalizar, como Nébula).

## La mejor parte: los tests que se rompieron

Cuatro tests usaban `PT_NIF` como **ejemplo de esquema no registrado** ("un seed que escribe `PT_NIF` antes de que exista la clase…"), y al registrarlo de verdad se rompieron los cuatro. No es un accidente: es el ciclo de vida exacto que esos tests protegen, completado. El ejemplo migró a `FR_SIREN` y los comentarios lo declaran en vez de disimularlo.

## Qué se aceptó

- **Prefijos asignados, no solo checksum**: un validador que acepte cualquier nueve-dígitos-con-checksum es más permisivo de lo correcto — el mismo criterio que dejó K/L/M fuera del CIF. Los tests lo fijan con cuatro NIFs de **checksum correcto y prefijo no asignado**. Contrapartida declarada: si la AT asigna un rango nuevo, es una línea de la regex.
- **`type: 'NIF'` como valor nuevo de la columna** en vez de reutilizar `unvalidated` o inventar `PT_NIF` como tipo: el chip del frontend pinta lo que recibe («NIF validado»), y la colisión con el "NIF" español no existe porque aquel devuelve el tipo concreto (DNI/NIE/CIF).
- **Vectores de test calculados a mano** y con los dos restos del pliegue (0 y 1 → control 0) cubiertos: es el mutante clásico de este algoritmo, como el mod 10 exterior lo era del CIF. Dos vectores salieron mal en el primer intento y se recalcularon — la razón por la que la batería existe.

## Qué se rechazó

- **Aceptar el prefijo `PT` de la forma VIES** (`PT123456789`): el alta pide el identificador nacional, no el número de IVA intracomunitario; aceptar ambos silenciosamente confundiría el UNIQUE (dos formas de la misma empresa). Si mañana hace falta, es una decisión de producto, no un descuido.
- **Un `GET /plans`-style refactor de los fallbacks**: nada que refactorizar — el flujo del alta no se tocó, que era el punto.

## Nota de migración local

El `CHECK` de `customers` cambió: una base `.db` creada antes de esta sesión rechazaría el alta de un cliente portugués (y no tiene el esquema de PT en `countries`). Como el fichero se regenera solo, la "migración" en desarrollo es borrar `backend/roams.db`; un evaluador que clona en limpio no la nota.
