# Arquitectura del frontend de agenda

Documento técnico complementario al [`README.md`](../README.md) y al
[análisis de la API](./frontend-api-analysis.md).

---

## 1. Principios

1. **El contrato del backend manda.** No se inventan endpoints, rutas ni campos. Donde el
   contrato no llega, el hueco se documenta y se deja un punto de integración.
2. **Ningún componente visual habla con la red.** Las peticiones viven en `features/*/api/`,
   consumidas mediante hooks de TanStack Query.
3. **Una sola fuente para cada cosa transversal**: fechas (`lib/dates`), permisos
   (`lib/permissions`), errores (`lib/api/errors`), etiquetas y colores
   (`features/agenda/constants.ts`).
4. **El frontend no es la seguridad.** Oculta lo que el usuario no puede hacer, pero maneja
   correctamente cualquier `403` del backend.
5. **Nunca se simula éxito.** Un fallo se muestra; una respuesta con forma inesperada produce
   un error explícito, no datos inventados.

---

## 2. Capas

```
┌──────────────────────────────────────────────────────────────┐
│ app/            Rutas, layouts, Route Handlers (BFF y proxy)  │
├──────────────────────────────────────────────────────────────┤
│ components/     Presentación. Sin fetch, sin URLs de backend  │
├──────────────────────────────────────────────────────────────┤
│ features/       api/ · hooks/ · schemas/ · utils/ por dominio │
├──────────────────────────────────────────────────────────────┤
│ lib/            Cliente HTTP, sesión, fechas, permisos        │
├──────────────────────────────────────────────────────────────┤
│ config/         Entorno, rutas, claves de caché               │
└──────────────────────────────────────────────────────────────┘
```

Regla de dependencias: `components → features → lib → config`. Nunca al revés.

---

## 3. Flujo de autenticación

```
┌────────────┐  POST /api/auth/login   ┌──────────────────┐  GET /companies/current/  ┌─────────┐
│  Navegador │ ──────────────────────▶ │  Route Handler   │ ────────────────────────▶ │ Backend │
│            │                          │  (servidor Next) │   Authorization: Basic     │ Django  │
│            │ ◀────────────────────── │                  │ ◀──────────────────────── │         │
└────────────┘  Set-Cookie httpOnly     └──────────────────┘        200 / 401          └─────────┘
                (AES-256-GCM)
```

### Por qué un BFF

`frontend_endpoints.md` sólo documenta **Basic Auth**. Sin BFF habría que guardar la credencial
en el navegador, lo que es inaceptable. Con BFF:

- El bundle del cliente no contiene ni la URL del backend ni credenciales.
- La cookie es `httpOnly`: inaccesible desde JavaScript, inmune a XSS de lectura de token.
- `sameSite=lax` mitiga CSRF en peticiones cross-site; `secure` se activa en producción.
- Migrar a JWT o sesión Django + CSRF toca **dos archivos**: `lib/auth/backend-auth.ts` y
  `app/api/auth/login/route.ts`.

### Piezas

| Archivo | Responsabilidad |
|---|---|
| `app/api/auth/login/route.ts` | Valida credenciales contra un endpoint real y crea la cookie |
| `app/api/auth/logout/route.ts` | Elimina la cookie |
| `app/api/auth/session/route.ts` | Devuelve la sesión pública (sin credenciales) |
| `app/api/proxy/[...path]/route.ts` | Reenvía al backend añadiendo `Authorization` |
| `lib/auth/crypto.ts` | Cifrado AES-256-GCM de la cookie |
| `lib/auth/session.ts` | Lectura, expiración y construcción de la cookie |
| `lib/auth/resolve-session-user.ts` | Resuelve identidad, rol y capacidades |
| `proxy.ts` | Protección de rutas (presencia de cookie) |
| `app/(dashboard)/layout.tsx` | Validación real de la sesión antes de renderizar |

### Protección de rutas en dos niveles

| Nivel | Comprueba | Motivo |
|---|---|---|
| `proxy.ts` (Edge) | Que **exista** la cookie | El runtime Edge no dispone de `node:crypto`; redirige rápido a `/login?next=…` |
| Layout `(dashboard)` (Node) | Que la cookie **descifre y no haya expirado** | Es la validación real; se ejecuta antes de renderizar, así que no hay parpadeo de contenido privado |

Las respuestas `401` desde el cliente emiten un evento global (`agenda:session-expired`) que
limpia la caché, avisa al usuario y redirige a `/login` conservando la ruta solicitada.

### Seguridad del proxy

- Lista blanca de recursos permitidos: no es una pasarela abierta a toda la API.
- Validación del formato de cada segmento de ruta (evita path traversal).
- Reenvía el cuerpo de error original para que el formulario mapee errores por campo.
- Nunca registra credenciales; en el log del login sólo aparece el código de estado.

---

## 4. Capa de API

### Cliente del navegador — `lib/api/client.ts`

Llama siempre a `/api/proxy/<recurso>`. Normaliza errores, propaga `AbortSignal` (TanStack Query
cancela peticiones obsoletas al cambiar de rango) y distingue una cancelación de un fallo de red.

### Cliente del servidor — `lib/api/server-client.ts`

Único lugar que conoce `API_BASE_URL`. Añade la barra final que exige Django, aplica timeout de
15 s, fuerza `cache: "no-store"` (la respuesta depende de la identidad en un sistema multiempresa)
y convierte cualquier fallo en `ApiError`.

### Módulos por dominio

```
features/agenda/api/events.api.ts        Calendario, CRUD y transiciones
features/agenda/api/advisors.api.ts      Asesores y estado de disponibilidad
features/agenda/api/clients.api.ts       Búsqueda y alta rápida de clientes
features/agenda/api/availability.api.ts  Bloques y configuración (opcionales)
features/agenda/api/normalizers.ts       Parseo tolerante de respuestas
features/auth/api/auth.api.ts            BFF de autenticación
```

### Normalizadores tolerantes

El backend no publica el esquema de todas sus respuestas. `normalizers.ts` acepta las variantes
razonables (array plano, `results`, `events`, agrupado por fecha; relación como UUID o como objeto
anidado) y **descarta** lo que no entiende en lugar de inventarlo: un enum desconocido queda en
`null` y un registro sin `id` o sin `start_at` se ignora.

---

## 5. Gestión de estado

| Tipo de estado | Dónde vive |
|---|---|
| Datos del servidor | TanStack Query |
| Vista, fecha y filtros de la agenda | URL (`?vista=&fecha=&asesor=&estado=&tipo=&q=`) |
| Sesión | Contexto de React, alimentado por el servidor |
| Estado efímero de UI | `useState` local |
| Vista preferida | `localStorage` (sólo preferencia, nada sensible) |

### Claves de caché — `config/query-keys.ts`

```
["calendar","day",fecha] · ["calendar","week",inicio] · ["calendar","month",año,mes]
["events","detail",id]   · ["events","history",id]
["advisors","list"]      · ["clients","search",término]
["scheduling-configuration","default"]
```

Cada mes tiene su propia clave: navegar entre meses reaprovecha lo ya descargado.

### Invalidación tras mutación

Toda mutación invalida `["calendar"]` (el evento pudo cambiar de día o de asesor), `["events"]` y
el detalle e historial del evento afectado. La reprogramación invalida además el evento original,
porque el backend lo deja en `RESCHEDULED` y crea uno nuevo.

**No se usan actualizaciones optimistas** en las transiciones de estado: el backend puede
rechazarlas por permisos, estado o conflicto, y revertir la interfaz confundiría al usuario.

---

## 6. Fechas y zonas horarias

Regla central: **la interfaz muestra siempre la hora de la inmobiliaria**
(`company.timezone`, p. ej. `America/Bogota`), nunca la del dispositivo.

| Concepto | Representación |
|---|---|
| Instante del backend | ISO-8601 con offset (`2026-08-10T15:00:00-05:00`) |
| Día que el usuario mira | Cadena `yyyy-MM-dd` (nunca un `Date`, para evitar corrimientos) |
| Hora en un formulario | Cadena `HH:mm` |

Funciones de `lib/dates`:

```
parseApiDate · toZoned · calendarDateOf · minutesOfDay
formatEventDate · formatEventTime · formatEventTimeRange · formatDuration
toApiDateTime · splitApiDateTime · addMinutesToTime
getVisibleRange · monthsCoveringRange · shiftAnchor · todayInZone
```

`toApiDateTime` construye un `TZDate` en la zona de la empresa y lo formatea con offset: no hay
ninguna concatenación de cadenas ni aritmética manual de husos.

Las pruebas corren en `Europe/Madrid` mientras la empresa opera en `America/Bogota`, de modo que
cualquier conversión que dependa de la hora del dispositivo falla de inmediato.

Formato de la interfaz (§32): `sábado, 1 de agosto de 2026` · `1 ago 2026` · `8:30 a. m.` ·
`8:30 a. m. – 9:30 a. m.`. El locale `es` de date-fns produce `AM/PM`, así que el periodo del día
se compone manualmente.

---

## 7. Permisos

La fuente principal son las **capacidades efectivas** que devuelve
`GET /users/me/permissions/` al iniciar sesión y que viajan dentro de la cookie de sesión.
`lib/permissions/` las combina con el **estado del evento** y la **propiedad**:

```
hasPermission · canViewAllAdvisors · canSelectAdvisor · canCreateEvent · canManageClients
canEditEvent · canReassignEvent · canConfirmEvent · canStartEvent · canCompleteEvent
canCancelEvent · canMarkNoShow · canRescheduleEvent · hasAnyEventAction · isEventOwner
isTerminalStatus
```

| Capacidad del backend | Qué controla en la interfaz |
|---|---|
| `view_all_company_events` / `view_supervised_advisor_events` | Selector de asesor en filtros y formularios |
| `create_events` | Botón «Crear evento», edición y reprogramación |
| `reassign_events` | Acción «Reasignar asesor» |
| `cancel_events` | Acción «Cancelar evento» |
| `complete_events` | Acción «Completar» |
| `manage_clients` | Alta rápida de cliente en el formulario |

Sólo un `true` explícito concede una capacidad. Si el backend no las entrega
(`permissions === null`), se aplican reglas equivalentes por rol para no bloquear la
aplicación, y el perfil lo advierte.

No hay condiciones de rol dispersas por los componentes. Reglas notables:

- Estados terminales (`COMPLETED`, `CANCELLED`, `RESCHEDULED`, `NO_SHOW`) bloquean la edición.
- `canCancelEvent` respeta la regla del backend: no se cancela un evento completado o reprogramado.
- Un `ADVISOR` no puede reasignar ni actuar sobre eventos de otro asesor.
- No hay flags para `confirm`, `start` ni `no-show`: esas acciones se rigen por estado y propiedad.
- El `advisor` de un asesor viaja en un campo oculto y el backend vuelve a validarlo: cambiarlo
  desde el navegador no evade nada.

---

## 8. El calendario

Implementación propia sobre `date-fns`. Se descartó FullCalendar por peso, por el coste de
adaptar su CSS a Tailwind v4 y por la necesidad de control fino sobre accesibilidad, solapes y
zona horaria.

| Vista | Endpoint | Componente |
|---|---|---|
| Mes | `GET /calendar/month/` (los 2–3 meses de la rejilla) | `calendar-month.tsx` |
| Semana | `GET /calendar/week/` | `calendar-time-grid.tsx` |
| Día | `GET /calendar/day/` | `calendar-time-grid.tsx` |
| Lista | reutiliza el rango cargado | `agenda-list.tsx` |

### Algoritmo de solapes — `features/agenda/utils/layout.ts`

1. Cada evento se convierte a minutos desde la medianoche **en la zona de la empresa**.
2. Los eventos que abarcan varios días se recortan a la jornada y se marcan como continuados.
3. Se agrupan en cadenas de solapamiento y dentro de cada grupo se asigna la primera columna libre.
4. El ancho es `100 / columnas`: **ningún evento queda oculto** y el solape se señala también con
   un icono, no sólo con el ancho.

### Interacciones diferenciadas (§9.6)

| Acción | Resultado |
|---|---|
| Clic en el número del día (vista mes) | Abre la vista diaria |
| Clic en el botón `+` de la celda o en una franja horaria | Crea un evento en esa fecha/hora |
| Clic en un evento | Abre el panel de detalle |

---

## 9. Flujo de un evento

```
                 ┌───────────┐
   crear ──────▶ │  PENDING  │
                 └─────┬─────┘
             confirmar │
                 ┌─────▼─────┐
                 │ CONFIRMED │──── iniciar ──▶ IN_PROGRESS
                 └─────┬─────┘                      │
                       └──────── completar ─────────┤
                                                    ▼
                                               COMPLETED

  desde PENDING / CONFIRMED / IN_PROGRESS:  cancelar → CANCELLED
                                            inasistencia → NO_SHOW
                                            reprogramar → RESCHEDULED (+ evento nuevo)
```

La interfaz sólo ofrece las transiciones válidas para el estado y el rol, pero **es el backend
quien decide**: cualquier rechazo se muestra tal cual.

### Conflictos de horario (§14)

Cuando el backend responde `EVENT_CONFLICT` (o `409`):

1. El diálogo **no se cierra** y conserva todo lo escrito.
2. El bloque de fecha y hora se resalta.
3. Se muestra un mensaje accionable: cambia el horario o el asesor.
4. Nunca se reintenta ni se fuerza la creación.

No existe validación local de conflictos: otro usuario puede ocupar el hueco en el mismo instante.

---

## 10. Errores

`lib/api/errors.ts` traduce los formatos del backend a un `ApiError` con `kind`, `code`,
`fieldErrors` y un mensaje en español listo para mostrar.

| Situación | Comportamiento |
|---|---|
| Validación (`400`/`422`) | Errores junto a cada campo del formulario |
| Conflicto (`EVENT_CONFLICT`, `409`) | Aviso ámbar, formulario abierto |
| Sesión expirada (`401`) | Limpieza de caché y redirección conservando la ruta |
| Permisos (`403`) | Mensaje de permisos, **sin** cerrar sesión |
| No encontrado (`404`) | «No existe o no está dentro de tu alcance» (no revela otra empresa) |
| Servidor (`5xx`) / red | Mensaje general con acción de reintento |

---

## 11. Accesibilidad y responsive

- Etiquetas asociadas a cada control, errores enlazados con `role="alert"`, `aria-invalid`.
- Modales de Radix: control de foco, cierre con `Escape`, `aria-modal`. Nunca `window.confirm`.
- Enlace «Saltar al contenido principal» y foco visible global.
- `aria-label` en los controles de navegación del calendario y en los eventos, con una
  descripción completa (tipo, título, horario, estado, asesor, cliente, conflicto).
- El estado y el tipo se comunican con **color + icono + texto**; los cancelados llevan además
  tachado.
- Escritorio: calendario completo con panel lateral de detalle. Tablet: sidebar colapsable.
  Móvil: vista de lista por defecto, botón flotante para crear, modales a pantalla completa y
  `overflow-x: clip` para evitar desplazamiento horizontal accidental.

---

## 12. Rendimiento

- Consulta acotada al rango visible; caché por mes reutilizada al navegar.
- Cancelación de peticiones obsoletas vía `AbortSignal`.
- `placeholderData` conserva los datos previos: el calendario no parpadea al cambiar de fecha.
- Debounce de 300 ms en filtros y 350 ms en la búsqueda de clientes.
- Iconos importados de forma estática (nada de resolución dinámica del paquete completo).
- El calendario no se carga en la pantalla de login (rutas separadas por grupo de layout).
- Sin reintentos automáticos en errores `4xx`.

---

## 13. Convenciones

- Componentes y archivos en `kebab-case`; componentes exportados con nombre.
- `"use client"` sólo donde hace falta interactividad.
- Sin `any`: cuando la forma es incierta se usa `unknown` + normalizador.
- Los enums viajan al backend con su valor original; las traducciones son sólo de presentación.
- Los comentarios explican **por qué**, no qué hace la línea.
- Todo mensaje visible está en español.
