# SaaS-O-Matic

Herramienta interna para el equipo comercial: registrar clientes corporativos, simular su consumo (usuarios, almacenamiento, llamadas API) y obtener presupuestos mensuales de suscripción, visualizables en varias divisas.

> **Estado.** El core del reto está terminado y verificado de punta a punta: motor de tarificación, validación fiscal, API completa y las 5 pantallas. La **administración de planes** (crear, versionar, archivar) está diseñada y documentada, y es lo único pendiente — ver [`roams-roadmap.md`](./ai-workspace/roams-roadmap.md) §4.

## Arranque en local

```bash
git clone https://github.com/JCDiaz03/Roams_SaaS.git
cd Roams_SaaS
npm install
npm run dev
```

Y ya está: **http://localhost:5173**. Entra con cualquier usuario y la contraseña `1111`, o con el usuario `ADMIN` para ver la entrada de administración.

No hay ningún paso manual de base de datos: el backend crea el esquema SQLite y lo puebla en el primer arranque si el fichero `.db` no existe. Requiere **Node ≥ 22** (ver `.nvmrc`); no hace falta Docker ni herramientas de compilación.

| Script (raíz) | Qué hace |
|---|---|
| `npm run dev` | Levanta backend (`:3000`) y frontend (`:5173`) a la vez |
| `npm test` | Los 255 tests de los tres workspaces |
| `npm run seed` | Repuebla la base de datos (solo sobre una base vacía) |
| `npm run lint` · `npm run typecheck` | Lo mismo que ejecuta el CI |

### Qué probar en dos minutos

1. **El caso del enunciado**: entra, busca `Nébula`, abre su ficha y pulsa *Nueva simulación*. Con **15 usuarios** verás **140 € + 21 % = 169,40 €**, con su desglose `10 × 10 € + 5 × 8 €`.
2. **Precio inmutable**: abre `Fjord Systems AS`. Está en una versión **archivada** del Plan Ágora y su ficha lo dice sin jerga («Mantiene su tarifa contratada»). Simula 15 usuarios: cotiza a **su** tarifa (`10 × 12 € + 5 × 7 €`), no a la de hoy.
3. **Divisa**: cambia el selector de la topbar a USD. El total se convierte, pero va **marcado como referencia** y con el importe de facturación real al lado. El número del negocio no cambia.
4. **Validación fiscal**: en *Nuevo cliente*, prueba `B12345675` (control incorrecto) y luego `B12345674`. El error sale junto al campo.

## Estructura

```
backend/           API REST (Fastify + better-sqlite3)
frontend/          Dashboard comercial (React + Vite)
packages/pricing/  Motor de tramos, redondeo y Currency — compartido por ambos
ai-workspace/      El proceso: specs, arquitectura y desarrollo con IA
```

## El grueso del trabajo está en `/ai-workspace`

**[`/ai-workspace`](./ai-workspace/README.md)** contiene lo que se decidió antes de escribir código, las directrices bajo las que se generó, y las decisiones con sus alternativas descartadas.

- Qué se construye y por qué → [`01-specs/idea-referencia.md`](./ai-workspace/01-specs/idea-referencia.md) — el documento madre
- Estado y fases → [`roams-roadmap.md`](./ai-workspace/roams-roadmap.md)
- Las reglas dadas a la IA → [`02-arquitectura/directrices-ia.md`](./ai-workspace/02-arquitectura/directrices-ia.md)
- Las decisiones y lo descartado → [`02-arquitectura/decisiones.md`](./ai-workspace/02-arquitectura/decisiones.md)
- Lo diseñado y deliberadamente no hecho → [`03-proceso/recortes-conscientes.md`](./ai-workspace/03-proceso/recortes-conscientes.md)

## Decisiones que conviene conocer antes de leer el código

**Los tipos de cambio se consumen a través del backend**, no directamente desde el navegador. El enunciado dice que «la interfaz debe conectar con una API pública», y se cumple: la interfaz consume tipos de una API pública y el backend es una capa intermedia estándar (*cache-aside*). **La desviación de la letra es deliberada y el motivo es de negocio, no técnico**: con caché en el navegador, dos comerciales pueden cotizar al mismo cliente con tipos distintos el mismo día — uno abrió la pestaña ayer, el otro hoy. La caché de servidor garantiza que todo el equipo ve el mismo número a la misma hora. → [ADR 0004](./ai-workspace/02-arquitectura/decisiones.md).

**La autenticación es un mock declarado y está fuera del modelo de amenazas.** La contraseña es `1111` y los endpoints de administración **no están protegidos**: cualquiera puede llamarlos. Es aceptable en una herramienta interna con el mock declarado; lo que no vale es *creerse* protegido. No se inventa hoy un modelo de usuarios porque no se conoce el sistema de identidad de la empresa. Lo que sí existe desde el día 1 es la **costura**: el rol se deriva una sola vez y hay un test que comprueba que el literal `"ADMIN"` aparece en un único fichero, que es lo que hace el mock sustituible en un módulo. → [ADR 0007](./ai-workspace/02-arquitectura/decisiones.md).

**El preview del simulador es híbrido.** Se calcula en local, a 0 ms y sin red, con **la misma función pura** que ejecuta el servidor (`@saas/pricing`, importado por los dos): no existen dos implementaciones que puedan divergir. Al guardar, el backend recalcula desde cero y **su número manda**. → [ADR 0003](./ai-workspace/02-arquitectura/decisiones.md).

**El dinero son enteros en unidades menores, nunca `float`**, siempre con su código ISO al lado, y se redondea una sola vez con half-up. `Math.round` **no** es half-up, así que el redondeo vive en una única función testeada. → [ADR 0005](./ai-workspace/02-arquitectura/decisiones.md).

**Un precio publicado es inmutable**: editar un plan crea una versión nueva y archiva la anterior; borrar archiva. Además, cada simulación guarda una foto de los tramos y el impuesto aplicados, así que un presupuesto ya enviado sigue explicando su número aunque el plan cambie. → [ADR 0006](./ai-workspace/02-arquitectura/decisiones.md).

**Sin Docker**, y es una decisión: SQLite es un fichero, no un servicio. Exigir Docker para evaluar una app de Node puro añadiría fricción en vez de quitarla. → [ADR 0008](./ai-workspace/02-arquitectura/decisiones.md).
