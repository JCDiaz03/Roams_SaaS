// Bateria del NIF portugues: validos por prefijo, checksum, restos 0/1/10, prefijos no asignados. Spec: 02 §4.6

import { describe, expect, it } from 'vitest'
import { normalizeFiscalId } from './normalize'
import { PortugueseTaxIdValidator } from './pt-nif.validator'

const v = new PortugueseTaxIdValidator()

describe('PT_NIF — validos', () => {
  it.each([
    ['123456789', 'persona singular (1): el ejemplo canonico del algoritmo'],
    ['512345678', 'persona colectiva (5): el caso B2B, el del seed'],
    ['450000001', 'no residente (45)'],
    ['700000003', 'herencia indivisa (70)'],
    ['912345675', 'no residente colectivo (91)'],
    ['380000008', 'persona singular (3)'],
  ])('%s — %s', (nif) => {
    expect(v.validate(nif)).toEqual({ valid: true, type: 'NIF' })
  })

  it('resto 0 y resto 1 -> control 0: el pliegue del mod 11', () => {
    // 5,5,0,0,0,0,0,7 ponderados 9..2 suman 99 (resto 0); 5,6,1,0,0,0,0,0 suman 100
    // (resto 1). En ambos, 11 - resto daria 11 o 10, que no son un digito: el control
    // es 0. Es el mutante clasico de este algoritmo (como el mod 10 exterior del CIF).
    expect(v.validate('550000070').valid).toBe(true)
    expect(v.validate('561000000').valid).toBe(true)
  })

  it('la forma que teclea un humano valida tras normalizar, que es lo que hace el alta', () => {
    expect(v.validate(normalizeFiscalId('512 345 678'))).toEqual({ valid: true, type: 'NIF' })
    expect(v.validate(normalizeFiscalId('123-456-789'))).toEqual({ valid: true, type: 'NIF' })
  })
})

describe('PT_NIF — invalidos', () => {
  it('checksum que no cuadra -> invalido, pero CON tipo: tiene forma de NIF', () => {
    expect(v.validate('123456780')).toEqual({ valid: false, type: 'NIF' })
    expect(v.validate('512345679')).toEqual({ valid: false, type: 'NIF' })
  })

  it.each([
    ['400000008', '40 no esta asignado (solo 45 entre los cuarenta)'],
    ['730000001', '73 no esta asignado (los setenta saltan 73 y 76)'],
    ['920000002', '92 no esta asignado (los noventa son 90, 91, 98, 99)'],
    ['012345679', 'ningun NIF empieza por 0'],
  ])('%s con checksum CORRECTO -> invalido: %s', (nif) => {
    // El checksum de estos cuatro cuadra a proposito: lo que se rechaza es el prefijo.
    // Un validador que acepte cualquier 9-digitos-con-checksum es mas permisivo de lo
    // correcto, el mismo criterio que deja K/L/M fuera del CIF español.
    expect(v.validate(nif).valid).toBe(false)
  })

  it('la forma que no es de NIF -> unvalidated, no un tipo a medias', () => {
    for (const raro of ['12345678', '1234567890', '12345678A', 'PT123456789', '']) {
      expect(v.validate(raro)).toEqual({ valid: false, type: 'unvalidated' })
    }
  })
})
