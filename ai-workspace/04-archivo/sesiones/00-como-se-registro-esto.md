# Nota de procedencia: cómo se registró esto

**Estos ficheros se transcribieron al final del proceso, no durante.** Conviene decirlo antes que nada, por tres razones.

La primera es que **el roadmap dice explícitamente que no se haga así**: la regla 2 exige que `/ai-workspace` «se alimente por sesión, desde el día 1, no se reconstruya al final». La regla es buena y aquí no se cumplió. Es un incumplimiento del propio plan, y ocultarlo sería peor que el incumplimiento.

La segunda es que **el `plantillas.md` de este mismo directorio avisa de lo que pasa cuando se hace a posteriori**: «un prompt reescrito para que se vea bien no demuestra nada, y es la parte más fácil de detectar como falsa». Presentar esto como si se hubiera escrito sobre la marcha sería, además, inútil: `git log` muestra que todo `sesiones/` entró en un único commit al final.

Y la tercera es que **el contenido sí es real, y es verificable**, que es lo que salva el registro:

- **Los prompts son literales.** Están copiados tal cual se enviaron, con sus abreviaturas y sus erratas (`"tengo el front hecho con el desing conecta e importa"`). No se han limpiado.
- **Cada sesión corresponde a un commit**, y el commit está enlazado. Lo que dice haber construido está en el diff.
- **Cada hallazgo es comprobable**. Cuando una sesión dice «un test cazó que `additionalProperties: false` no daba 400», ese test existe, ese commit lo arregla, y quien dude puede revertir el arreglo y ver el test ponerse rojo.

Lo que se perdió por no escribirlo a tiempo es real y no se puede recuperar: **los callejones sin salida**. Un registro escrito al final tiende a contar una línea recta —problema, decisión, solución— porque es lo que queda en la memoria y en el diff. Los diez minutos peleándose con el arnés de Chrome antes de descubrir que estaba conectado a un `background_page` aparecen aquí porque se recuerdan; los que no dejaron rastro, no aparecen. Un registro contemporáneo los tendría todos, y esa es exactamente su ventaja.

---

## Qué buscar aquí

`sesiones/` cuenta **qué se construyó y cómo se dirigió al modelo**, una por commit. `auditorias/` cuenta **qué defecto tenía el código generado y cómo se detectó**, una por hallazgo que sobrevivió a la primera lectura.

Si solo hay tiempo para mirar tres cosas, que sean las tres auditorías: son los defectos **silenciosos** —los que compilan, pasan los tests que existen y están mal—, que es donde el control de calidad demuestra si sirve para algo.

| Sesión | Commit | Lo que importa |
|---|---|---|
| [01 — Los esqueletos de Fase 0](01-esqueletos-fase-0.md) | `53a10af` | Diez documentos antes de una línea de código. Se rechaza el `REAL` para los tipos impositivos |
| [02 — Repo público y `.gitignore`](02-repo-publico.md) | `5747351` | Sin lockfile el CI no arrancaba. Y un token expuesto por mi culpa |
| [03 — Esquema SQL y seed](03-esquema-y-seed.md) | `52751d3` | Las ocho defensas del esquema, verificadas ejecutándolas |
| [04 — El paquete `pricing`](04-paquete-pricing.md) | `f4d56ce` | 61 tests, validados por mutación. Dos fallos míos en los tests |
| [05 — Validación fiscal](05-validacion-fiscal.md) | `4bf3e31` | Un test destapó un error de diseño: K/L/M no son CIF |
| [06 — Importar el diseño](06-importar-el-diseno.md) | `e9a75a8` | Del prototipo se porta el aspecto, no la lógica. Ocho pares fallaban AA |
| [07 — El backend](07-backend.md) | `49dd58e` | `additionalProperties: false` no daba 400. El invariante 1 no era verificable |
| [08 — Las cinco pantallas](08-cinco-pantallas.md) | `e4fe7dd` | El test que protege la costura del auth, no el mock |
| [09 — Fase 2](09-fase-2.md) | `5dc4eb8` | Mi propia spec inducía a un bug: «Crear → versión 1» |

| Auditoría | Categoría | Por qué era silenciosa |
|---|---|---|
| [01 — `removeAdditional` de Fastify](../auditorias/01-additional-properties-no-da-400.md) | Invariante roto | El campo sobrante se borraba y devolvía `201` |
| [02 — K, L y M como iniciales de CIF](../auditorias/02-klm-no-son-cif.md) | Corrección | Checksum equivocado: daba por bueno lo que no lo era |
| [03 — Contraste AA del prototipo](../auditorias/03-contraste-aa.md) | Accesibilidad | Se ve bien. Simplemente no cumple |
