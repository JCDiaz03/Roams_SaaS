# Spec — Autenticación mock

> **Capa SPEC de feature.** El porqué y los riesgos aceptados → `../idea-referencia.md` §8 completo. La pantalla → `../diseno-frontend.md` ventana 1 y topbar.
>
> **Superseded parcialmente por [`07-autenticacion.md`](./07-autenticacion.md)** (Fase 3): la costura del backend (§3.3) se rellenó —sesión de servidor, rol aplicado con 401/403— y la derivación del rol se mudó al `IdentityProvider` del backend. Siguen vigentes el comportamiento del login (§2, ahora como credenciales de demostración sobre sesión real) y el estado de sesión del cliente (§4, divisa y tema). **También quedó superada la regla 4 del §3.1** («ninguna tabla tiene `created_by`»): la sesión 20 añadió `simulations.created_by` como emisor del presupuesto impreso — sigue siendo texto no auditable hasta el IdP real, que es exactamente lo que la regla advertía. Se conserva porque documenta la apuesta que la 07 comprobó: sustituir el mock costó un módulo.

---

## 1. Alcance

Login mock, derivación de la sesión `{ nombre, rol }`, `hasRole()` y la costura de sustitución en el backend.

**Está declarado como mock** (→ referencia §8) y **fuera del modelo de amenazas de la v1** (→ referencia §14.3). Esta spec existe para que el mock sea sustituible en un día, no para que parezca seguro.

---

## 2. Comportamiento

- **Login**: usuario + contraseña. La contraseña es siempre `1111`; cualquier otra → error bajo el campo.
- **Cualquier nombre de usuario** entra. El dashboard saluda "Hola, {nombre}".
- **Usuario `ADMIN`** (comparación insensible a mayúsculas) → rol `admin`: aparecen los paneles de administración.
- **Cerrar sesión** → limpia la sesión y vuelve al login.

---

## 3. Por qué el mock no genera deuda

**Contexto**: no se conocen ni los datos ni el sistema de identidad interno de la empresa (→ referencia §8.2). Inventar hoy un modelo de usuarios —tablas de roles, `sales_rep_id`, hash de contraseñas— costaría más que añadirlo cuando se conozca, y casi con certeza sería el modelo equivocado.

**La deuda no depende de que el auth sea falso, sino de dónde vive la comprobación de rol:**

- ❌ `if (usuario === "ADMIN")` esparcido por veinte componentes → eso **sí** es deuda: sustituir el mock significa encontrar y tocar veinte sitios, y el que se olvide no falla, simplemente deja de proteger.
- ✅ El login deriva **una vez** una sesión `{ nombre, rol }`; los componentes preguntan `hasRole('admin')` → sustituir el mock = sustituir **un módulo**. Deuda ≈ 0.

### 3.1 Las cuatro reglas concretas

1. **El rol se calcula una sola vez, en el login.** El string `"ADMIN"` **no se vuelve a comparar en ningún otro sitio** — está en la lista de rechazo de las directrices (§5). Hay exactamente un punto del código donde ese literal aparece, y es la función que deriva la sesión.
2. **El nombre vive en el estado de sesión** y muere al cerrar sesión.
3. **La costura en backend (middleware de auth) existe desde el día 1**, aunque hoy no valide nada. Es el punto donde se enchufará la validación real de tokens.
4. **No se crean tablas de roles ni columnas de usuario interno.** Ninguna tabla del modelo de datos tiene `created_by` (→ `../modelo-datos.md`): sería una columna que hoy solo puede contener texto libre no auditable (→ §5, riesgo 3), y una migración cuando exista la identidad real.

### 3.2 Forma

```ts
type Session = {
  nombre: string;
  rol: 'admin' | 'sales';
  currency: string;                  // divisa de visualización (§4)
  currencySource: 'auto' | 'manual';
};

// El ÚNICO sitio del sistema donde se compara "ADMIN".
function derivarSesion(usuario: string): Session { … }

function hasRole(rol: Session['rol']): boolean;
```

**`rol` es un enum cerrado (`'admin' | 'sales'`), no el nombre de usuario.** Es lo que hace que la derivación sea un punto único: el tipo no admite que un componente "compruebe el rol" con otra cosa.

### 3.3 La costura del backend

```ts
// Costura de auth. Hoy no valida nada: el mock está declarado (→ referencia §8.3).
// Aquí se enchufará la validación real de tokens cuando se conozca el sistema
// de identidad de la empresa. No se inventa hoy la forma del token.
app.addHook('onRequest', async (req) => { /* no-op */ });
```

**Un hook que no hace nada parece código muerto, y es lo contrario.** Es la diferencia entre "hay que añadir auth" (buscar dónde, tocar cada ruta, arriesgarse a olvidar una) y "hay que rellenar esta función". El comentario es obligatorio: sin él, el primer refactor lo borra por inútil.

---

## 4. Estado de sesión: la divisa de visualización

Vive en la sesión porque es una preferencia del comercial durante su rato de trabajo, no un dato del negocio (→ referencia §4.1: **no se persiste jamás**).

**Regla — la elección manual manda** (→ referencia §13):

```
arranque:                         { currency: 'EUR', source: 'auto' }
al abrir la ficha de un cliente:  si source === 'auto' -> currency = display_currency del país
                                  si source === 'manual' -> no se toca
el comercial elige a mano:        { currency: elegida, source: 'manual' }   [para toda la sesión]
```

Una vez `manual`, **nada la vuelve a cambiar en toda la sesión**, ni al navegar entre clientes. El motivo es de producto: un selector que se mueve solo después de que el usuario lo haya tocado es un selector roto, y el comercial que estaba comparando en USD pierde el hilo al abrir la ficha siguiente.

---

## 5. Riesgos aceptados y declarados

Están en referencia §8.3; se repiten aquí porque **es la spec que los implementa**:

1. **Un rol comprobado solo en frontend no es seguridad.** Cualquiera puede llamar a los endpoints de admin directamente (→ `../contrato-api.md` §1.6). Aceptable en herramienta interna con mock declarado; **lo que no vale es creerse protegido**. Por eso `GET /plans?include_archived=true` es un parámetro y no un endpoint `/admin/*`: un endpoint aparte sin auth solo daría la ilusión de protección (→ referencia §12).
2. **La contraseña hardcodeada es visible en el código del cliente.** Aceptable como mock etiquetado. No se ofusca: ofuscarla sería fingir.
3. **El nombre en presupuestos no es auditable**: es texto libre. Con auth real, "quién emitió esto" es una identidad, no un campo tecleado. Es la razón de la regla 4 del §3.1.

**El README declara el mock como fuera del modelo de amenazas** (→ referencia §8.3, §14).

---

## 6. Tests

El grueso de esta feature es una decisión de diseño, no un algoritmo; los tests que valen son los que protegen **la costura**, no el mock:

- `derivarSesion('ADMIN')` → `rol: 'admin'`; `derivarSesion('admin')` → `rol: 'admin'` (insensible a mayúsculas); `derivarSesion('marta')` → `rol: 'sales'`.
- Contraseña ≠ `1111` → error; cualquier usuario con `1111` → entra.
- Cerrar sesión limpia nombre, rol y divisa.
- **Divisa**: `source: 'auto'` + abrir cliente `GB` → `GBP`. Elegir `USD` a mano → `source: 'manual'`; abrir cliente `GB` → **sigue en `USD`**. Es la regla que un refactor bienintencionado rompe.
- **Test de guardia del literal**: `"ADMIN"` aparece **una sola vez** en `frontend/src/` (búsqueda estática sobre el árbol de fuentes). Es raro y es el que de verdad protege el diseño: los otros comprueban que el mock funciona; este comprueba que **sigue siendo sustituible en un módulo**, que es la única razón por la que el mock es aceptable. Un segundo test prohíbe además comparar `rol === 'admin'` fuera de la sesión: es la misma deuda con otro nombre.

  **Gotcha al implementarlo**: el test tiene que **quitar los comentarios antes de buscar**. Si no, se caza a sí mismo — los comentarios que explican la regla contienen el literal, y un test que prohíbe documentar la regla que protege es un test que alguien acaba borrando.
