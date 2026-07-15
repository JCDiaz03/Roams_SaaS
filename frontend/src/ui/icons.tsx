// Iconos de linea, extraidos del prototipo de Claude Design. Diseno: 2.1 (Untitled UI)
//
// Todos usan `currentColor` y heredan el tamano por `size`: el color lo pone quien los
// pinta, con un token. Un icono con color propio seria una excepcion al tema oscuro.
//
// Van aqui y no en cada componente porque el prototipo los repite en linea (es un
// mockup) y varios se usan en tres sitios. `aria-hidden` por defecto: son decorativos,
// el texto de al lado es el que comunica. Si alguno queda solo, quien lo use pasa
// `aria-label` y `role="img"`.

type Props = {
  size?: number
  className?: string
}

const base = (size: number) => ({
  width: size,
  height: size,
  viewBox: '0 0 24 24',
  fill: 'none' as const,
  'aria-hidden': true,
})

export function IconLogo({ size = 18, className }: Props) {
  return (
    <svg {...base(size)} className={className}>
      <path
        d="M4 15c3-6 5-6 8 0s5 6 8 0"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
      />
    </svg>
  )
}

export function IconSearch({ size = 16, className }: Props) {
  return (
    <svg {...base(size)} className={className}>
      <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
      <path d="m20 20-3.5-3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

export function IconSun({ size = 18, className }: Props) {
  return (
    <svg {...base(size)} className={className}>
      <circle cx="12" cy="12" r="4.2" stroke="currentColor" strokeWidth="1.9" />
      <path
        d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M18.4 5.6 17 7M7 17l-1.4 1.4"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
      />
    </svg>
  )
}

export function IconMoon({ size = 17, className }: Props) {
  return (
    <svg {...base(size)} className={className}>
      <path
        d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5Z"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function IconInfo({ size = 15, className }: Props) {
  return (
    <svg {...base(size)} className={className}>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.6" />
      <path d="M12 11v5M12 8h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

export function IconWarning({ size = 15, className }: Props) {
  return (
    <svg {...base(size)} className={className}>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8" />
      <path d="M12 8v5M12 16h.01" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  )
}

export function IconCheck({ size = 14, className }: Props) {
  return (
    <svg {...base(size)} className={className}>
      <path
        d="m5 12.5 4.5 4.5L19 7"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function IconSettings({ size = 15, className }: Props) {
  return (
    <svg {...base(size)} className={className}>
      <path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M19 12a7 7 0 0 0-.1-1l2-1.5-2-3.4-2.3 1a7 7 0 0 0-1.7-1L14.5 2h-5l-.4 2.6a7 7 0 0 0-1.7 1l-2.3-1-2 3.4L3 11a7 7 0 0 0 0 2l-2 1.5 2 3.4 2.3-1a7 7 0 0 0 1.7 1l.4 2.6h5l.4-2.6a7 7 0 0 0 1.7-1l2.3 1 2-3.4-2-1.5c.1-.3.1-.7.1-1Z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function IconLogout({ size = 15, className }: Props) {
  return (
    <svg {...base(size)} className={className}>
      <path
        d="M9 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h3M16 16l4-4-4-4M20 12H9"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function IconPlus({ size = 15, className }: Props) {
  return (
    <svg {...base(size)} className={className}>
      <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  )
}
