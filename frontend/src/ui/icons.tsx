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

// El antiguo IconLogo (la onda) se retiro cuando la marca paso a assets/roams-logo.svg:
// el logo es un asset, no un icono de linea.

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
  // La rueda dentada canonica (Feather "settings"): el trazado anterior era una
  // aproximacion a mano y los dientes salian deformes a 15px.
  return (
    <svg {...base(size)} className={className}>
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.7" />
      <path
        d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function IconAdmin({ size = 15, className }: Props) {
  // Deslizadores (Feather "sliders"): la administracion ajusta tarifas, y el engranaje
  // queda para los Ajustes de todo el mundo — dos entradas de menu, dos iconos.
  return (
    <svg {...base(size)} className={className}>
      <path
        d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
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
