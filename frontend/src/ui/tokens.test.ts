// El contraste AA de los dos temas, como test. Diseno: 2.3 ("requisito duro")
//
// Por que existe: el brief pone el AA como requisito duro, y al medir los tokens del
// prototipo siete pares fallaban. Un requisito duro que solo vive en un documento se
// rompe el primer dia que alguien retoque un color "para que se vea mejor".
//
// Esto es la capa 2 de las directrices (directrices-ia.md 1): la regla no esta en una
// nota, esta en el CI. El test PARSEA tokens.css, asi que no puede desincronizarse de los
// valores reales.

import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const CSS = readFileSync(new URL('./tokens.css', import.meta.url), 'utf8')

/** Extrae los `--token: #hex` de un bloque (`:root, [data-theme='light']` o el oscuro). */
function tokensDe(selector: string): Record<string, string> {
  const bloque = CSS.split(selector)[1]?.split('}')[0]
  if (bloque === undefined) throw new Error(`No encuentro el bloque "${selector}" en tokens.css`)

  const encontrados: Record<string, string> = {}
  for (const [, nombre, hex] of bloque.matchAll(/(--[\w-]+)\s*:\s*(#[0-9a-fA-F]{6})/g)) {
    if (nombre !== undefined && hex !== undefined) encontrados[nombre] = hex.toLowerCase()
  }
  return encontrados
}

const LIGHT = tokensDe("[data-theme='light']")
const DARK = tokensDe("[data-theme='dark']")

// --- WCAG 2.1, formulas 1.4.3 -------------------------------------------------------

function canalLineal(v: number): number {
  const c = v / 255
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
}

function luminancia(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16))
  return (
    0.2126 * canalLineal(r ?? 0) + 0.7152 * canalLineal(g ?? 0) + 0.0722 * canalLineal(b ?? 0)
  )
}

export function contrast(a: string, b: string): number {
  const [l1, l2] = [luminancia(a), luminancia(b)]
  const [alto, bajo] = l1 > l2 ? [l1, l2] : [l2, l1]
  return (alto + 0.05) / (bajo + 0.05)
}

// --- Los pares que el diseno pinta de verdad -----------------------------------------
//
// Cada entrada es [texto, fondo, donde se ve]. Si anades un token de color, anade su par.

const PARES: readonly (readonly [string, string, string])[] = [
  ['--color-ink', '--color-surface', 'texto principal en tarjetas'],
  ['--color-ink', '--color-bg', 'texto principal sobre el fondo'],
  ['--color-ink', '--color-surface-2', 'texto en inputs y chips neutros'],
  ['--color-text-2', '--color-surface', 'texto secundario y labels'],
  ['--color-text-2', '--color-bg', 'texto secundario sobre el fondo'],
  ['--color-text-3', '--color-surface', 'placeholders del buscador'],
  ['--color-text-3', '--color-surface-2', 'placeholders dentro de un input'],
  ['--color-on-primary', '--color-primary', 'texto del boton primario'],
  ['--color-primary', '--color-surface', 'enlaces'],
  ['--color-primary-strong', '--color-primary-soft', 'chip de marca (Plan Agora · v2)'],
  ['--color-ink', '--color-primary-soft', 'callout de info'],
  ['--color-success', '--color-success-soft', 'chip "CIF validado"'],
  ['--color-warning', '--color-warning-soft', 'chip "Tipos del 12 jul"'],
  ['--color-danger', '--color-danger-soft', 'callout de error de validacion'],
  ['--color-danger', '--color-surface', 'texto de error junto al campo'],
]

const AA_TEXTO_NORMAL = 4.5

describe.each([
  ['claro', LIGHT],
  ['oscuro', DARK],
])('contraste AA — tema %s', (_tema, tokens) => {
  it.each(PARES)('%s sobre %s: %s', (fg, bg) => {
    const colorFg = tokens[fg]
    const colorBg = tokens[bg]

    // Si un token falta en un tema, el par no se puede comprobar: eso es un fallo, no un
    // caso a saltar. Los dos temas definen los mismos tokens o el intercambio esta roto.
    expect(colorFg, `falta ${fg}`).toBeDefined()
    expect(colorBg, `falta ${bg}`).toBeDefined()

    // Todo el texto del diseno es <= 16px, asi que NINGUN par se acoge al 3:1 de texto
    // grande. El umbral es 4,5 sin excepciones.
    expect(contrast(colorFg as string, colorBg as string)).toBeGreaterThanOrEqual(AA_TEXTO_NORMAL)
  })
})

describe('los dos temas son intercambiables', () => {
  it('definen exactamente los mismos tokens', () => {
    // Si el oscuro se olvida un token, hereda el del claro por la cascada y el fallo es
    // invisible hasta que alguien mira la pantalla. Aqui salta.
    expect(Object.keys(DARK).sort()).toEqual(Object.keys(LIGHT).sort())
  })

  it('ningun token vale lo mismo en los dos temas, salvo los declarados', () => {
    // --color-primary-strong SI coincide con --color-primary en oscuro, y es deliberado
    // (alli el rosa sobre el tinte ya pasa AA). El resto compartiendo valor seria un
    // olvido al copiar el bloque.
    const compartidos = Object.keys(LIGHT).filter((k) => LIGHT[k] === DARK[k])
    expect(compartidos).toEqual([])
  })
})
