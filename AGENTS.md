# AGENTS.md — frontend

Panel web de la agenda inmobiliaria. Next.js 16 (App Router) · React 19 · TypeScript · Tailwind v4 · TanStack Query.

Este archivo es para agentes de IA y para quien llegue nuevo. No repite el `README.md`: recoge lo que **no se deduce leyendo el código** y lo que se rompe en silencio si no se sabe.

---

## Arranque

Node ≥ 20 (probado con 24), pnpm ≥ 9 (probado con 11).

```bash
pnpm install
cp .env.example .env.local
pnpm dev
```

Dos variables, las dos obligatorias y **solo del servidor**:

| Variable | Qué es |
|---|---|
| `API_BASE_URL` | URL base del backend **con el prefijo de versión**: `http://localhost:8000/api/v1` |
| `AUTH_SECRET` | Secreto de 32+ caracteres para cifrar la cookie. `openssl rand -base64 32` |

Se leen de forma perezosa, así que faltar una falla con un mensaje claro en la primera petición, no al importar. **Nunca uses el prefijo `NEXT_PUBLIC_` para secretos**: acabarían en el bundle.

Cambiar `AUTH_SECRET` invalida todas las sesiones abiertas.

---

## Comandos

```bash
pnpm dev        # desarrollo en http://localhost:3000
pnpm build      # build de producción
pnpm lint       # ESLint
pnpm typecheck  # tsc --noEmit
pnpm test       # vitest, una pasada
pnpm test:watch
```

Antes de subir:

```bash
pnpm lint && pnpm typecheck && pnpm test
```

**Aviso:** `.github/workflows/ci.yml` todavía **no está en `staging`** — llega con el PR abierto de CI. Hasta entonces nada te avisa automáticamente: corre los tres a mano.

Dos rojos que ya están ahí antes de que toques nada, y que el PR de CI arregla. **No son tuyos:**

- `pnpm lint` marca un error en `tests/button.test.tsx` (`no-html-link-for-pages` aplicado a un test).
- `pnpm test` falla de forma intermitente en `tests/login-form.test.tsx` (ver la sección de Tests).

---

## Capas

```
app/          Rutas, layouts, Route Handlers (BFF y proxy)
components/   Presentación. Sin fetch, sin URLs de backend
features/     api/ · hooks/ · schemas/ · utils/ por dominio
lib/          Cliente HTTP, sesión, fechas, permisos, errores
config/       Entorno, rutas, claves de caché
```

**Regla de dependencias: `components → features → lib → config`. Nunca al revés.**

**Los componentes viven en `components/<dominio>/`, NO dentro de `features/`.** Es el error que comete por defecto quien viene de otros proyectos: `features/<dominio>/` contiene solo `api/`, `hooks/`, `schemas/`, `utils/`, `types.ts` — ni un `.tsx` de presentación.

Alias de import: `@/*`.

---

## El BFF y el proxy

El navegador **nunca habla con Django**. Va así:

```
navegador → lib/api/client.ts → /api/proxy/<recurso>
          → app/api/proxy/[...path]/route.ts   (descifra la cookie, añade Basic Auth)
          → lib/api/server-client.ts → API Django
```

**Por qué existe el BFF:** el backend solo publica Basic Auth. Sin BFF habría que guardar la credencial en el navegador. Con él, el bundle no contiene ni la URL del backend ni credenciales, y la cookie es `httpOnly`.

Hay dos handlers: `/api/proxy` para los recursos generales (los cinco verbos) y `/api/dashboard` para métricas (**solo GET**).

### El fallo silencioso número uno

Los dos handlers tienen una **allowlist de recursos**. Si creas `features/x/api/x.api.ts` que llama a `apiClient.get("recurso-nuevo")` y **no añades `"recurso-nuevo"` a `ALLOWED_RESOURCES`** en `app/api/proxy/[...path]/route.ts`, recibes:

```json
{"detail": "Recurso no disponible."}
```

con un **404 que parece del backend y lo genera Next**. Es el primer sitio donde mirar cuando algo devuelve 404 sin motivo.

### Qué caracteres veta el proxy

Cada segmento de ruta se valida contra:

```ts
const SEGMENT_PATTERN = /^[A-Za-z0-9_-]+$/;
```

Rechaza `+`, `.`, `@`, `%`, espacios y acentos. Es decir: **teléfonos en E.164, emails y cualquier decimal no pueden ir en la ruta**. Los UUIDs y los slugs con guion (`no-show`, `availability-status`) sí pasan.

**Regla: cualquier identificador que no sea UUID va en query string o en el cuerpo, nunca como segmento de ruta.** Los query params no pasan por el patrón.

### La barra final

Django la exige, y la añade **`lib/api/server-client.ts` y nadie más**. Por eso los `.api.ts` escriben rutas sin barra: `apiClient.get("calendar/week")`. No la añadas tú.

### `proxy.ts` es el middleware

En Next 16 la convención pasó de `middleware.ts` a `proxy.ts`, en la raíz. **No busques `middleware.ts`, no existe** (varios comentarios del repo todavía dicen «middleware»: es terminología heredada).

Solo comprueba que la cookie **exista**, no la descifra: el runtime Edge no tiene `node:crypto`. La validación real —descifrar y comprobar expiración— la hace el layout de `(dashboard)` y cada Route Handler. Así se evita el parpadeo de contenido privado sin duplicar la seguridad.

Consecuencia práctica: **no importes `lib/auth/session.ts` desde `proxy.ts`**. Para eso existe el módulo aislado `lib/auth/session-cookie-name.ts`.

El `matcher` excluye `/api`: cada handler se autentica solo.

---

## Las reglas duras

De `docs/frontend-architecture.md`. Son las que no se negocian:

1. **El contrato del backend manda.** No se inventan endpoints, rutas ni campos. Donde el contrato no llega, el hueco se documenta y se deja un punto de integración.
2. **Ningún componente visual habla con la red.** Las peticiones viven en `features/*/api/`.
3. **Una sola fuente para cada cosa transversal**: fechas en `lib/dates`, permisos en `lib/permissions`, errores en `lib/api/errors`, etiquetas y colores en `features/agenda/constants.ts`.
4. **El frontend no es la seguridad.** Oculta lo que el usuario no puede hacer, pero maneja correctamente cualquier 403.
5. **Nunca se simula éxito.** Un fallo se muestra; una respuesta con forma inesperada produce un error explícito, no datos inventados.

Y tres más, del código:

- **Nunca `window.confirm`.** Todos los diálogos son modales accesibles de Radix.
- **Nunca se envía `company_id`.** La empresa la resuelve el backend desde la identidad.
- **Sin `any`.** Cuando la forma es incierta: `unknown` + normalizador.

---

## Convenciones

### Un feature de punta a punta

`features/agenda/` es la referencia completa. La cadena es siempre la misma:

1. **`features/<x>/api/<x>.api.ts`** — funciones `async` sueltas, reciben `signal?: AbortSignal`, usan `apiClient` (nunca `fetch`), y pasan la respuesta por un normalizador que **lanza si la forma no cuadra**.
2. **`features/<x>/hooks/use-<x>.ts`** — `"use client"`, `useQuery` con la clave de `queryKeys`, y devuelve un objeto con forma propia (`{ items, isLoading, isError, error, refetch }`), no el resultado crudo de TanStack.
3. **`components/<x>/*.tsx`** — consume el hook. Cero red.
4. **`app/(dashboard)/<ruta>/{page,loading,error}.tsx`**.

Un feature nuevo toca además: `config/query-keys.ts`, `config/routes.ts`, la allowlist del proxy, `NAV_ITEMS` en `components/layout/app-shell.tsx`, y un test de contrato en `tests/`.

### Claves de caché

Solo en `config/query-keys.ts`, nunca literales en los hooks. Cada dominio tiene su `all` como raíz de invalidación y funciones que la prefijan. El primer elemento es una cadena en inglés y kebab-case.

Inserta tu bloque **junto a su dominio**, no al principio del objeto: reduce los conflictos con otras ramas.

### Mutaciones

**Sin actualizaciones optimistas.** El backend es la autoridad: puede rechazar por permisos, estado o conflicto, y mostrar un cambio que luego se revierte confunde.

Dónde va el toast de error, que es lo más fácil de romper:

| Tipo | Toast de error |
|---|---|
| Mutación que alimenta un **formulario** (crear, editar) | **No.** El error se muestra junto a los campos y el diálogo sigue abierto |
| Mutación de **acción** (confirmar, cancelar, enviar) | **Sí**, más `InlineAlert` dentro del diálogo |

El patrón está en `features/agenda/hooks/use-event-mutations.ts`.

TanStack está configurado globalmente para **no reintentar 4xx** y conservar los datos previos (`placeholderData`). Si tu pantalla necesita ver el estado de carga limpio, anúlalo explícitamente.

### Errores

`getErrorMessage(error)` de `lib/api/errors.ts` es **la única** forma de pintar un error al usuario. Nunca devuelve `undefined` ni deja escapar un `Request failed with status 400`.

`ApiError` trae `status`, `kind`, `code` y `fieldErrors`. Los 401 del navegador emiten un evento global que limpia la caché y redirige al login.

### Permisos

`lib/permissions/index.ts` es la fuente única. Controla **qué se muestra**, no la seguridad.

**`PERMISSION_KEYS` (en `features/auth/types.ts`) es un contrato cerrado con el backend: no inventes claves.** El tipo no compila si lo intentas, y aunque compilara no serviría — las emite `GET /users/me/permissions/`.

Matiz que se malinterpreta: el tercer argumento de `hasPermission(user, key, fallback)` **solo aplica cuando el backend no entregó capacidades** (`permissions === null`). Si devolvió el objeto con la clave en `false`, el fallback no se usa.

### Fechas

**Siempre por `lib/dates`.** La interfaz muestra la hora **de la inmobiliaria** (`company.timezone`), no la del dispositivo: dos usuarios en husos distintos tienen que ver la misma agenda.

- Toda función de formato recibe `timeZone` explícito. Si escribes `format(date, ...)` sin pasar por `toZoned()`, estás usando la hora del navegador → bug.
- Un día de calendario es una **cadena `yyyy-MM-dd`**, nunca un `Date`, para evitar corrimientos.
- `toApiDateTime()` es la única forma correcta de mandar una hora al backend.
- **Nunca concatenes cadenas para convertir husos.**

### Formularios

Dos patrones, y elegir mal se nota:

- **RHF + zod** para formularios con validación, campos condicionales o errores por campo. El esquema, los defaults y el mapeo a payload viven en `features/*/schemas/`, no en el componente.
- **`useState` a secas** para diálogos de uno a tres campos. Truco del repo: el cuerpo del diálogo **solo se monta mientras está abierto**, así arranca limpio sin `useEffect` de reset. No añadas uno.

### Componentes

**No hay librería de componentes ni de gráficas, y no se añaden.** Son primitivas de Radix envueltas a mano en `components/ui/`: `Button`, `Field`/`Input`/`Textarea`/`Select`/`Checkbox`, `Dialog`/`SheetContent`, `DropdownMenu`, y `Skeleton`/`Spinner`/`EmptyState`/`InlineAlert`/`ErrorState`.

Las gráficas del dashboard son divs con Tailwind. El calendario también es propio.

Iconos de `lucide-react`, importados estáticamente.

### Idioma

Comentarios, JSDoc, mensajes de interfaz y **nombres de tests** en español. Rutas visibles en español (`/agenda`, `/metricas`, `/perfil`). Identificadores, claves de caché y enums del contrato en inglés.

Los comentarios explican **por qué**, no qué hace la línea.

---

## Tests

Vitest + jsdom + Testing Library. **Todos en `tests/`, nunca junto al código.**

`tests/setup.ts` fija `process.env.TZ = "Europe/Madrid"` mientras la empresa opera en `America/Bogota`. **Es deliberado**: cualquier conversión que dependa de la hora del dispositivo falla de inmediato. **No cambies ese `TZ` para poner verde un test** — el test está diciendo la verdad.

El patrón dominante son **tests de contrato**: se dobla `fetch` con `vi.stubGlobal` y se afirma **la URL literal y el payload exacto**:

```ts
expect(lastCall().url).toBe("/api/proxy/calendar/week?start_date=2026-08-10");
expect(body).not.toHaveProperty("company_id");
```

Si cambias una ruta, un query param o un nombre de campo, **saltan por diseño**. No es ruido.

Factories en `tests/factories.ts`: `makeUser`, `makeCompany`, `makeSession`, `makeEvent`, `makePermissions`.

**`tests/login-form.test.tsx` es inestable en la corrida completa.** Falla un test distinto cada vez —siempre de ese archivo— y **aislado pasa entero**:

```bash
pnpm vitest run tests/login-form.test.tsx
```

Si `pnpm test` te lo saca en rojo, corre el archivo solo antes de dar por hecho que rompiste algo. Es una condición preexistente y sin arreglar, no una regresión tuya.

---

## Documentos que van por detrás del código

- La **estructura de directorios del README** no menciona `components/metrics/`, `features/inbox/`, `features/metrics/` ni `app/api/dashboard/`, que sí existen. Tampoco su tabla de pruebas está completa.
- **`frontend_endpoints.md` es la fuente de verdad del contrato del backend, y es de solo lectura para este repo.** Lo mantiene el backend. **Un agente no lo edita para justificar un endpoint nuevo**: eso invertiría la dirección de la autoridad.
- Dicho eso, hoy el módulo de métricas consume `/dashboard/*`, que **no aparece en ese archivo**. Es una inconsistencia real del repo, no un permiso para inventar: si necesitas un endpoint que no está, la vía es pedirlo al backend.
- **`docs/frontend-api-analysis.md`** registra qué existe, qué no, y qué se decidió en cada hueco. Medio código lo cita por sección. **Léelo antes de tocar la capa de API.**

---

## Flujo de contribución

`staging` es la rama de integración:

```bash
git checkout -b tipo/descripcion-corta origin/staging
# ...cambios...
pnpm lint && pnpm typecheck && pnpm test
git push -u origin tipo/descripcion-corta
```

Los PR apuntan a `staging`, **no a `main`**. Mensajes de commit en Conventional Commits, en español.

---

## Documentación

| Documento | Cubre |
|---|---|
| `docs/frontend-architecture.md` | Capas, regla de dependencias, BFF, permisos, accesibilidad |
| `docs/frontend-api-analysis.md` | Qué existe del contrato, qué no, y la decisión tomada en cada hueco |
| `frontend_endpoints.md` | El contrato del backend. Solo lectura |
| `README.md` | Arranque, stack y alcance funcional |
