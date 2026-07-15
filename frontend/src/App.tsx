// Layout + topbar + rutas. Diseno: 01-specs/diseño-frontend.md 3
//
// Estado: (galeria). Las 5 pantallas y el enrutado entran en Fase 1.3.3, cuando exista
// la API (roadmap 3.2): consumen endpoints que hoy no responden.
//
// Mientras tanto, esto pinta el sistema de tokens y las primitivas en los dos temas. No
// es andamiaje tirado: es lo que permite VER que el contraste y los tokens funcionan en
// claro y en oscuro sin esperar al backend, que es justo lo que el brief pide entregar
// aparte (diseño-frontend.md 6.3).

import { useState } from 'react'
import { applyTheme, preferredTheme, toggleTheme, type Theme } from './lib/theme'
import { formatMinor } from './lib/currency-format'
import { Button } from './ui/Button'
import { Callout } from './ui/Callout'
import { Card } from './ui/Card'
import { Chip } from './ui/Chip'
import { Skeleton, SkeletonStack } from './ui/Skeleton'
import { ThemeToggle } from './ui/ThemeToggle'
import { ToastProvider, useToast } from './ui/Toast'
import { IconCheck, IconLogo, IconPlus } from './ui/icons'

function Seccion({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section style={{ marginBottom: 28 }}>
      <h2 style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text-2)', margin: '0 0 12px' }}>
        {titulo}
      </h2>
      <Card>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
          {children}
        </div>
      </Card>
    </section>
  )
}

function Galeria() {
  const toast = useToast()

  return (
    <>
      <Seccion titulo="Botones">
        <Button variant="primary">Guardar simulación</Button>
        <Button variant="secondary" icon={<IconPlus />}>
          Nuevo cliente
        </Button>
        <Button variant="ghost">Cancelar</Button>
        <Button variant="danger">Archivar</Button>
        <Button loading>Guardando</Button>
        <Button disabled>Deshabilitado</Button>
        <Button size="sm">Pequeño</Button>
        <Button size="lg">Grande</Button>
      </Seccion>

      <Seccion titulo="Chips y badges">
        <Chip>España</Chip>
        <Chip tone="brand">Plan Ágora · v2</Chip>
        <Chip tone="success" icon={<IconCheck />}>
          CIF validado
        </Chip>
        <Chip tone="neutral">Sin validar</Chip>
        <Chip tone="warning">Tipos del 12 jul</Chip>
        <Chip tone="danger">Archivado</Chip>
      </Seccion>

      <Seccion titulo="Callouts">
        <div style={{ display: 'grid', gap: 10, width: '100%' }}>
          <Callout tone="info">
            Este plan no cobra por esta métrica: puedes registrarla, pero no cambia el precio.
          </Callout>
          <Callout tone="warning" title="Tipos de cambio desactualizados">
            No hemos podido actualizar los tipos. Se muestran los del 12 de julio.
          </Callout>
          <Callout tone="danger">La letra de control no corresponde. Revisa el identificador.</Callout>
          <Callout tone="success">Los clientes actuales mantendrán su tarifa anterior.</Callout>
        </div>
      </Seccion>

      <Seccion titulo="Importes — el símbolo lo deriva Intl del código ISO">
        <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
          {(['EUR', 'USD', 'GBP', 'CHF'] as const).map((c) => (
            <div key={c}>
              <div style={{ fontSize: 26, fontWeight: 700 }}>{formatMinor(16_940, c)}</div>
              <div style={{ fontSize: 11.5, color: 'var(--color-text-2)' }}>{c} · 2 decimales</div>
            </div>
          ))}
          <div>
            <div style={{ fontSize: 26, fontWeight: 700 }}>{formatMinor(16_940, 'JPY')}</div>
            <div style={{ fontSize: 11.5, color: 'var(--color-text-2)' }}>JPY · sin decimales</div>
          </div>
          <div>
            <div style={{ fontSize: 26, fontWeight: 700 }}>{formatMinor(16_940, 'KWD')}</div>
            <div style={{ fontSize: 11.5, color: 'var(--color-text-2)' }}>KWD · 3 decimales</div>
          </div>
        </div>
      </Seccion>

      <Seccion titulo="Skeletons">
        <div style={{ display: 'grid', gap: 14, width: '100%' }}>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <Skeleton width={44} height={44} radius="50%" />
            <div style={{ flex: 1 }}>
              <SkeletonStack lines={2} />
            </div>
          </div>
          <Skeleton height={60} radius="var(--radius-panel)" />
        </div>
      </Seccion>

      <Seccion titulo="Toasts">
        <Button variant="secondary" onClick={() => toast.showOk('Simulación guardada')}>
          Toast de confirmación
        </Button>
        <Button variant="secondary" onClick={() => toast.showError('No se ha podido guardar')}>
          Toast de error
        </Button>
      </Seccion>
    </>
  )
}

export function App() {
  const [theme, setTheme] = useState<Theme>(() => {
    const inicial = preferredTheme()
    applyTheme(inicial)
    return inicial
  })

  const cambiarTema = () => {
    const siguiente = toggleTheme(theme)
    applyTheme(siguiente)
    setTheme(siguiente)
  }

  return (
    <ToastProvider>
      <div style={{ minHeight: '100vh', padding: '28px 24px 60px' }}>
        <header
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            maxWidth: 980,
            margin: '0 auto 26px',
          }}
        >
          <span
            style={{
              display: 'grid',
              placeItems: 'center',
              width: 32,
              height: 32,
              borderRadius: 'var(--radius-sm)',
              background: 'var(--color-primary)',
              color: '#fff',
            }}
          >
            <IconLogo />
          </span>
          <span style={{ fontWeight: 700, fontSize: 16, letterSpacing: '-.02em' }}>
            SaaS<span style={{ color: 'var(--color-primary)' }}>-O-</span>Matic
          </span>
          <span style={{ fontSize: 12.5, color: 'var(--color-text-2)' }}>· sistema de diseño</span>
          <div style={{ flex: 1 }} />
          <ThemeToggle theme={theme} onToggle={cambiarTema} />
        </header>

        <main style={{ maxWidth: 980, margin: '0 auto' }}>
          <Galeria />
        </main>
      </div>
    </ToastProvider>
  )
}
