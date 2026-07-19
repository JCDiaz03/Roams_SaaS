// El termino de busqueda que vive en la URL (?q=), con debounce. Diseno: 4, 6
//
// Extraido del dashboard cuando el listado de planes se convirtio en el segundo
// buscador: la parte dificil (el borrador, el debounce y distinguir "la URL cambio
// porque yo la escribi" de "cambio desde fuera") no debe existir dos veces.

import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'

/** Ni una actualizacion por tecla. 250 ms: por debajo no da tiempo a teclear, por encima se nota. */
const DEBOUNCE_MS = 250

/**
 * El termino en la URL (`?q=`) + el borrador del input con debounce.
 *
 * El termino vive en la URL a proposito: el buscador sobrevive a un F5 y se puede
 * compartir. `borrador` es lo que el input pinta tecla a tecla; `termino` es lo que ya
 * bajo a la URL (y con lo que hay que filtrar o pedir).
 */
export function useBusquedaEnUrl(): {
  termino: string
  borrador: string
  setBorrador: (valor: string) => void
} {
  const [params, setParams] = useSearchParams()
  const termino = params.get('q') ?? ''
  const [borrador, setBorrador] = useState(termino)

  // Lo ultimo que ESTE debounce escribio en la URL: distingue "la URL cambio porque yo
  // la escribi" de "la URL cambio desde fuera" (el buscador de la topbar navega a /?q=).
  const ultimoEscrito = useRef(termino)

  // Un cambio EXTERNO del termino baja al borrador, o el input no lo mostraria y el
  // debounce de abajo lo revertiria a los 250 ms con el valor viejo del input — que es
  // exactamente lo que pasaba al buscar desde la topbar estando en el dashboard
  // (setSearchParams cambia de identidad con cada URL y relanzaba el efecto).
  useEffect(() => {
    if (termino !== ultimoEscrito.current) {
      ultimoEscrito.current = termino
      setBorrador(termino)
    }
  }, [termino])

  // Debounce: el borrador baja a la URL cuando el usuario deja de teclear. El guard de
  // igualdad es lo que hace inofensivo que el efecto se relance por identidad.
  useEffect(() => {
    if (borrador === termino) return

    const t = setTimeout(() => {
      ultimoEscrito.current = borrador
      setParams(borrador === '' ? {} : { q: borrador }, { replace: true })
    }, DEBOUNCE_MS)
    return () => clearTimeout(t)
  }, [borrador, termino, setParams])

  return { termino, borrador, setBorrador }
}

/**
 * ¿`texto` contiene `termino`, ignorando mayusculas y acentos? Para filtros EN LOCAL
 * (el catalogo de planes): "agora" encuentra "Plan Ágora". El buscador de clientes no
 * pasa por aqui — filtra el backend, con su propia colacion.
 */
export function contiene(texto: string, termino: string): boolean {
  return normaliza(texto).includes(normaliza(termino))
}

// NFD separa la letra de su acento; U+0300-U+036F son los diacriticos sueltos.
const normaliza = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
