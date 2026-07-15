// Silueta del contenido al cargar; nunca spinner a pantalla completa. Diseno: 3

import styles from './Skeleton.module.css'

type Props = {
  width?: string | number
  height?: string | number
  radius?: string
  className?: string | undefined
}

/**
 * Una barra con la silueta del contenido que va a aparecer.
 *
 * NUNCA un spinner a pantalla completa (diseno 3): el skeleton dice donde va a estar cada
 * cosa, asi que la pagina no salta cuando llegan los datos y quien mira ya sabe que
 * esperar.
 */
export function Skeleton({ width = '100%', height = 14, radius, className }: Props) {
  return (
    <div
      className={[styles.sk, className ?? ''].filter(Boolean).join(' ')}
      style={{ width, height, ...(radius !== undefined ? { borderRadius: radius } : {}) }}
      // El estado de carga se anuncia UNA vez, en el contenedor de la pantalla, no en
      // cada barra: un lector de pantalla no debe leer "cargando" seis veces seguidas.
      aria-hidden="true"
    />
  )
}

/** Varias barras apiladas: el caso comun (unas cuantas lineas de texto). */
export function SkeletonStack({ lines = 3, className }: { lines?: number; className?: string | undefined }) {
  return (
    <div className={[styles.stack, className ?? ''].filter(Boolean).join(' ')}>
      {Array.from({ length: lines }, (_, i) => (
        // La ultima linea mas corta: es como se ve un parrafo de verdad.
        <Skeleton key={i} width={i === lines - 1 ? '60%' : '100%'} />
      ))}
    </div>
  )
}
