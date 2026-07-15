# Sesión 03 — Esquema SQL y seed

**Objetivo.** El DDL de las seis tablas y el script de seed, para que la base se cree y se pueble sola en el primer arranque.
**Spec de partida.** `01-specs/modelo-datos.md` (escrita en la sesión 01) y referencia §2.1.
**Resultado.** Hecho. Commit `52751d3` — cierra la Fase 0.

## Prompt de partida

> ahora el esquema SQL y el script de seed

## Qué generó

`schema.sql` con las seis tablas, `db.ts` (conexión), `migrate.ts` y `seed.ts` con `ensureDatabase()`. El DDL salió casi literal de `modelo-datos.md`: escribir la spec primero convirtió esta sesión en transcripción, que es exactamente lo que la Fase 0 compraba.

## Qué se aceptó

- `PRAGMA foreign_keys = ON` en `db.ts` y no en el `.sql`: no es persistente y se aplica **por conexión**. Sin esa línea, todas las claves ajenas del esquema son decorativas.
- `STRICT` en todas las tablas y los `CHECK` que convierten reglas de documento en garantías: `total_minor = base_minor + tax_minor`, `fiscal_id = upper(fiscal_id)`, `json_valid(pricing_snapshot)`.

## Qué se rechazó, y por qué

- **Que `migrate.ts` supiera del seed** → rechazado. La primera versión tenía `ensureDatabase()` en `migrate.ts`, que importa `seed.ts`, que importaba `migrate.ts`: un ciclo. La dependencia natural va en **una sola dirección** —sembrar exige tablas, crear tablas no exige datos—, así que `ensureDatabase()` bajó a `seed.ts` y `migrate.ts` se quedó sin saber que el seed existe.
- **Declarar el `fiscal_id_type` en los datos del seed** → rechazado en la sesión 05, cuando existió el validador. Declararlo permite escribir `'DNI'` junto a un CIF y que nadie se entere; el seed **se lo pregunta al validador**, igual que el endpoint.

## Lo que de verdad valió: verificarlo ejecutándolo

No me fié de que el script no petara. Monté un fichero temporal y comprobé contra la base ya sembrada que:

- la regla de vigencia resuelve **21 %** para España y no el 18 % histórico (el seed lleva dos filas de `tax_rates` a propósito);
- los tramos del Plan A dan `10×1000 + 5×800 = 14000` = **140 €**;
- **las ocho defensas del esquema saltan de verdad**: la FK rechaza un país inexistente (o sea, el pragma está activo), `STRICT` rechaza texto en columna entera, el `CHECK` rechaza un `fiscal_id` en minúsculas, el UNIQUE caza el duplicado, `total = base + tax` no admite una suma rota, `json_valid` rechaza un snapshot corrupto, no se puede borrar físicamente un plan referenciado, y `pricing_model` no admite `volume`.

Y que `npm run seed` sobre una base ya poblada **se niega con exit 1** en vez de reventar con un choque de UNIQUE que no explicaría nada.

## Qué aprendió el prompt siguiente

Que «no ha dado error» y «hace lo que dice» son cosas distintas. A partir de aquí, cada sesión acaba ejecutando lo construido y mirando el resultado, no el código.
