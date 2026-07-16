// Guardianes de la costura de sesion: el rol lo deriva el SERVIDOR. Spec: 07-autenticacion.md 8
//
// El grueso de esta feature es una decision de diseno, no un algoritmo. Los tests que
// valen aqui son los que protegen LA COSTURA: que nadie vuelva a derivar el rol en el
// cliente ni a comparar strings fuera de la sesion.

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

describe('el literal "ADMIN" NO vive en el frontend', () => {
  it('aparece cero veces en todo frontend/src', () => {
    // Desde la spec 07 el rol lo deriva el SERVIDOR (el literal vive en el
    // MockIdentityProvider del backend, con su propio guardian en auth.test.ts). Si el
    // literal reaparece aqui, alguien ha vuelto a derivar el rol en el cliente: la misma
    // deuda que el mock original evito, reintroducida con el auth ya real.
    const apariciones = ficherosFuente(SRC).flatMap((f) => {
      const contenido = soloCodigo(readFileSync(f, "utf8"))
      return [...contenido.matchAll(/'ADMIN'|"ADMIN"/g)].map(() => f)
    })

    expect(apariciones.map((f) => relative(SRC, f).split('\\').join('/'))).toEqual([])
  })

  it('ningun componente compara el rol a mano: se pregunta con hasRole()', () => {
    // Un `session.rol === 'admin'` fuera de la sesion es la misma deuda con otro nombre.
    const fuera = ficherosFuente(SRC)
      .filter((f) => !f.endsWith('session.tsx'))
      .filter((f) => /rol\s*===|role\s*===/.test(readFileSync(f, 'utf8')))

    expect(fuera.map((f) => relative(SRC, f).split('\\').join('/'))).toEqual([])
  })
})
