// Boton pildora con icono. Diseno: 2.1

import type { ButtonHTMLAttributes, ReactNode, Ref } from 'react'
import styles from './Button.module.css'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'
type Size = 'sm' | 'md' | 'lg'

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant
  size?: Size
  block?: boolean
  /** Deshabilita el boton y muestra el spinner. Diseno: 13.1 (envio en curso). */
  loading?: boolean
  icon?: ReactNode
  children: ReactNode
  /** React 19: la ref viaja como prop normal hasta el <button> real (p. ej. para que un
   *  modal enfoque Cancelar al abrir). */
  ref?: Ref<HTMLButtonElement>
}

export function Button({
  variant = 'primary',
  size = 'md',
  block = false,
  loading = false,
  icon,
  children,
  className,
  disabled,
  type = 'button',
  ...rest
}: Props) {
  const clases = [
    styles.base,
    styles[variant],
    styles[size],
    block ? styles.block : '',
    loading ? styles.loading : '',
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <button
      // type="button" por defecto: el default de HTML es "submit", y un boton dentro de
      // un formulario que no queria enviarlo lo envia igual.
      type={type}
      className={clases}
      // `loading` implica deshabilitado: es la regla del 13.1 (boton deshabilitado
      // durante el envio) escrita una vez, y no en cada pantalla que guarde algo.
      disabled={disabled === true || loading}
      aria-busy={loading}
      {...rest}
    >
      {loading ? <span className={styles.spinner} aria-hidden="true" /> : icon}
      <span className={styles.label}>{children}</span>
    </button>
  )
}
