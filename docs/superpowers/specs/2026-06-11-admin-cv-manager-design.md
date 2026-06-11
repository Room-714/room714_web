# Gestor de CVs en Admin — Diseño

**Fecha:** 2026-06-11
**Estado:** Aprobado (pendiente de revisión de spec por el usuario)

## Contexto

Ayer se añadió el flujo de recepción de CVs en `/careers`:

- Modelo `Candidate` (Prisma): `position`, `country`, `education`, `cvBlobUrl`, `aiSummary`, `emailSent`, `expiresAt`.
- El CV se sube a Vercel Blob con `access: "public"` y `addRandomSuffix: true`.
- Solo se almacena si pasa la criba silenciosa (`country === "ES"` y formación en `GRADO|MASTER|DOCTORADO`).
- Tras almacenar, se envía un email a `rrhh@room714.com` con un botón que **descarga el CV directamente desde la URL pública del blob**.
- Un cron (`/api/cron/cleanup-candidates`) borra blob + fila cuando `expiresAt <= now` (30 días).

## Objetivo

Sustituir el botón de descarga directa del email por un acceso a una zona de admin donde RRHH puede **ver** el CV y **eliminarlo de inmediato**, sin esperar al borrado automático de 30 días.

## Decisiones de diseño

### 1. Privacidad del CV: privacidad efectiva (no blob privado)

**Restricción:** Vercel Blob v2.0.1 solo admite `access: 'public'`. No existen blobs privados en este SDK.

Para lograr el objetivo (que solo RRHH logueado pueda ver el CV) sin migrar de proveedor:

- **No se expone nunca la URL del blob.** Se elimina el enlace directo del email.
- El PDF se sirve a través de un **proxy autenticado**: `GET /api/admin/candidates/[id]/cv`. Comprueba sesión admin → lee `cvBlobUrl` de la BD → descarga los bytes en el servidor → los devuelve como `application/pdf`. El navegador nunca ve la URL del blob.
- Se mantiene `addRandomSuffix` (la URL es no adivinable).

**Limitación documentada:** el blob sigue siendo técnicamente accesible si alguien ya conociera la URL exacta, pero al no publicarse en ningún sitio (email, HTML, red del cliente), en la práctica el CV solo es alcanzable a través del login admin. Es lo máximo alcanzable con este SDK.

### 2. Autenticación

Hoy `/admin` no tiene guard server-side; la protección es solo de facto (el login redirige ahí). Para alojar datos personales (CVs) hace falta un guard real, y el enlace del email debe llevar al login y devolver al CV.

- Se añade **`middleware.js`** con `next-auth/middleware` (`withAuth`) protegiendo `/admin/:path*`.
  - Usuario no logueado pulsando el botón del email → redirige a `/auth/login?callbackUrl=/admin/candidates/[id]` y, tras entrar, vuelve al CV.
  - Cierra de paso el agujero del admin de blog (mismo mecanismo del framework).
  - `withAuth` funciona porque `CredentialsProvider` fuerza sesiones JWT.
- La página de login se ajusta para **respetar `callbackUrl`** (hoy hace `router.push("/admin")` fijo).
- El proxy de PDF y `deleteCandidate` validan además sesión con `isAuthorizedAdmin` (ya existe en `app/lib/auth.js`) — defensa en profundidad.

### 3. Alcance: detalle + listado

## Arquitectura / ficheros

| Fichero | Acción | Propósito |
|---|---|---|
| `middleware.js` | nuevo | `withAuth` protegiendo `/admin/:path*` |
| `app/(admin-zone)/admin/candidates/page.js` | nuevo | Listado de candidatos vivos (server component) |
| `app/(admin-zone)/admin/candidates/[id]/page.js` | nuevo | Detalle: datos + resumen IA + visor PDF + borrar (server component) |
| `app/(admin-zone)/admin/candidates/actions.js` | nuevo | `deleteCandidate(id)`: borra blob + fila |
| `app/(admin-zone)/admin/candidates/DeleteCandidateButton.js` | nuevo | Botón cliente con `confirm()` que invoca la action |
| `app/api/admin/candidates/[id]/cv/route.js` | nuevo | Proxy PDF autenticado (`X-Frame-Options: SAMEORIGIN`) |
| `app/lib/notifications/candidateReady.js` | editar | Botón → `${NEXTAUTH_URL}/admin/candidates/[id]` |
| `app/(admin-zone)/auth/login/page.js` | editar | Honrar `callbackUrl` |
| `app/(admin-zone)/admin/page.js` | editar | Añadir acceso "CVs" en el sidebar |

### Listado (`/admin/candidates`)

- Server component que consulta `Candidate` con `expiresAt > now`, ordenado por `createdAt` desc.
- Muestra por candidato: ID, posición, país, formación, fecha de recepción, días hasta borrado automático, indicador de email enviado.
- Cada fila enlaza a su detalle.

### Detalle (`/admin/candidates/[id]`)

- Server component que carga el candidato por `id`.
- Si la fila no existe (borrada manualmente o por el cron de 30 días) → mensaje "Este CV ya no está disponible".
- Muestra: datos del candidato, resumen IA (`aiSummary`), visor del PDF incrustado vía `<iframe src="/api/admin/candidates/[id]/cv">`, y botón **Eliminar ahora**.

### Borrado (`deleteCandidate(id)`)

- Server action que replica la lógica del cron para un solo candidato:
  - `del(cvBlobUrl)` (tolerante a fallo del blob, igual que el cron).
  - `prisma.candidate.delete({ where: { id } })`.
- Tras borrar, `revalidatePath` del listado y redirección a `/admin/candidates`.

### Proxy de PDF (`/api/admin/candidates/[id]/cv`)

- Valida `isAuthorizedAdmin`.
- Lee `cvBlobUrl` de la BD; si no existe → 404.
- `fetch` del blob en el servidor y stream de la respuesta con:
  - `Content-Type: application/pdf`
  - `X-Frame-Options: SAMEORIGIN` (sobrescribe el `DENY` global de `next.config.mjs` para permitir el `<iframe>` del mismo origen).
  - `Content-Disposition: inline`.

### Nuevo email (`candidateReady.js`)

- El botón "Descargar CV original (PDF)" se sustituye por **"Ver y gestionar CV →"** apuntando a `${NEXTAUTH_URL}/admin/candidates/${candidateId}`.
- Se mantiene la nota de borrado automático a 30 días.

## Manejo de errores

- Detalle con fila inexistente → vista "no disponible", no error 500.
- Proxy con candidato inexistente → 404.
- Fallo al borrar el blob → se registra y se continúa con el borrado de la fila (igual que el cron), para no dejar filas huérfanas.
- `NEXTAUTH_URL` ausente → el email no debería construir un enlace roto; fallback razonable a `https://www.room714.com`.

## Consideraciones técnicas

- `X-Frame-Options: DENY` global en `next.config.mjs` rompería el `<iframe>`; el proxy fuerza `SAMEORIGIN`.
- `/admin` vive en la raíz (sin prefijo `[lang]`), por lo que el enlace del email no se cruza con el i18n auto-redirect de Vercel.
- `withAuth` requiere estrategia JWT, garantizada por `CredentialsProvider`.

## Testing

- No hay tests automáticos en el repo. Verificación manual:
  1. Login admin → navegar al listado de candidatos.
  2. Abrir un detalle → ver el PDF incrustado.
  3. Pulsar el botón del email estando deslogueado → redirige a login → vuelve al detalle.
  4. Eliminar → desaparece del listado y el blob deja de servirse.

## Fuera de alcance

- Migrar a un proveedor de almacenamiento con blobs privados reales.
- Conservar filas anonimizadas tras el borrado (se borra fila completa, como el cron).
- Refactor del admin de blog más allá de añadir el acceso "CVs" y el guard de middleware.
