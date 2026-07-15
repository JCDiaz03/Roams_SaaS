# Auditoría 03 — Ocho pares de color fallaban AA

**Dónde.** `frontend/src/ui/tokens.css` · sesión 06 · commit `e9a75a8`.
**Categoría.** Accesibilidad (requisito duro incumplido).
**Gravedad.** **Silencioso.** Se ve bien. Simplemente no cumple, y nadie lo nota mirando.

## Qué se pidió

Portar los tokens del prototipo de Claude Design (`SaaS-O-Matic.dc.html`), cuyo brief (`diseño-frontend.md` §2.3) dice:

> Requisito duro: **contraste AA en ambos temas**, incluidos los estados deshabilitados y los badges.

## Qué devolvió

Los colores del prototipo, verbatim. Que es lo correcto: el prototipo es la fuente del lenguaje visual y no se «mejora» al portarlo.

## El defecto

Al **medirlos** en vez de mirarlos, **ocho pares fallaban AA**:

| Par | Ratio | Dónde se ve |
|---|---|---|
| blanco sobre primario (oscuro) | **3,44** | **el botón principal de toda la app** |
| `text-3` sobre `surface` (claro) | 2,75 | placeholders |
| `text-3` sobre `surface-2` (claro) | 4,37 | placeholder del buscador |
| `text-3` sobre `surface` (oscuro) | 3,68 | placeholders |
| `text-3` sobre `surface-2` (oscuro) | 3,42 | placeholder del buscador |
| primario sobre `primary-soft` (claro) | 3,91 | chip «Plan Ágora · v2» |
| success sobre `success-soft` (claro) | 3,96 | chip «CIF validado» |
| warning sobre `warning-soft` (claro) | 4,10 | badge de tipos desactualizados |
| danger sobre `danger-soft` (claro) | 4,21 | callout de error |

**La causa no es descuido del diseño, es estructural**: el magenta de marca `#E6007E` sobre blanco da **4,50 exacto**, justo en el umbral. Sobre cualquier fondo teñido cae por debajo. No hay forma de usar la marca como texto sobre un tinte sin salirse.

**Por qué no salta a la vista.** Porque el diseño **se ve bien**. Un contraste de 3,91 es perfectamente legible para quien tiene buena vista y un buen monitor; el requisito AA existe precisamente para quien no. Es un defecto que no se detecta mirando la pantalla, solo midiendo.

## Cómo se detectó

Midiendo. Un script con la fórmula de luminancia relativa de la WCAG sobre los pares que el diseño pinta de verdad.

Y aquí está lo interesante: **el test cazó un par que yo no había medido a mano**. Mi comprobación manual probó `text-3` sobre `surface` (blanco) y lo dio por resuelto; el test, que enumera los pares por su uso real, probó también `text-3` sobre `surface-2` — que es **el fondo del input donde vive el placeholder del buscador**, o sea el sitio donde ese color se usa de verdad. 4,37. Fallaba.

La comprobación manual mira los pares que uno recuerda. El test mira los que están escritos.

## Cómo se corrigió

Dos tokens nuevos, porque el problema estructural no se arregla ajustando un color:

- **`--color-primary-strong`** (`#d40074` en claro): el magenta para **texto sobre tintes**. El de marca se queda para rellenos.
- **`--color-on-primary`**: el texto sobre un relleno primario. En claro es blanco; **en oscuro es texto oscuro** (`#0f0f1c`, ratio 5,53). El brief sube la luminosidad del fucsia en oscuro *a propósito* (§2.3), así que apagarlo para salvar el blanco sería arreglar el problema por el lado equivocado: se cambia el texto, no la marca.

El resto son ajustes del **5-8 % hacia negro**: a ojo no se distinguen.

**Subida de capa: de detectable a imposible.** `ui/tokens.test.ts` **parsea `tokens.css`** —no duplica los valores, los lee— y falla el CI si algún par baja de 4,5. 32 comprobaciones. Verificado que muerde: devolver un color del prototipo lo tumba.

## Qué regla nueva deja

**Un requisito duro que solo vive en un documento no es duro.** El brief decía «AA en ambos temas» y el diseño lo incumplía en ocho sitios; nadie mintió, simplemente nadie lo midió. La diferencia entre una regla y una intención es si algo la comprueba.

Y una más específica: **enumerar los pares por su uso, no por el token**. «`text-3` sobre blanco» es un par que existe en la cabeza; «el placeholder del buscador» es un par que existe en la pantalla. El segundo es el que hay que medir, y es el que cazó el octavo fallo.
