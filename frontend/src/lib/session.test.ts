// La costura del auth mock: el rol se deriva UNA vez. Spec: 15, referencia 8.2
//
// El grueso de esta feature es una decision de diseno, no un algoritmo. Los tests que
// valen aqui son los que protegen LA COSTURA, no el mock.

import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

// fileURLToPath, y NO url.pathname: en Windows el pathname de un file:// deja un "/"
// delante de la letra de unidad y join() acaba componiendo "C:\C:\...".
const SRC = fileURLToPath(new URL('..', import.meta.url))

function ficherosFuente(dir: string): string[] {
  return readdirSync(dir).flatMap((entrada) => {
    const ruta = join(dir, entrada)
    if (statSync(ruta).isDirectory()) return ficherosFuente(ruta)
    return /\.tsx?$/.test(entrada) && !/\.test\.tsx?$/.test(entrada) ? [ruta] : []
  })
}

/**
 * Quita comentarios antes de buscar.
 *
 * Sin esto, el test se caza a si mismo: los comentarios que EXPLICAN la regla ("el
 * literal ADMIN vive en un solo sitio") contienen el literal, y un test que prohibe
 * documentar la regla que protege es un test que se acaba borrando.
 */
function soloCodigo(contenido: string): string {
  return contenido.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')
}

describe('el literal "ADMIN" vive en un solo sitio', () => {
  it('aparece exactamente una vez en todo frontend/src', () => {
    // ES EL TEST QUE IMPORTA DE ESTA FEATURE. Los demas comprueban que el mock funciona;
    // este comprueba que SIGUE SIENDO SUSTITUIBLE EN UN MODULO, que es la unica razon por
    // la que un mock es aceptable (referencia 8.2).
    //
    // Con `if (usuario === "ADMIN")` esparcido por veinte componentes, sustituir el mock
    // significa encontrarlos y tocarlos todos, y el que se olvide no falla: deja de
    // proteger, en silencio. Con la derivacion en un punto, es cambiar una funcion.
    const apariciones = ficherosFuente(SRC).flatMap((f) => {
      const contenido = soloCodigo(readFileSync(f, "utf8"))
      return [...contenido.matchAll(/'ADMIN'|"ADMIN"/g)].map(() => f)
    })

    expect(apariciones.map((f) => relative(SRC, f).split('\\').join('/'))).toEqual(['lib/session.tsx'])
  })

  it('ningun componente compara el rol a mano: se pregunta con hasRole()', () => {
    // Un `session.rol === 'admin'` fuera de la sesion es la misma deuda con otro nombre.
    const fuera = ficherosFuente(SRC)
      .filter((f) => !f.endsWith('session.tsx'))
      .filter((f) => /rol\s*===|role\s*===/.test(readFileSync(f, 'utf8')))

    expect(fuera.map((f) => relative(SRC, f).split('\\').join('/'))).toEqual([])
  })
})
