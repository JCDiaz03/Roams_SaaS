# Spec — Ajustes: perfil de demostración y límites del simulador

> **Capa SPEC de feature.** El porqué de negocio → `../../roams-roadmap_v2.md` §7. La pantalla → `../diseño-frontend.md` §8 (ventana 9). Sin contrato HTTP: esta feature no toca la API.

---

## 1. Alcance

Una pantalla de **Ajustes** (`/ajustes`) para **cualquier usuario**, con entrada propia en el menú de la topbar (el engranaje; «Administración» pasa a los deslizadores). Dos bloques:

1. **Perfil, de demostración**: nombre y rol reales (de la sesión) más datos fijos (idioma, zona horaria, notificaciones), **sin edición**. No se inventa la edición de un modelo de usuarios que no existe hasta el IdP real (→ ADR 0009); un callout lo declara en pantalla.
2. **Límites del simulador, funcionales**: el máximo visual de cada deslizador (usuarios, GB, llamadas API), por sesión de trabajo.

## 2. Los límites: presentación, no negocio

El problema que resuelven: una empresa que trabaja con planes de 2–20 GB tiene que apuntar con el ratón sobre una ranura que llega a 3.000 — el «lerp» del slider hace inútil el arrastre. Bajar el máximo a 100 convierte la misma ranura en un control fino.

- **Solo acotan el arrastre.** El input numérico sigue aceptando valores exactos y el tope real de lo simulable sigue siendo el del esquema del backend (`TOPES`, anti-DoS). Un límite visual jamás sustituye a una validación de servidor.
- **Acotados por ambos lados** al guardar (`clampLimite`): ni negativos ni un máximo absurdo.

| Métrica | Mínimo | Máximo | Por defecto |
|---|---|---|---|
| `users` | 70 | 1.000.000 | 200 |
| `storage_gb` | 100 | 10.000.000 | 3.000 |
| `api_calls` | 1.000 | 1.000.000.000 | 200.000 |

**Dónde viven estos valores, para cambiarlos a mano**: `frontend/src/lib/simulator-limits.tsx` — `LIMITE_MINIMO`, `LIMITE_MAXIMO` y `LIMITE_POR_DEFECTO`, con el porqué de cada uno comentado. El máximo duplica a propósito los `TOPES` del backend (`backend/src/features/simulations/simulations.schemas.ts`): subir uno sin el otro solo produciría 400 al guardar, y el comentario lo avisa.

- **Estado de la sesión de trabajo**, como la divisa y el tema: ni backend ni `localStorage` (misma nota que `lib/theme.ts` — el día que haya usuarios reales, la preferencia será del usuario).
- El simulador usa el límite vigente como `max` de cada slider, **ampliable** por un valor inicial mayor (la regla de la spec 09 §3.4 no cambia: un valor base de 500 sigue ampliando el slider aunque el límite sea 200).

## 3. Tests

- La suite de tokens y axe cubren la pantalla como al resto (contraste, roles).
- El clamp es una función pura exportada (`clampLimite`); si crece la lógica, gana tests unitarios propios. Hoy la protección real está en que el backend valida sus topes de todas formas.
