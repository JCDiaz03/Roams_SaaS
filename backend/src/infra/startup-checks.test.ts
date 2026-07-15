// El arranque falla RUIDOSAMENTE ante una deriva dato<->codigo. Spec: 15, 7.3, 6.1
//
// Estos son los tests que convierten los "inexpresables" del diseno en garantias en vez
// de en afirmaciones. Cada uno manipula la base de datos para provocar la deriva y
// comprueba que el proceso NO arranca.

import { describe, expect, it } from 'vitest'
import { openDb } from './db'
import { migrate } from './migrate'
import { seed } from './seed'
import { runStartupChecks } from './startup-checks'
import type { Db } from './db'

/** Una base sembrada y lista para que el test la estropee. */
function baseSembrada(): Db {
  const db = openDb(':memory:')
  migrate(db)
  seed(db)
  return db
}

describe('chequeo 1 — esquema fiscal no registrado', () => {
  it('el arranque FALLA en vez de degradar en silencio a pass-through', async () => {
    const db = baseSembrada()
    db.prepare("UPDATE countries SET tax_id_scheme = 'PT_NIF' WHERE code = 'PT'").run()

    // Es el fallo que este diseno mas teme: arrancar igual daria de alta a los clientes
    // portugueses SIN VALIDAR, marcados como 'unvalidated', y nadie se enteraria hasta
    // auditar los datos.
    expect(() => runStartupChecks(db)).toThrow(/PT_NIF/)
    expect(() => runStartupChecks(db)).toThrow(/registro de validadores/)

    db.close()
  })

  it('el error dice que hacer, no solo que ha fallado', () => {
    const db = baseSembrada()
    db.prepare("UPDATE countries SET tax_id_scheme = 'XX_FOO' WHERE code = 'PT'").run()

    expect(() => runStartupChecks(db)).toThrow(/Anade su TaxIdValidator o pon la columna a NULL/)

    db.close()
  })

  it('un pais con esquema NULL no falla: PassThrough es una estrategia, no un hueco', () => {
    const db = baseSembrada()
    // Nueve de los diez paises del seed ya estan asi.
    expect(() => runStartupChecks(db)).not.toThrow()
    db.close()
  })
})

describe('chequeo 2 — pais sin tipo vigente', () => {
  it('el arranque FALLA: "cliente sin impuesto calculable" tiene que ser inexpresable', () => {
    const db = baseSembrada()
    db.prepare("DELETE FROM tax_rates WHERE country = 'PT'").run()

    // Sin esto, la frase del diseno seria solo una frase: el alta lo aceptaria y el
    // calculo reventaria despues, con un error que no explica la causa.
    expect(() => runStartupChecks(db)).toThrow(/PT/)
    expect(() => runStartupChecks(db)).toThrow(/tipo impositivo vigente/)

    db.close()
  })

  it('una fila con fecha FUTURA no cuenta como vigente', () => {
    const db = baseSembrada()
    db.prepare("DELETE FROM tax_rates WHERE country = 'PT'").run()
    db.prepare("INSERT INTO tax_rates (country, vigente_desde, rate_bp) VALUES ('PT', '2099-01-01', 2500)").run()

    // Un tipo anunciado y no aplicable aun es legitimo, y NO debe aplicarse. Si el
    // <= date('now') desapareciera, este test se pondria verde y el pais cotizaria al
    // 25 % desde hoy.
    expect(() => runStartupChecks(db)).toThrow(/tipo impositivo vigente/)

    db.close()
  })

  it('con dos filas se aplica la de mayor vigente_desde <= hoy', () => {
    const db = baseSembrada()
    // España lleva dos a proposito en el seed: 18 % (2010) y 21 % (2012).
    const countries = runStartupChecks(db)

    expect(countries.get('ES')?.rateBp).toBe(2100)

    db.close()
  })

  it('y una futura no pisa a la vigente', () => {
    const db = baseSembrada()
    db.prepare("INSERT INTO tax_rates (country, vigente_desde, rate_bp) VALUES ('ES', '2099-01-01', 2500)").run()

    expect(runStartupChecks(db).get('ES')?.rateBp).toBe(2100)

    db.close()
  })
})

describe('chequeo 3 — divisas fuera del enum Currency', () => {
  it('un display_currency desconocido tumba el arranque', () => {
    const db = baseSembrada()
    db.prepare("UPDATE countries SET display_currency = 'XXX' WHERE code = 'PT'").run()

    expect(() => runStartupChecks(db)).toThrow(/enum Currency/)

    db.close()
  })

  it('una divisa de facturacion desconocida tumba el arranque', () => {
    const db = baseSembrada()
    db.prepare("UPDATE plans SET currency = 'XXX' WHERE version = 1").run()

    // Sin minor_unit no hay como formatear sus importes ni saber cuantos decimales tiene.
    expect(() => runStartupChecks(db)).toThrow(/enum Currency/)

    db.close()
  })
})

describe('la cache es el resultado del chequeo', () => {
  it('si se construye entera, el sistema esta integro', () => {
    const db = baseSembrada()
    const countries = runStartupChecks(db)

    expect(countries.size).toBe(10)
    expect(countries.get('ES')).toEqual({
      code: 'ES',
      name: 'España',
      scheme: 'ES_NIF',
      displayCurrency: 'EUR',
      rateBp: 2100,
    })
    // Suiza: el unico tipo con decimal del seed. Un seed donde todos son multiplos de 100
    // no distingue un rate_bp correcto de un rate_pct con suerte.
    expect(countries.get('CH')?.rateBp).toBe(810)

    db.close()
  })

  it('una base vacia falla con un mensaje que explica la causa', () => {
    const db = openDb(':memory:')
    migrate(db)

    expect(() => runStartupChecks(db)).toThrow(/No hay ningun pais/)

    db.close()
  })
})
