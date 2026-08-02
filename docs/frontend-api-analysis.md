# Análisis de API para el frontend de agenda

> Fuente de verdad: `frontend_endpoints.md` (raíz del proyecto).
> Documento complementario consultado: `../chatbot_endpoints.md` (integración de chatbot). **No se consume desde este frontend**, pero se usa como evidencia del formato de errores y de la forma del recurso `Event`.
> Fecha del análisis: 2026-08-01.

Este documento se escribió **antes** de implementar. Registra qué existe, qué no existe, y qué decisión se tomó en cada hueco. Ningún endpoint fuera de esta lista se consume en el código.

> **Verificación posterior**: el esquema OpenAPI real de la instancia local
> (`GET http://localhost:8000/api/schema/`) se consultó al terminar la implementación para
> contrastar nombres de campo y parámetros. Los hallazgos están incorporados en §3, §4 y §7.

---

## 1. Datos generales del contrato

| Aspecto | Valor documentado |
|---|---|
| Base URL | `https://api.tu-dominio.com/api/v1` (parametrizada por entorno) |
| Formato | JSON, DRF |
| Paginación de listados | DRF: `{ count, next, previous, results }` |
| Multiempresa | El backend resuelve la empresa desde la identidad autenticada. **`company_id` nunca se envía** |
| Fechas | ISO-8601 **con offset**, p. ej. `2026-08-10T15:00:00-05:00` |
| Zona horaria de la empresa | Devuelta por `GET /companies/current/` → `timezone` (p. ej. `America/Bogota`) |
| Errores de negocio | `{"error": {"code": "EVENT_CONFLICT", ...}}` con HTTP `400` |
| Doc adicional | `/api/docs/` y `/api/schema/` (OpenAPI) |

---

## 2. Autenticación

### Lo que dice la documentación

> «La instalación actual admite **Basic Auth** para desarrollo e integraciones de confianza. Una SPA en producción debe usar autenticación por sesión con CSRF o añadir JWT/OIDC antes de almacenar credenciales en el navegador.»

### Lo que **no** existe

- ❌ No hay `POST /auth/login/`.
- ❌ No hay `POST /auth/refresh/` ni access/refresh token.
- ❌ No hay `POST /auth/logout/`.
- ✅ Sí existe `GET /users/me/permissions/` (identidad + capacidades efectivas). Ver §3.
- ❌ No hay recuperación de contraseña.

Por lo tanto **no se implementa flujo JWT ni refresh token**: inventarlo sería inventar endpoints.

### Decisión de implementación: BFF con cookie cifrada `httpOnly`

Basic Auth exige enviar la credencial en **cada** petición. Exponerla al navegador (localStorage/sessionStorage) sería la peor opción posible. La arquitectura elegida:

```
Navegador  ──fetch──▶  Next.js Route Handler (servidor)  ──Basic Auth──▶  API Django
           cookie                     descifra la cookie
        httpOnly/secure               y añade Authorization
```

1. `POST /api/auth/login` (Route Handler de Next, **no** del backend) recibe email + contraseña.
2. El servidor valida la credencial contra el endpoint real `GET /companies/current/` con `Authorization: Basic ...`.
   - `200` → credenciales válidas. `401` → credenciales inválidas.
3. La credencial se cifra con **AES-256-GCM** (`AUTH_SECRET`) y se guarda en una cookie `httpOnly`, `secure`, `sameSite=lax`, con expiración.
4. Todas las llamadas del cliente van a `/api/proxy/<ruta>`, que reenvía a la API real añadiendo el header `Authorization` en el servidor.
5. `POST /api/auth/logout` borra la cookie y el cliente limpia la caché de TanStack Query.

**El bundle del navegador nunca contiene la URL del backend, la credencial ni el header `Authorization`.**

### ⚠️ Riesgo registrado

Basic Auth obliga a conservar la contraseña (cifrada) mientras dura la sesión: es una limitación **del backend**, no del frontend. Mitigaciones aplicadas: cifrado autenticado AES-GCM, cookie `httpOnly` inaccesible a JS, expiración, cero logging de credenciales, y **un único punto de cambio** (`lib/auth/backend-auth.ts`) para migrar a JWT o sesión Django + CSRF cuando el backend lo ofrezca.

`Recordarme` **sí** se implementa (controla únicamente la duración de la cookie de sesión: sesión de navegador vs. 7 días). No se almacena la contraseña en el cliente.

---

## 3. Identidad, rol y capacidades del usuario autenticado

### Fuente principal: `GET /users/me/permissions/`

```json
{
  "user": { "id": "uuid", "email": "asesor@inmobiliaria.co", "full_name": "Carlos Pérez",
            "role": "ADVISOR", "company_id": "uuid" },
  "permissions": {
    "manage_users": false, "manage_advisors": false, "manage_supervisions": false,
    "manage_clients": true, "manage_scheduling_configuration": false,
    "view_company_indicators": false, "view_supervisor_indicators": false,
    "view_own_indicators": true, "view_all_company_events": false,
    "view_supervised_advisor_events": false, "view_own_events": true,
    "create_events": true, "reassign_events": false,
    "edit_advisor_availability": true, "cancel_events": true, "complete_events": true
  }
}
```

Devuelve el usuario **y** sus capacidades efectivas, ya combinadas con la configuración
predeterminada de la empresa (`create_events`, `reassign_events` y `edit_advisor_availability`
dependen de ella). Es la fuente de verdad para construir la interfaz.

Secuencia de login (`lib/auth/resolve-session-user.ts`):

| Paso | Endpoint | Para qué |
|---|---|---|
| 1 | `GET /companies/current/` | Valida credenciales y entrega `{id, name, timezone, status}` |
| 2 | `GET /users/me/permissions/` | Identidad, rol y capacidades efectivas |
| 3 | `GET /advisors/` | `advisor.id` propio: el endpoint de permisos no lo devuelve y hace falta para saber si un evento es «mío» |

Reglas de interpretación:

- Sólo se aceptan capacidades **explícitamente `true`**. Una clave ausente, `null`, `"true"` o `1` se considera **denegada**: nunca se concede una capacidad por omisión.
- Un `role` desconocido se descarta en lugar de aceptarse.
- El frontend usa las capacidades **sólo para la interfaz**; el backend sigue validando cada operación y todo `403` se maneja igualmente.

### ⚠️ Inconsistencia verificada: el esquema OpenAPI está incompleto

El endpoint **existe y responde** en la instancia local, pero **no está publicado en el esquema
OpenAPI** (`GET http://localhost:8000/api/schema/`, consultado el 2026-08-01), donde bajo
`/users/` sólo aparecen `list`, `create`, `{id}`, `{id}/activate/` y `{id}/deactivate/`.

Comprobación realizada:

```
GET /api/v1/users/me/permissions/   → 403 {"detail":"Las credenciales... no se proveyeron."}
GET /api/v1/no-existe-esto/         → 404
```

Un `403` (en lugar de `404`) confirma que la ruta está registrada y sólo exige autenticación.
La conclusión es que falta anotarla para `drf-spectacular`, no que falte el endpoint.

Decisión: se implementa **según el contrato documentado**, y además la llamada es **tolerante a
`404`/`403`** por si un despliegue no la tiene. Si el endpoint no responde:

1. Se cae al sondeo anterior: `GET /users/` está documentado como «Solo ADMIN», así que un `200` identifica a un administrador.
2. Si nada confirma el rol, se asume **`ADVISOR`** (el más restrictivo) y `permissions` queda en `null`.
3. Con `permissions === null`, `lib/permissions/` aplica reglas equivalentes por rol para no dejar la interfaz inutilizable, y el perfil avisa al usuario.

Nunca se «promueve» a un rol superior por inferencia.

Si el endpoint responde pero sin un `role` reconocible, **las capacidades se conservan igualmente**
y sólo el rol se resuelve por sondeo: las capacidades son la fuente de verdad de la interfaz.

### Sesiones abiertas antes de un cambio en el backend

La sesión se resuelve **una sola vez**, durante el login, y queda guardada en la cookie cifrada.
Una sesión iniciada antes de que el backend publicara este endpoint conservaría
`permissions: null` hasta expirar (7 días con «recordarme»).

Para evitarlo, `POST /api/auth/session` vuelve a resolver la sesión en el servidor con la
credencial ya guardada y reescribe la cookie **conservando su expiración original**. El cliente
lo invoca una única vez, de forma automática, cuando detecta `permissions === null`. Así una
sesión antigua se repara sola sin obligar al usuario a cerrar sesión.

### Capacidades no cubiertas por el contrato

No existen flags para `confirm`, `start` ni `no-show`. Para esas acciones se sigue usando
estado del evento + propiedad, y el backend decide. Tampoco hay un flag de edición: se usa
`create_events`, que refleja si el usuario puede operar sobre la agenda.

---

## 4. Endpoints consumidos por este frontend

### 4.1 Identidad y permisos

| Método | Ruta | Uso en el frontend | Respuesta |
|---|---|---|---|
| `GET` | `/users/me/permissions/` | Identidad, rol y capacidades efectivas al iniciar sesión | `{user: {...}, permissions: {...}}` |

Se consulta **una sola vez por sesión** (en el servidor, durante el login) y viaja dentro de la
cookie cifrada: no se repite en cada carga de página. Ver §3 para el detalle y la inconsistencia
registrada.

### 4.2 Empresa

| Método | Ruta | Uso en el frontend | Respuesta |
|---|---|---|---|
| `GET` | `/companies/current/` | Validación de credenciales en login, nombre de la inmobiliaria en el header, **`timezone` de la empresa** para todo el manejo de fechas | `{id, name, timezone, status}` |

`PATCH /companies/current/` existe pero **no se usa**: administrar el perfil del tenant está fuera del alcance del módulo de agenda.

### 4.3 Asesores

| Método | Ruta | Uso | Notas |
|---|---|---|---|
| `GET` | `/advisors/` | Selector de asesor (crear/editar/reasignar), filtro de agenda, resolución del `advisor.id` propio | Paginado DRF. El backend limita el listado al alcance del rol |
| `GET` | `/advisors/{id}/` | Datos del asesor en el perfil | |
| `GET` | `/advisors/{id}/availability-status/` | Indicador de disponibilidad junto al asesor | Acción documentada; **forma de la respuesta no documentada** → se parsea de forma tolerante y, si no se reconoce, no se muestra nada |

`POST /advisors/`, `PATCH`, `activate`, `deactivate` **no se usan**: gestión de asesores está fuera del alcance.

### 4.4 Clientes

| Método | Ruta | Uso | Notas |
|---|---|---|---|
| `GET` | `/clients/` | Buscador de cliente en el formulario de evento | Paginado. **El parámetro de búsqueda no está documentado** → se envía `search=` (convención `SearchFilter` de DRF) **y además** se filtra en cliente sobre la página recibida, de modo que el buscador funciona aunque el backend ignore el parámetro |
| `POST` | `/clients/` | «Crear cliente rápido» desde el formulario de evento | Payload documentado: `{first_name, last_name, phone, email, source}` |
| `GET` | `/clients/{id}/` | Datos del cliente en el detalle del evento | |

`PATCH /clients/{id}/`, `deactivate`, `GET /clients/{id}/events/` no se usan en el MVP (CRM fuera de alcance).

### 4.5 Eventos

| Método | Ruta | Uso |
|---|---|---|
| `GET` | `/events/?advisor={uuid}&status=PENDING&start_at__gte=...` | **Solo** para la vista de lista/agenda filtrada, con los parámetros literalmente documentados |
| `POST` | `/events/` | Crear evento |
| `GET` | `/events/{id}/` | Detalle |
| `PATCH` | `/events/{id}/` | Edición parcial (solo campos modificados) |
| `POST` | `/events/{id}/confirm/` | `PENDING → CONFIRMED` |
| `POST` | `/events/{id}/start/` | `CONFIRMED → IN_PROGRESS` |
| `POST` | `/events/{id}/complete/` | `CONFIRMED`/`IN_PROGRESS → COMPLETED` |
| `POST` | `/events/{id}/cancel/` | Payload documentado `{reason, cancellation_source}` |
| `POST` | `/events/{id}/no-show/` | Marcar inasistencia |
| `POST` | `/events/{id}/reschedule/` | Payload documentado `{start_at, end_at}`. Devuelve el **nuevo** evento; el original queda `RESCHEDULED` |
| `POST` | `/events/{id}/reassign/` | Reasignar asesor |
| `GET` | `/events/{id}/history/` | Auditoría inmutable mostrada en el detalle |

Payload documentado de creación:

```json
{
  "advisor": "ADVISOR_UUID",
  "client": "CLIENT_UUID",
  "event_type": "PROPERTY_VISIT",
  "title": "Visita apartamento",
  "start_at": "2026-08-10T15:00:00-05:00",
  "end_at": "2026-08-10T16:00:00-05:00",
  "timezone": "America/Bogota"
}
```

⚠️ **Nombres de campo de relación**: la documentación usa `advisor` y `client` (no `advisor_id` / `client_id`). El prompt de negocio hablaba de `advisor_id`/`client_id`; **prevalece la documentación del backend**. Registrado como inconsistencia (§7).

Campos de referencia externa de inmueble (evidenciados en `chatbot_endpoints.md` y en el prompt de negocio): `property_external_id`, `property_code`, `property_title`, `property_address`, `property_url`. Se envían **solo** cuando el tipo de evento es `PROPERTY_VISIT` y solo si tienen valor.

⚠️ Payloads **no documentados** de las acciones `confirm`, `start`, `complete`, `no-show`, `reassign`. Decisión: se envía el mínimo razonable y explícito:

| Acción | Payload enviado | Justificación |
|---|---|---|
| `confirm` | `{}` | Sin datos documentados |
| `start` | `{}` | Sin datos documentados |
| `complete` | `{completion_notes}` solo si el usuario escribe notas | Campo nombrado en el modelo de negocio; si el backend lo rechaza, el error se muestra tal cual, no se oculta |
| `cancel` | `{reason, cancellation_source}` | **Documentado** |
| `no-show` | `{no_show_type}` + `{notes}` opcional | `no_show_type` ∈ `CLIENT_NO_SHOW`/`ADVISOR_NO_SHOW`/`UNKNOWN` (modelo de negocio) |
| `reschedule` | `{start_at, end_at}` (+ `advisor` solo si el usuario lo cambia y tiene permiso) | `start_at`/`end_at` **documentados** |
| `reassign` | `{advisor}` | Consistente con el nombre del campo en `POST /events/` |

Todos estos payloads están centralizados en `features/agenda/api/events.api.ts`: ajustar el contrato es cambiar **un** archivo.

### 4.6 Calendario (fuente principal de la agenda)

| Método | Ruta | Vista |
|---|---|---|
| `GET` | `/calendar/day/?date=2026-08-10` | Día |
| `GET` | `/calendar/week/?start_date=2026-08-10` | Semana |
| `GET` | `/calendar/month/?year=2026&month=8` | Mes |

**Decisión clave**: la agenda consulta **estos** endpoints, no `/events/` con rangos. Motivos:

1. Corresponden exactamente a las tres vistas requeridas.
2. Evitan **inventar** `start_at__lte` (solo `start_at__gte` está documentado).
3. Nunca se descarga histórico: cada consulta cubre únicamente el rango visible.

Consecuencias:

- La rejilla mensual muestra días de los meses vecinos: se consultan los 2–3 meses que cubre la rejilla, cada uno con su propia clave de caché (navegar entre meses reaprovecha la caché).
- ⚠️ **Los endpoints `/calendar/*` no documentan parámetros de filtro.** Los filtros de asesor / estado / tipo se aplican **en el cliente sobre el rango ya acotado**. No es «traerse todo y filtrar»: el conjunto está limitado al día/semana/mes visible. Punto único de cambio: `features/agenda/api/events.api.ts` → `fetchCalendarRange()`.
- ⚠️ La **forma de la respuesta** de `/calendar/*` no está documentada. Se implementa un normalizador tolerante que acepta: array plano, `{results: []}`, `{events: []}` y objeto agrupado por fecha `{ "2026-08-10": [] }`. Si llega algo distinto, se muestra un error de UI explícito, **nunca** datos inventados.

### 4.7 Disponibilidad

| Método | Ruta | Uso |
|---|---|---|
| `GET` | `/advisor-availabilities/?advisor={uuid}` | Mostrar los bloques de disponibilidad configurados del asesor en el formulario, como ayuda visual |

⚠️ **No existe un endpoint de «slots disponibles» para la agenda interna.** El único cálculo real de disponibilidad (`POST /integrations/chatbot/availability/`) pertenece a la integración de chatbot y **no se consume desde aquí**.

Decisión: **no se simulan slots**. El formulario muestra los bloques de disponibilidad informativos cuando existen, y el **backend sigue siendo la autoridad**: un horario inválido se rechaza con `EVENT_CONFLICT` y se muestra al usuario (§14 del requerimiento). No se deshabilitan horas basándose en suposiciones del frontend, porque «ausencia de eventos» ≠ «disponible».

➡️ **Petición al backend #2**: exponer un endpoint de slots para agenda interna (equivalente al del chatbot). Punto de integración preparado: `features/agenda/api/availability.api.ts`.

### 4.8 Configuración de agendamiento

| Método | Ruta | Uso |
|---|---|---|
| `GET` | `/scheduling-configurations/default/` | Duración por defecto de los eventos, buffers y máximo diario, si el backend los devuelve |

⚠️ Documentado como **«Solo ADMIN»**. La consulta se hace de forma **opcional y tolerante a `403`**: si falla, el formulario usa 60 minutos como duración inicial (valor de UI, no dato inventado del backend) y no se muestra ningún error.

### 4.9 Endpoints documentados que NO se consumen (fuera de alcance)

`POST/PATCH /users/`, `GET /users/` (sólo como respaldo de identidad, ver §3), `activate`, `deactivate`, `/supervisions/*`, `POST/PATCH/DELETE /advisor-availabilities/*`, `POST/PATCH /scheduling-configurations/*`, `PATCH /companies/current/`, todo `/integrations/chatbot/*`.

---

## 5. Filtros disponibles

| Filtro | Soporte real | Implementación |
|---|---|---|
| Asesor | `GET /events/?advisor=` documentado; `/calendar/*` no documentado | Cliente, sobre el rango visible (ver §4.5) |
| Estado | `GET /events/?status=` documentado | Cliente, sobre el rango visible |
| Tipo de evento | No documentado | Cliente, sobre el rango visible |
| Rango de fechas | `/calendar/*` (documentado) | **Servidor** |
| Búsqueda de texto | No documentado | Cliente, sobre el rango visible |
| Cliente / Origen | No documentado como filtro | ❌ No se implementa como filtro de agenda |

Los filtros se reflejan en la URL (`?vista=&fecha=&asesor=&estado=&tipo=`) para que la vista sea compartible y recargable.

---

## 6. Manejo de errores

Formatos que el normalizador (`lib/api/errors.ts`) sabe interpretar:

```json
{"error": {"code": "EVENT_CONFLICT", "message": "..."}}   // documentado (400)
{"detail": "..."}                                          // estándar DRF
{"campo": ["mensaje"]}                                     // validación DRF por campo
{"non_field_errors": ["mensaje"]}                          // validación DRF general
```

| HTTP | Comportamiento |
|---|---|
| `400`/`422` | Errores por campo mapeados al formulario; `error.code` de negocio con mensaje propio |
| `400` + `EVENT_CONFLICT` | El formulario **no se cierra**, se conservan los datos, se resaltan fecha/hora y se ofrece cambiar horario o asesor |
| `401` | Sesión expirada → limpiar cookie y caché, redirigir a `/login?next=<ruta>`. **No hay refresh**, así que no se intenta renovar |
| `403` | Mensaje de permisos **sin** cerrar sesión ni redirigir |
| `404` | «Evento no encontrado o fuera de tu alcance» (no revela pertenencia a otra empresa) |
| `409` | Conflicto de estado/horario, mismo tratamiento que `EVENT_CONFLICT` |
| `500`+ | Error general con acción de reintento |
| Red/timeout | «No fue posible conectar con el servidor» + reintento |

Códigos de negocio conocidos por la documentación: `EVENT_CONFLICT`, `ADVISOR_UNAVAILABLE`, `COMPANY_INACTIVE`.

---

## 7. Inconsistencias detectadas (se conserva el contrato documentado)

1. **`advisor`/`client` vs `advisor_id`/`client_id`** — el requerimiento de negocio menciona `*_id`; la documentación del backend usa `advisor` y `client`. → Se usa **`advisor`/`client`**.
2. **Payload de cancelación divergente** — agenda: `{reason, cancellation_source}`; chatbot: `{cancellation_reason}`. Son endpoints distintos. → Para `/events/{id}/cancel/` se usa **`{reason, cancellation_source}`**.
3. **`start_at__lte` no documentado** — solo aparece `start_at__gte`. → No se usa; se emplean los endpoints `/calendar/*`.
4. **Parámetro de búsqueda de clientes no documentado** → `search=` + filtrado defensivo en cliente.
5. **`GET /users/me/permissions/` documentado pero ausente del esquema OpenAPI local** → se implementa según el contrato, con respaldo tolerante a `404` y degradación al rol más restrictivo (§3).
6. **`EventList` devuelve `advisor` y `client` como UUID con el nombre en campos hermanos** (`advisor_name`, `client_name`), mientras que el detalle puede anidar el objeto → el normalizador acepta ambas formas.
7. **Sin flags para `confirm`, `start` y `no-show`** → esas acciones se rigen por estado y propiedad; el backend decide.
8. **Payloads de acciones no documentados** (`complete`, `no-show`, `reassign`) → mínimo explícito y centralizado.
9. **Respuesta de `/calendar/*` sin esquema** (el OpenAPI local declara literalmente «No response body») → normalizador tolerante.
10. **`GET /events/` sólo declara `page` en el OpenAPI**, aunque la documentación describe `advisor`, `status` y `start_at__gte` → se usan los parámetros documentados y la agenda no depende de ellos (usa `/calendar/*`).

---

## 8. Resumen de decisiones frontend

| Decisión | Motivo |
|---|---|
| BFF en Route Handlers de Next + cookie `httpOnly` cifrada | Basic Auth sin exponer credenciales al navegador |
| `/calendar/*` como fuente de la agenda | Documentado y acotado al rango visible; evita inventar filtros |
| Filtros de asesor/estado/tipo en cliente | Los endpoints de calendario no documentan filtros |
| Calendario propio con `date-fns` (sin FullCalendar) | Control total de accesibilidad, solape, responsive, locale `es` y zona horaria de la empresa; sin dependencia pesada ni CSS externo que pelee con Tailwind v4 |
| Zona horaria de la empresa (`@date-fns/tz`) | El backend entrega ISO con offset; la UI muestra la hora **de la empresa**, no la del dispositivo |
| TanStack Query con claves estables | Caché por rango, cancelación de peticiones obsoletas, invalidación tras mutación |
| Sin actualizaciones optimistas en transiciones de estado | El backend es la autoridad de las transiciones |
| Rol más restrictivo por defecto | Nunca conceder UI por inferencia |
| Capacidades del backend por encima del rol | `GET /users/me/permissions/` ya combina rol y configuración de la empresa |
| Sólo `true` concede una capacidad | Una clave ausente o con tipo inesperado no debe habilitar acciones |
