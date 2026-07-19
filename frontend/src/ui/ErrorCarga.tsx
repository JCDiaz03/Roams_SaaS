// La card de "no hemos podido cargar" con Reintentar (referencia 13.1). Diseno: 4
//
// Extraida cuando seis pantallas la dibujaban a mano, cada una con su clase CSS. El
// error de red SIGUE sin confundirse con el estado vacio: esto es solo la mitad "error",
// cada pantalla conserva su vacio propio ("sin resultados", "no existe").

import type { ReactNode } from 'react'
import { Button } from './Button'
import { Card } from './Card'
import styles from './ErrorCarga.module.css'

type Props = {
  /** Que no se pudo cargar, en lenguaje de producto: "No hemos podido cargar la ficha." */
  mensaje: string
  onReintentar: () => void
  /** Acciones extra junto a Reintentar (p. ej. volver al buscador). */
  extra?: ReactNode
}

export function ErrorCarga({ mensaje, onReintentar, extra }: Props) {
  return (
    <Card>
      <div className={styles.cuerpo}>
        <p className={styles.mensaje}>{mensaje}</p>
        <div className={styles.acciones}>
          <Button variant="secondary" onClick={onReintentar}>
            Reintentar
          </Button>
          {extra}
        </div>
      </div>
    </Card>
  )
}
