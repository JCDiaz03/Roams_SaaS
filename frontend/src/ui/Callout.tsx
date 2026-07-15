// Caja de consejo con fondo suave e icono. Diseno: 2.4.4

import type { ReactNode } from 'react'
import styles from './Callout.module.css'
import { IconInfo, IconWarning } from './icons'

type Tone = 'info' | 'warning' | 'danger' | 'success'

type Props = {
  children: ReactNode
  tone?: Tone
  title?: string
  className?: string | undefined
}

const ICONO: Record<Tone, ReactNode> = {
  info: <IconInfo />,
  warning: <IconWarning />,
  danger: <IconWarning />,
  success: <IconInfo />,
}

/**
 * La caja de nota contextual del patron Roams ("Nuestra opinion experta").
 *
 * Es donde viven los avisos que el diseno exige y que un comercial tiene que entender sin
 * jerga: "este plan no cobra por esta metrica", "importe convertido: solo referencia",
 * "los clientes actuales mantendran su tarifa".
 */
export function Callout({ children, tone = 'info', title, className }: Props) {
  const clases = [styles.callout, styles[tone], className ?? ''].filter(Boolean).join(' ')

  return (
    <div className={clases}>
      <span className={styles.icon} aria-hidden="true">
        {ICONO[tone]}
      </span>
      <div className={styles.body}>
        {title !== undefined && <div className={styles.title}>{title}</div>}
        {children}
      </div>
    </div>
  )
}
