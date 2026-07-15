# Roams SaaS

Herramienta interna para el equipo comercial: registrar clientes corporativos, simular su consumo (usuarios, almacenamiento, llamadas API) y obtener presupuestos mensuales de suscripción, visualizables en varias divisas.

> **Estado: andamiaje.** El árbol y la configuración existen; la implementación arranca por los algoritmos (Fase 1 del roadmap). Este README se completa como entregable propio antes de la entrega — ver `ai-workspace/roams-roadmap.md` §3.4.

## Arranque en local `(pendiente de verificar)`

```bash
git clone <repo> && cd roams-saas
npm install
npm run dev
```

El backend crea y puebla la base de datos SQLite en el primer arranque si el fichero `.db` no existe: cero pasos manuales. Node ≥ 22 (ver `.nvmrc`).

| Script (raíz) | Qué hace |
|---|---|
| `npm run dev` | Levanta backend y frontend a la vez |
| `npm test` | Tests de todos los workspaces |
| `npm run seed` | Repuebla la base de datos |

## Estructura

```
backend/           API REST (Fastify + better-sqlite3)
frontend/          Dashboard comercial (React + Vite)
packages/pricing/  Motor de tramos compartido por ambos
ai-workspace/      El proceso: specs, arquitectura y desarrollo con IA
```

## Documentación

**El grueso del trabajo está en [`/ai-workspace`](./ai-workspace/README.md)**: las especificaciones previas al código, las directrices dadas a la IA y el registro del desarrollo iterativo.

- Qué se construye y por qué → [`ai-workspace/01-specs/idea-referencia.md`](./ai-workspace/01-specs/idea-referencia.md)
- Estado y fases → [`ai-workspace/roams-roadmap.md`](./ai-workspace/roams-roadmap.md)

## Decisiones que conviene conocer antes de leer el código

`(a desarrollar en el README v1; cada una tiene su entrada en ai-workspace/02-arquitectura/decisiones.md)`

- Los tipos de cambio se consumen **a través del backend**, no directamente desde el navegador — con su porqué y por qué sigue cumpliendo el enunciado.
- La autenticación es un **mock declarado**, fuera del modelo de amenazas.
- El preview del simulador es **híbrido**: se calcula en local con el mismo módulo que usa el servidor, pero el número que manda es el del servidor.
