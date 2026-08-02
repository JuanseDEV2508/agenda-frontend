# Agenda Inmobiliaria — Frontend

Frontend del módulo de **agenda** de una plataforma SaaS multiempresa para inmobiliarias:
inicio de sesión, calendario en vistas de mes / semana / día, creación y edición de
eventos, y todas las transiciones operativas (confirmar, iniciar, completar, cancelar,
reprogramar, reasignar e inasistencia).

El alcance es exclusivamente la agenda. No incluye gestión de inmuebles, CRM completo,
facturación, marketing ni portal público.

---

## Requisitos

| Herramienta | Versión |
|---|---|
| Node.js | ≥ 20 (probado con 24.x) |
| pnpm | ≥ 9 (probado con 11.x) |

Stack: **Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS v4 · TanStack Query ·
React Hook Form + Zod · date-fns + @date-fns/tz · Radix UI · lucide-react · sonner**.

---

## Instalación

```bash
pnpm install
cp .env.example .env.local
```

### Variables de entorno

| Variable | Obligatoria | Descripción |
|---|---|---|
| `API_BASE_URL` | ✅ | URL base del backend, incluido el prefijo de versión. Ej.: `http://localhost:8000/api/v1` |
| `AUTH_SECRET` | ✅ | Secreto de 32+ caracteres para cifrar la cookie de sesión. Genéralo con `openssl rand -base64 32` |

Ambas son **exclusivas del servidor**: el navegador nunca las recibe. No uses el prefijo
`NEXT_PUBLIC_` para secretos — se incluirían en el bundle. Si falta configuración, el login
responde con un mensaje explícito en lugar de fallar de forma silenciosa.

> `NEXT_PUBLIC_API_URL` se acepta como alternativa a `API_BASE_URL` por compatibilidad,
> pero se recomienda la primera.

---

## Ejecución

```bash
pnpm dev        # desarrollo en http://localhost:3000
pnpm build      # build de producción
pnpm start      # servir el build
pnpm lint       # ESLint (incluye reglas del React Compiler)
pnpm typecheck  # TypeScript sin emitir
pnpm test       # Vitest (una pasada)
pnpm test:watch # Vitest en modo watch
```

---

## Estructura

```text
app/
├── (auth)/login/            Pantalla de inicio de sesión
├── (dashboard)/             Zona autenticada (sesión resuelta en el servidor)
│   ├── agenda/              Calendario + detalle en /agenda/eventos/[id]
│   └── perfil/
├── api/
│   ├── auth/{login,logout,session}/   BFF de autenticación
│   └── proxy/[...path]/               Proxy servidor → backend
├── layout.tsx  ·  providers.tsx  ·  globals.css
│
components/
├── agenda/                  Calendario, formularios, acciones, detalle
├── auth/  ·  layout/  ·  ui/
│
features/
├── agenda/{api,hooks,schemas,utils}   constants.ts · types.ts
└── auth/{api,hooks}                   schemas.ts · types.ts
│
lib/
├── api/{client,server-client,errors}.ts
├── auth/{session,crypto,backend-auth,resolve-session-user,session-lookups}.ts
├── dates/       Utilidades de fecha y zona horaria (única fuente)
├── permissions/ Reglas de rol y estado (única fuente)
└── utils/
│
config/          env.ts · routes.ts · query-keys.ts
proxy.ts         Protección de rutas (convención de Next 16, antes middleware.ts)
tests/           Vitest
docs/            frontend-api-analysis.md · frontend-architecture.md
```

---

## Integración con el backend

La **única** fuente de verdad es `frontend_endpoints.md`. El análisis completo —incluidos los
huecos del contrato y cómo se resolvieron— está en
[`docs/frontend-api-analysis.md`](docs/frontend-api-analysis.md).

Endpoints consumidos:

| Recurso | Endpoints |
|---|---|
| Empresa | `GET /companies/current/` |
| Calendario | `GET /calendar/day/`, `/calendar/week/`, `/calendar/month/` |
| Eventos | `GET`, `POST /events/`; `GET`, `PATCH /events/{id}/`; `POST /events/{id}/{confirm,start,complete,cancel,no-show,reschedule,reassign}/`; `GET /events/{id}/history/` |
| Asesores | `GET /advisors/`, `GET /advisors/{id}/`, `GET /advisors/{id}/availability-status/` |
| Clientes | `GET`, `POST /clients/`; `GET /clients/{id}/` |
| Disponibilidad | `GET /advisor-availabilities/` |
| Configuración | `GET /scheduling-configurations/default/` (opcional, tolera 403) |
| Identidad y permisos | `GET /users/me/permissions/` |
| Usuarios | `GET /users/` (sólo como respaldo de identidad si el anterior no responde) |

**No se inventó ningún endpoint.** Donde el contrato no cubre una necesidad, el hueco está
documentado y el código deja el punto de integración preparado.

---

## Autenticación

El backend documenta **Basic Auth** (no hay JWT, ni refresh token, ni `/auth/login/`).
Para no exponer credenciales al navegador, el frontend actúa como **BFF**:

```
Navegador ──fetch──▶ Route Handler de Next ──Basic Auth──▶ API Django
          cookie httpOnly cifrada (AES-256-GCM)
```

1. `POST /api/auth/login` valida las credenciales llamando a `GET /companies/current/`.
2. La credencial se cifra y se guarda en una cookie `httpOnly`, `secure`, `sameSite=lax`.
3. Toda petición del cliente pasa por `/api/proxy/...`, que añade el `Authorization` en el servidor.
4. `POST /api/auth/logout` borra la cookie; el cliente limpia la caché de TanStack Query.

«Recordarme» sólo controla la duración de la cookie (sesión de navegador vs. 7 días).

⚠️ **Riesgo conocido**: Basic Auth obliga a conservar la credencial durante la sesión. Es una
limitación del backend. Cuando exponga JWT o sesión Django + CSRF, sólo hay que cambiar
`lib/auth/backend-auth.ts` y el handler de login.

### Identidad y capacidades

Al iniciar sesión se consulta `GET /users/me/permissions/`, que devuelve el usuario, su rol y
sus **capacidades efectivas** (ya combinadas con la configuración de la empresa). Esas
capacidades viajan dentro de la cookie cifrada y son la fuente de verdad de la interfaz.

Sólo un `true` explícito concede una capacidad: una clave ausente o con un tipo inesperado se
considera denegada.

La sesión se resuelve una sola vez, al iniciar sesión. Si una sesión abierta con anterioridad no
trae capacidades, el cliente llama una vez a `POST /api/auth/session`, que vuelve a resolverla en
el servidor y reescribe la cookie conservando su expiración: **se repara sola**, sin necesidad de
cerrar sesión.

⚠️ El endpoint responde correctamente, pero **no está publicado en el esquema OpenAPI**
(`/api/schema/` no lo lista; falta anotarlo para `drf-spectacular`). Por eso la llamada tolera
`404`: si no respondiera, se cae al sondeo por endpoints documentados (`GET /users/` es «solo
ADMIN»), y si nada confirma el rol se aplica el **más restrictivo** (`ADVISOR`), avisando en el
perfil. Nunca se concede un rol por inferencia.

---

## Roles

La interfaz se construye a partir de las capacidades del backend, no del rol por sí solo:

| Capacidad (`GET /users/me/permissions/`) | Qué habilita en la interfaz |
|---|---|
| `view_all_company_events` · `view_supervised_advisor_events` | Selector y filtro de asesor |
| `create_events` | Crear evento, editar y reprogramar |
| `reassign_events` | Reasignar asesor |
| `cancel_events` | Cancelar evento |
| `complete_events` | Completar evento |
| `manage_clients` | Alta rápida de cliente |

Comportamiento típico por rol:

| | ADMIN | SUPERVISOR | ADVISOR |
|---|:---:|:---:|:---:|
| Ver agendas de otros asesores | ✅ | ✅ (su alcance) | ❌ |
| Selector de asesor en filtros y formularios | ✅ | ✅ | ❌ (fijado a su perfil) |
| Crear eventos | ✅ | ✅ | ✅ (para sí mismo) |
| Editar o reasignar eventos de terceros | ✅ | ✅ | ❌ |
| Confirmar · iniciar · completar · cancelar · inasistencia · reprogramar | ✅ | ✅ | ✅ (sus eventos) |

No hay flags para `confirm`, `start` ni `no-show`: esas acciones dependen del estado del evento
y de si es propio. Las reglas viven en un único módulo: `lib/permissions/`. La interfaz oculta lo que no se puede
hacer, pero **la autorización real es del backend**: cualquier `403` se muestra como mensaje de
permisos sin cerrar sesión.

---

## Decisiones técnicas

- **Calendario propio** (no FullCalendar): control total de accesibilidad, solapes, locale `es`,
  zona horaria de la empresa y responsive, sin CSS externo que pelee con Tailwind v4.
- **Zona horaria de la empresa** en toda la interfaz: dos usuarios en husos distintos ven la
  misma agenda. Nada se formatea con la hora del dispositivo.
- **Consulta por rango**: `/calendar/*` según la vista; jamás se descarga histórico.
- **Estado en la URL** (`?vista=&fecha=&asesor=&estado=&tipo=&q=`): la vista es compartible y
  sobrevive a una recarga.
- **Sin actualizaciones optimistas** en transiciones de estado: el backend es la autoridad.
- **Errores normalizados**: los formatos del backend se traducen a mensajes en español;
  nunca se muestra `Request failed with status code 400`.
- **Conflictos de horario**: el formulario no se cierra, conserva los datos y resalta fecha y hora.

Detalle completo en [`docs/frontend-architecture.md`](docs/frontend-architecture.md).

---

## Pruebas

```bash
pnpm test
```

127 pruebas sobre lo crítico:

| Archivo | Cubre |
|---|---|
| `tests/dates.test.ts` | Formatos en español, zona horaria de la empresa, rangos visibles, navegación |
| `tests/permissions.test.ts` | Capacidades del backend, reglas por rol y estado, respaldo sin permisos |
| `tests/errors.test.ts` | Normalización de los formatos de error, 401/403/404/409 |
| `tests/normalizers.test.ts` | Parseo tolerante de respuestas del backend |
| `tests/event-schema.test.ts` | Validaciones, campos condicionales, payload, diff de edición |
| `tests/calendar-layout.test.ts` | Solapes, eventos multidía, filtros |
| `tests/events-api.test.ts` | Contrato: rutas, payloads, conflicto de horario, red caída |
| `tests/session-lookups.test.ts` | Parseo de `/users/me/permissions/`, identidad y rol |
| `tests/login-form.test.tsx` | Login correcto y fallido, `next`, doble envío, mostrar contraseña |

---

## Funcionalidades pendientes por falta de endpoint

| Funcionalidad | Bloqueo | Punto de integración preparado |
|---|---|---|
| Slots de disponibilidad reales | No hay endpoint para la agenda interna (sólo existe para el chatbot) | `features/agenda/api/availability.api.ts` |
| — | `GET /users/me/permissions/` ya está integrado; sólo falta que el backend lo anote en el esquema OpenAPI | `lib/auth/resolve-session-user.ts` |
| Filtros de asesor/estado/tipo en servidor | `/calendar/*` no documenta filtros | `features/agenda/api/events.api.ts` |
| Renovación de sesión | No hay refresh token | `lib/auth/backend-auth.ts` |
| Recuperación de contraseña | No hay endpoint | — |

---

## Restricciones respetadas

- No se modificó el backend ni se crearon migraciones.
- No se inventaron endpoints ni campos.
- No hay tokens, credenciales ni secretos en el código.
- No se envía `company_id`: la empresa la resuelve el backend desde la identidad autenticada.
