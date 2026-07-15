// Bateria DNI/NIE/CIF validos e invalidos; CIF la mas amplia. Spec: 15

import { describe, expect, it } from 'vitest'
import { SpanishTaxIdValidator } from './es-nif.validator'
import { normalizeFiscalId } from './normalize'

const validador = new SpanishTaxIdValidator()
const valida = (id: string) => validador.validate(id)

describe('ES_NIF — CIF (el caso mayoritario: la herramienta es B2B)', () => {
  describe('validos', () => {
    it.each([
      ['B12345674', 'S.L. con control numerico; es el CIF que siembra el seed'],
      ['A87654323', 'S.A. con control numerico; el otro del seed'],
      ['P1234567D', 'ayuntamiento: exige control LETRA (indice 4 de JABCDEFGHI)'],
      ['S1234567D', 'organo de la Administracion: tambien exige letra'],
      ['B12345690', 'checksum que acaba en 0: cuadra con el mod 10 exterior'],
    ])('%s es valido (%s)', (id) => {
      expect(valida(id)).toEqual({ valid: true, type: 'CIF' })
    })

    it('los tipos que admiten AMBOS controles aceptan el numero y la letra', () => {
      // C, D, F, G, J, L, M, U, V admiten cualquiera de los dos. Mismos digitos, mismo
      // checksum (control 4 / letra D), y las dos formas valen.
      expect(valida('C12345674')).toEqual({ valid: true, type: 'CIF' })
      expect(valida('C1234567D')).toEqual({ valid: true, type: 'CIF' })
    })
  })

  describe('el tipo de organizacion decide QUE control admite', () => {
    // Estos dos son los casos que un validador permisivo -uno que acepte siempre ambos-
    // deja pasar. El checksum es CORRECTO en los dos; lo que falla es el tipo de control.
    it('A1234567D: el checksum es la letra correcta, pero una S.A. exige numero', () => {
      expect(valida('A1234567D').valid).toBe(false)
      expect(valida('A12345674').valid).toBe(true) // la misma entidad con numero, si
    })

    it('P12345674: el checksum es el numero correcto, pero un ayuntamiento exige letra', () => {
      expect(valida('P12345674').valid).toBe(false)
      expect(valida('P1234567D').valid).toBe(true) // la misma entidad con letra, si
    })

    it.each(['A', 'B', 'E', 'H'])('%s exige control numerico', (org) => {
      expect(valida(`${org}12345674`).valid).toBe(true)
      expect(valida(`${org}1234567D`).valid).toBe(false)
    })

    it.each(['P', 'Q', 'R', 'S', 'N', 'W'])('%s exige control letra', (org) => {
      expect(valida(`${org}1234567D`).valid).toBe(true)
      expect(valida(`${org}12345674`).valid).toBe(false)
    })

    it.each(['C', 'D', 'F', 'G', 'J', 'U', 'V'])('%s admite los dos controles', (org) => {
      expect(valida(`${org}12345674`).valid).toBe(true)
      expect(valida(`${org}1234567D`).valid).toBe(true)
    })
  })

  describe('invalidos', () => {
    it('rechaza un control que no cuadra', () => {
      expect(valida('B12345675')).toEqual({ valid: false, type: 'CIF' })
      expect(valida('A87654321').valid).toBe(false)
      // Reconoce el formato aunque el control falle: es lo que permite un mensaje util.
      expect(valida('B12345675').type).toBe('CIF')
    })

    it.each(['I12345674', 'O12345674', 'T12345674'])(
      '%s: inicial prohibida (I y O se confunden con 1 y 0)',
      (id) => {
        expect(valida(id).valid).toBe(false)
      },
    )

    it.each(['X12345674', 'Y12345674', 'Z12345674'])('%s: X/Y/Z son NIE, no CIF', (id) => {
      expect(valida(id).type).not.toBe('CIF')
    })

    it.each([
      ['B123456', 'seis digitos'],
      ['B123456749', 'ocho digitos'],
      ['B1234567', 'sin control'],
      ['12345674B', 'la letra al final'],
      ['B1234567K', 'control fuera de 0-9A-J'],
    ])('%s: %s', (id) => {
      expect(valida(id).valid).toBe(false)
    })
  })

  it('el mod 10 exterior: sin el, todo checksum acabado en 0 se rechazaria', () => {
    // suma = 30 -> 30 mod 10 = 0 -> "10 - 0" da 10, que NO es un digito. Con el mod
    // exterior, control = 0. Es el off-by-one clasico del algoritmo.
    expect(valida('B12345690')).toEqual({ valid: true, type: 'CIF' })
    // Y el 10 no es un control posible: B1234569 + "10" no cabe ni en el formato.
    expect(valida('B123456910').valid).toBe(false)
  })
})

describe('ES_NIF — DNI', () => {
  it.each([
    ['12345678Z', 'el caso de manual: 12345678 mod 23 = 14 -> Z'],
    ['00000000T', 'mod 23 = 0 -> T, la primera letra del alfabeto de control'],
    ['00000001R', 'mod 23 = 1 -> R'],
    ['11111111H', 'mod 23 = 18 -> H'],
    ['99999999R', 'el mayor DNI posible'],
  ])('%s es valido (%s)', (id) => {
    expect(valida(id)).toEqual({ valid: true, type: 'DNI' })
  })

  it('rechaza la letra que no cuadra con los digitos', () => {
    expect(valida('12345678A')).toEqual({ valid: false, type: 'DNI' })
    expect(valida('12345678Y').valid).toBe(false)
  })

  it.each(['12345678I', '12345678O', '12345678U'])(
    '%s: I, O y U no estan en el alfabeto de control',
    (id) => {
      expect(valida(id).valid).toBe(false)
    },
  )

  it('rechaza longitudes que no son 8 digitos', () => {
    expect(valida('1234567Z').valid).toBe(false)
    expect(valida('123456789Z').valid).toBe(false)
  })
})

describe('ES_NIF — NIE', () => {
  it.each([
    ['X1234567L', 'X -> 0, o sea 01234567 mod 23 = 19 -> L'],
    ['Y1234567X', 'Y -> 1, o sea 11234567 mod 23 = 10 -> X'],
    ['Z1234567R', 'Z -> 2, o sea 21234567 mod 23 = 1 -> R'],
  ])('%s es valido (%s)', (id) => {
    expect(valida(id)).toEqual({ valid: true, type: 'NIE' })
  })

  it('la inicial se SUSTITUYE, no se ignora: las tres dan letras distintas', () => {
    // Si alguien implementara el NIE quitando la inicial en vez de sustituirla, las tres
    // darian la misma letra. Es el bug que este test caza.
    const letras = ['X1234567', 'Y1234567', 'Z1234567'].map((base) => {
      for (const l of 'TRWAGMYFPDXBNJZSQVHLCKE') {
        if (valida(base + l).valid) return l
      }
      throw new Error(`Ningun control valido para ${base}`)
    })

    expect(letras).toEqual(['L', 'X', 'R'])
    expect(new Set(letras).size).toBe(3)
  })

  it('rechaza la sustitucion cruzada', () => {
    // L es el control de X1234567. Con Y no vale.
    expect(valida('Y1234567L')).toEqual({ valid: false, type: 'NIE' })
    expect(valida('Z1234567L').valid).toBe(false)
  })

  it('W no es NIE: es una inicial de CIF', () => {
    expect(valida('W1234567D').type).toBe('CIF')
  })
})

describe('ES_NIF — formato no reconocido', () => {
  it.each(['', 'HOLA', '123', 'B', '????????Z', '12345678'])(
    '%s no es ni DNI ni NIE ni CIF',
    (id) => {
      expect(valida(id)).toEqual({ valid: false, type: 'unvalidated' })
    },
  )

  it('valid:false + type:unvalidated NO es lo mismo que valid:true + type:unvalidated', () => {
    // El segundo es lo que devuelve PassThrough (pais sin esquema): se guarda tal cual.
    // El primero es "no reconozco esto". El par nunca es ambiguo.
    expect(valida('HOLA')).toEqual({ valid: false, type: 'unvalidated' })
  })
})

describe('ES_NIF — alcance declarado', () => {
  it('valida la estructura, NO la existencia', () => {
    // No-objetivo explicito (referencia 7.6): el mod 23 dice que la letra cuadra con los
    // digitos, no que ese DNI se haya emitido nunca. No se consulta AEAT ni VIES.
    // 00000000T es estructuralmente perfecto y no existe.
    expect(valida('00000000T')).toEqual({ valid: true, type: 'DNI' })
  })

  it.each(['K', 'L', 'M'])(
    'los NIF especiales de persona fisica (%s) no son CIF y se rechazan',
    (inicial) => {
      // Recorte consciente: K (menores), L (espanoles no residentes) y M (extranjeros
      // sin NIE) son NIF de PERSONA FISICA, y su control es una letra mod 23 como el
      // DNI, no el checksum ponderado del CIF. La herramienta es B2B: no son clientes
      // corporativos.
      //
      // Lo importante es que NO se cuelen como CIF: si estuvieran en el conjunto de
      // iniciales, este validador les calcularia el checksum equivocado y daria por
      // bueno lo que no lo es. Se rechazan enteros, con cualquier control.
      for (const control of '0123456789ABCDEFGHIJ') {
        expect(valida(`${inicial}1234567${control}`).valid).toBe(false)
      }
      expect(valida(`${inicial}1234567D`).type).not.toBe('CIF')
    },
  )

  it('espera la forma YA normalizada: no normaliza por su cuenta', () => {
    // La normalizacion es un paso previo y explicito (normalize.ts). Este validador con
    // una entrada sin normalizar dice que no, y eso es correcto.
    expect(valida('b12345674').valid).toBe(false)
    expect(valida(normalizeFiscalId('b-1234 5674'))).toEqual({ valid: true, type: 'CIF' })
  })
})

describe('ES_NIF — presentacion', () => {
  it('trae su propio hint, junto al algoritmo', () => {
    // Es lo que hace que GET /countries lo sirva ya resuelto y que el frontend nunca
    // compare un codigo de pais.
    expect(validador.hint).toBe('DNI, NIE o CIF — se comprueba automáticamente')
    expect(validador.validates).toBe(true)
  })
})

describe('normalizeFiscalId', () => {
  it.each([
    ['b-1234 5674', 'B12345674', 'el ejemplo de la spec 7.4'],
    [' 12345678z ', '12345678Z', 'espacios alrededor'],
    ['B.12.345.674', 'B12345674', 'puntos'],
    ['b_1234/5674', 'B12345674', 'cualquier separador'],
    ['B12345674', 'B12345674', 'ya normalizado: no cambia'],
  ])('%s -> %s (%s)', (entrada, esperado) => {
    expect(normalizeFiscalId(entrada)).toBe(esperado)
  })

  it('es idempotente', () => {
    const una = normalizeFiscalId('b-1234 5674')
    expect(normalizeFiscalId(una)).toBe(una)
  })

  it('NO adivina: no corrige O por 0 ni rellena ceros', () => {
    // Adivinar mal en un identificador fiscal es peor que rechazar.
    expect(normalizeFiscalId('BO2345674')).toBe('BO2345674')
    expect(normalizeFiscalId('1234567Z')).toBe('1234567Z')
  })

  it('normalizar y validar es el camino del alta', () => {
    // "b-1234 5674" tecleado por un humano valida igual que "B12345674".
    expect(valida(normalizeFiscalId('b-1234 5674'))).toEqual(valida('B12345674'))
  })
})
