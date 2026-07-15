// Fallbacks: sin esquema, pais inexistente, esquema no registrado. Spec: 15

import { describe, expect, it } from 'vitest'
import { SpanishTaxIdValidator } from './es-nif.validator'
import { PASS_THROUGH, hasValidator, registeredSchemes, validatorFor } from './registry'

describe('registro — resolucion por esquema', () => {
  it('ES_NIF resuelve al validador espanol', () => {
    const v = validatorFor('ES_NIF')

    expect(v).toBeInstanceOf(SpanishTaxIdValidator)
    expect(v.validates).toBe(true)
    expect(v.validate('B12345674')).toEqual({ valid: true, type: 'CIF' })
  })

  it('devuelve la MISMA instancia: los validadores no tienen estado', () => {
    expect(validatorFor('ES_NIF')).toBe(validatorFor('ES_NIF'))
  })

  it('las claves van espaciadas por pais', () => {
    // "NIF" existe en Espana y en Portugal con algoritmos distintos: una clave "NIF"
    // seria una colision esperando a ocurrir.
    for (const scheme of registeredSchemes()) {
      expect(scheme).toMatch(/^[A-Z]{2}_[A-Z]+$/)
    }
  })
})

describe('registro — fallback de pais sin esquema', () => {
  it('scheme null resuelve a PassThrough, y no es un if', () => {
    expect(validatorFor(null)).toBe(PASS_THROUGH)
    expect(validatorFor(null).validates).toBe(false)
  })

  it('PassThrough acepta cualquier cosa como unvalidated', () => {
    // Nueve de los diez paises del seed pasan por aqui. No es un estado transitorio: es
    // el estado final del caso mayoritario (referencia 7.1).
    for (const id of ['12345678', 'GB123456789', 'X', '']) {
      expect(validatorFor(null).validate(id)).toEqual({ valid: true, type: 'unvalidated' })
    }
  })

  it('su hint no promete una validacion que no ocurre', () => {
    expect(PASS_THROUGH.hint).toBe('Identificador fiscal')
    expect(PASS_THROUGH.hint).not.toMatch(/comprueba|valida|automátic/i)
  })

  it('un pais sin esquema NO pasa por el algoritmo espanol', () => {
    // El fiscal_id britanico "12345678" es invalido como DNI (le falta la letra) y aqui
    // se acepta. Es justo lo que el fallback existe para permitir.
    expect(validatorFor('ES_NIF').validate('12345678').valid).toBe(false)
    expect(validatorFor(null).validate('12345678').valid).toBe(true)
  })
})

describe('registro — esquema no registrado: nunca degradar en silencio', () => {
  it('lanza en vez de devolver PassThrough', () => {
    // Es el fallo que este diseno mas teme: un seed que escribe tax_id_scheme = PT_NIF
    // antes de que exista la clase daria de alta a los clientes portugueses SIN VALIDAR,
    // marcados como 'unvalidated', y nadie se enteraria hasta auditar los datos.
    expect(() => validatorFor('PT_NIF')).toThrow(/no registrado/)
    expect(() => validatorFor('CUALQUIER_COSA')).toThrow()
  })

  it('el error dice que hacer, no solo que ha fallado', () => {
    expect(() => validatorFor('PT_NIF')).toThrow(/pass-through/)
  })

  it('hasValidator es lo que el chequeo de arranque usa para abortar', () => {
    // El chequeo de integridad (referencia 7.3) recorre los tax_id_scheme no nulos de
    // countries y aborta el proceso si alguno no esta registrado, ANTES de aceptar
    // peticiones. validatorFor() lanzando es el cinturon de ese tirante.
    expect(hasValidator('ES_NIF')).toBe(true)
    expect(hasValidator('PT_NIF')).toBe(false)
  })
})

describe('registro — contenido', () => {
  it('hoy solo hay un esquema, y es el que exige el enunciado', () => {
    expect(registeredSchemes()).toEqual(['ES_NIF'])
  })

  it('todo validador registrado cumple el contrato', () => {
    for (const scheme of registeredSchemes()) {
      const v = validatorFor(scheme)

      expect(typeof v.hint).toBe('string')
      expect(v.hint.length).toBeGreaterThan(0)
      expect(v.validates).toBe(true) // si validates fuera false, sobraria el registro
      expect(typeof v.validate).toBe('function')
    }
  })
})
