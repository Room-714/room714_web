# Gestor de CVs en Admin — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Sustituir el botón de descarga directa del CV en el email a RRHH por un acceso autenticado en `/admin` donde se ve el CV y se puede borrar de inmediato.

**Architecture:** El email enlaza a `/admin/candidates/[id]`. Un `middleware.js` (next-auth) protege todo `/admin`. El PDF se sirve por un proxy autenticado que descarga el blob en el servidor y nunca expone su URL. El borrado replica la lógica del cron para un candidato.

**Tech Stack:** Next.js 16 (App Router, server components, server actions), Prisma 6 (Postgres), next-auth 4 (CredentialsProvider, JWT), Vercel Blob, Resend, Tailwind.

**Nota sobre testing:** El repo no tiene framework de tests. Cada tarea se verifica con `npm run lint`, `npm run build` (atrapa errores de import/tipo) y comprobación manual donde aplique. Todos los comandos asumen cwd `c:/Users/josea/Proyecto_002/my-app`.

---

### Task 1: proxy.js redirige con callbackUrl + login lo respeta

> **Corrección (descubierta en ejecución):** Next.js 16 usa `proxy.js`, no `middleware.js`, y ya existe `proxy.js` en la raíz que **ya protege `/admin`** (redirige a `/auth/login` sin sesión). Su `matcher` excluye `/api`, así que el proxy del PDF no se ve afectado y se protege solo con `isAuthorizedAdmin`. Por tanto NO se crea ningún `middleware.js`; solo se añade `callbackUrl` al redirect existente.

**Files:**
- Modify: `proxy.js:25-28`
- Modify: `app/(admin-zone)/auth/login/page.js`

- [ ] **Step 1: Añadir callbackUrl al redirect de admin en proxy.js**

En `proxy.js`, dentro del bloque `if (!session)`, reemplazar:

```js
    if (!session) {
      const loginUrl = new URL("/auth/login", request.url);
      return NextResponse.redirect(loginUrl);
    }
```

por:

```js
    if (!session) {
      const loginUrl = new URL("/auth/login", request.url);
      loginUrl.searchParams.set(
        "callbackUrl",
        `${pathname}${request.nextUrl.search}`,
      );
      return NextResponse.redirect(loginUrl);
    }
```

- [ ] **Step 2: Hacer que el login vuelva a la URL de origen**

En `app/(admin-zone)/auth/login/page.js`, dentro de `handleSubmit`, sustituir el bloque del `else` que hace `router.push("/admin")`. Reemplazar:

```js
    if (res?.error) {
      setError("Credenciales incorrectas");
      setLoading(false);
    } else {
      router.push("/admin");
      router.refresh();
    }
```

por:

```js
    if (res?.error) {
      setError("Credenciales incorrectas");
      setLoading(false);
    } else {
      const callbackUrl =
        new URLSearchParams(window.location.search).get("callbackUrl") ||
        "/admin";
      router.push(callbackUrl);
      router.refresh();
    }
```

(Se lee de `window.location` en vez de `useSearchParams` para evitar el requisito de Suspense de Next y no tocar la estructura del componente.)

- [ ] **Step 3: Lint y build**

Run: `npm run lint && npm run build`
Expected: termina sin errores. El build muestra `/admin` como ruta con middleware aplicado.

- [ ] **Step 4: Verificación manual**

Run: `npm run dev`, abrir en incógnito `http://localhost:3000/admin`.
Expected: redirige a `/auth/login?callbackUrl=%2Fadmin`. Tras login correcto, vuelve a `/admin`.

- [ ] **Step 5: Commit**

```bash
git add proxy.js "app/(admin-zone)/auth/login/page.js"
git commit -m "feat(admin): proxy redirige a login con callbackUrl y login lo respeta"
```

---

### Task 2: Módulo compartido de etiquetas de candidato

**Files:**
- Create: `app/lib/candidateLabels.js`

- [ ] **Step 1: Crear el módulo**

Create `app/lib/candidateLabels.js`:

```js
export const POSITION_LABEL = {
  DEVELOPER: "Desarrollador",
  DESIGNER: "Diseñador",
  PRODUCT_MANAGER: "Product Manager",
};

export const EDUCATION_LABEL = {
  GRADO: "Grado Universitario",
  MASTER: "Máster Universitario",
  DOCTORADO: "Doctorado",
  OTHER: "Otra",
};
```

- [ ] **Step 2: Lint**

Run: `npm run lint`
Expected: sin errores.

- [ ] **Step 3: Commit**

```bash
git add app/lib/candidateLabels.js
git commit -m "chore(admin): etiquetas compartidas de posición y formación"
```

---

### Task 3: Proxy autenticado del PDF + excluir su ruta del X-Frame-Options global

**Files:**
- Create: `app/api/admin/candidates/[id]/cv/route.js`
- Modify: `next.config.mjs:63-75`

- [ ] **Step 1: Crear el route handler del proxy**

Create `app/api/admin/candidates/[id]/cv/route.js`:

```js
import { isAuthorizedAdmin } from "@/app/lib/auth";
import { prisma } from "@/app/lib/prisma";

export const maxDuration = 60;

export async function GET(request, { params }) {
  if (!(await isAuthorizedAdmin(request))) {
    return new Response("No autorizado", { status: 401 });
  }

  const { id } = await params;
  const candidateId = Number(id);
  if (!Number.isInteger(candidateId)) {
    return new Response("No encontrado", { status: 404 });
  }

  const candidate = await prisma.candidate.findUnique({
    where: { id: candidateId },
    select: { cvBlobUrl: true },
  });
  if (!candidate) {
    return new Response("No encontrado", { status: 404 });
  }

  const blobRes = await fetch(candidate.cvBlobUrl);
  if (!blobRes.ok) {
    return new Response("CV no disponible", { status: 502 });
  }

  // Streameamos los bytes sin exponer nunca la URL del blob al navegador.
  // X-Frame-Options: SAMEORIGIN permite incrustarlo en el <iframe> del
  // detalle (el config global pone DENY, por eso esta ruta se excluye allí).
  return new Response(blobRes.body, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": "inline",
      "X-Frame-Options": "SAMEORIGIN",
      "Cache-Control": "private, no-store",
    },
  });
}
```

- [ ] **Step 2: Excluir la ruta del proxy de la regla global X-Frame-Options**

En `next.config.mjs`, dentro de `headers()`, cambiar el `source` de la regla de `X-Frame-Options`. Reemplazar:

```js
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "X-Frame-Options",
            value: "DENY",
          },
        ],
      },
    ];
  },
```

por:

```js
  async headers() {
    return [
      {
        // Clickjacking protection en todo el sitio EXCEPTO el proxy de CVs,
        // que necesita SAMEORIGIN (lo pone su propio route handler) para
        // poder incrustarse en el <iframe> del detalle. Un X-Frame-Options
        // duplicado/conflictivo hace que el navegador bloquee el iframe.
        source: "/((?!api/admin/candidates/).*)",
        headers: [
          {
            key: "X-Frame-Options",
            value: "DENY",
          },
        ],
      },
    ];
  },
```

- [ ] **Step 3: Build**

Run: `npm run build`
Expected: sin errores; aparece la ruta `/api/admin/candidates/[id]/cv`.

- [ ] **Step 4: Verificación manual**

Con `npm run dev` y sesión admin iniciada, y un candidato existente con id real (ej. 1), abrir `http://localhost:3000/api/admin/candidates/1/cv`.
Expected: el navegador muestra/descarga el PDF inline. En incógnito (sin sesión): `401 No autorizado`. Id inexistente: `404`.

- [ ] **Step 5: Commit**

```bash
git add "app/api/admin/candidates/[id]/cv/route.js" next.config.mjs
git commit -m "feat(admin): proxy autenticado del PDF de CV con XFO SAMEORIGIN"
```

---

### Task 4: Server action de borrado + botón cliente

**Files:**
- Create: `app/(admin-zone)/admin/candidates/actions.js`
- Create: `app/(admin-zone)/admin/candidates/DeleteCandidateButton.js`

- [ ] **Step 1: Crear el server action**

Create `app/(admin-zone)/admin/candidates/actions.js`:

```js
"use server";

import { del } from "@vercel/blob";
import { prisma } from "@/app/lib/prisma";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

// Borrado manual de un candidato: replica la lógica del cron
// (cleanup-candidates) para uno solo. La ruta del action vive bajo /admin,
// así que el middleware ya exige sesión antes de invocarla.
export async function deleteCandidate(id) {
  const candidateId = Number(id);
  if (!Number.isInteger(candidateId)) {
    redirect("/admin/candidates");
  }

  const candidate = await prisma.candidate.findUnique({
    where: { id: candidateId },
    select: { cvBlobUrl: true },
  });

  if (candidate) {
    try {
      await del(candidate.cvBlobUrl);
    } catch (err) {
      // Igual que el cron: si el blob falla, seguimos borrando la fila
      // para no dejar registros huérfanos.
      console.error(`Borrar blob ${candidate.cvBlobUrl} falló:`, err.message);
    }
    await prisma.candidate.delete({ where: { id: candidateId } });
  }

  revalidatePath("/admin/candidates");
  redirect("/admin/candidates");
}
```

- [ ] **Step 2: Crear el botón cliente**

Create `app/(admin-zone)/admin/candidates/DeleteCandidateButton.js`:

```js
"use client";

import { useState, useTransition } from "react";
import { deleteCandidate } from "./actions";

export default function DeleteCandidateButton({ candidateId }) {
  const [isPending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);

  const handleDelete = () => {
    if (!confirming) {
      setConfirming(true);
      return;
    }
    startTransition(() => {
      deleteCandidate(candidateId);
    });
  };

  return (
    <button
      type="button"
      onClick={handleDelete}
      disabled={isPending}
      className="bg-white border-2 border-red-500 text-red-500 font-black py-4 px-8 rounded-2xl hover:bg-red-500 hover:text-white transition-all uppercase tracking-[0.2em] disabled:opacity-50"
    >
      {isPending
        ? "Borrando…"
        : confirming
          ? "¿Seguro? Pulsa otra vez"
          : "Eliminar CV ahora"}
    </button>
  );
}
```

- [ ] **Step 3: Lint**

Run: `npm run lint`
Expected: sin errores. (El build completo se valida en la Task 5, cuando el detalle ya usa estos ficheros.)

- [ ] **Step 4: Commit**

```bash
git add "app/(admin-zone)/admin/candidates/actions.js" "app/(admin-zone)/admin/candidates/DeleteCandidateButton.js"
git commit -m "feat(admin): borrado manual de candidato (blob + fila)"
```

---

### Task 5: Página de detalle del candidato

**Files:**
- Create: `app/(admin-zone)/admin/candidates/[id]/page.js`

- [ ] **Step 1: Crear la página de detalle**

Create `app/(admin-zone)/admin/candidates/[id]/page.js`:

```js
import Link from "next/link";
import { prisma } from "@/app/lib/prisma";
import { POSITION_LABEL, EDUCATION_LABEL } from "@/app/lib/candidateLabels";
import DeleteCandidateButton from "../DeleteCandidateButton";

export const dynamic = "force-dynamic";

export default async function CandidateDetailPage({ params }) {
  const { id } = await params;
  const candidateId = Number(id);

  const candidate = Number.isInteger(candidateId)
    ? await prisma.candidate.findUnique({ where: { id: candidateId } })
    : null;

  if (!candidate) {
    return (
      <main className="min-h-screen bg-gray-100 text-black p-8 max-w-3xl mx-auto">
        <Link href="/admin/candidates" className="text-sm font-bold underline">
          ← Volver al listado
        </Link>
        <div className="mt-8 bg-white rounded-3xl p-10 border border-gray-200 text-center">
          <h1 className="text-2xl font-black">Este CV ya no está disponible</h1>
          <p className="text-gray-500 mt-2">
            Pudo borrarse manualmente o por la política de retención de 30 días.
          </p>
        </div>
      </main>
    );
  }

  const positionLabel = POSITION_LABEL[candidate.position] || candidate.position;
  const educationLabel =
    EDUCATION_LABEL[candidate.education] || candidate.education;

  return (
    <main className="min-h-screen bg-gray-100 text-black p-4 md:p-8 max-w-5xl mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <Link href="/admin/candidates" className="text-sm font-bold underline">
          ← Volver al listado
        </Link>
        <DeleteCandidateButton candidateId={candidate.id} />
      </div>

      <div className="mt-6 bg-white rounded-3xl p-6 md:p-8 border border-gray-200 shadow-sm">
        <h1 className="text-3xl font-black mb-6">
          Candidato #{candidate.id} — {positionLabel}
        </h1>

        <table className="text-sm mb-8">
          <tbody>
            <tr>
              <td className="pr-6 py-1 text-gray-500">País</td>
              <td className="py-1 font-bold">{candidate.country}</td>
            </tr>
            <tr>
              <td className="pr-6 py-1 text-gray-500">Formación</td>
              <td className="py-1 font-bold">{educationLabel}</td>
            </tr>
            <tr>
              <td className="pr-6 py-1 text-gray-500">Recibido</td>
              <td className="py-1">
                {new Date(candidate.createdAt).toLocaleString("es-ES")}
              </td>
            </tr>
            <tr>
              <td className="pr-6 py-1 text-gray-500">Borrado automático</td>
              <td className="py-1">
                {new Date(candidate.expiresAt).toLocaleDateString("es-ES")}
              </td>
            </tr>
          </tbody>
        </table>

        <h2 className="text-xl font-black mb-2">Resumen ejecutivo (IA)</h2>
        <div className="bg-gray-50 rounded-2xl p-5 text-sm leading-relaxed whitespace-pre-wrap mb-8">
          {candidate.aiSummary || "No se pudo generar resumen automático."}
        </div>

        <h2 className="text-xl font-black mb-2">CV (PDF)</h2>
        <iframe
          src={`/api/admin/candidates/${candidate.id}/cv`}
          title={`CV del candidato ${candidate.id}`}
          className="w-full h-[80vh] rounded-2xl border border-gray-200"
        />
      </div>
    </main>
  );
}
```

- [ ] **Step 2: Build**

Run: `npm run build`
Expected: sin errores; aparece la ruta `/admin/candidates/[id]`.

- [ ] **Step 3: Verificación manual**

Con sesión admin y un candidato real, abrir `http://localhost:3000/admin/candidates/1`.
Expected: se ven los datos, el resumen IA y el PDF incrustado en el iframe. Con un id inexistente: vista "Este CV ya no está disponible". Pulsar "Eliminar CV ahora" dos veces → borra y redirige al listado.

- [ ] **Step 4: Commit**

```bash
git add "app/(admin-zone)/admin/candidates/[id]/page.js"
git commit -m "feat(admin): página de detalle de candidato con visor PDF y borrado"
```

---

### Task 6: Listado de candidatos vivos

**Files:**
- Create: `app/(admin-zone)/admin/candidates/page.js`

- [ ] **Step 1: Crear la página de listado**

Create `app/(admin-zone)/admin/candidates/page.js`:

```js
import Link from "next/link";
import { prisma } from "@/app/lib/prisma";
import { POSITION_LABEL, EDUCATION_LABEL } from "@/app/lib/candidateLabels";

export const dynamic = "force-dynamic";

function daysLeft(expiresAt) {
  const ms = new Date(expiresAt).getTime() - Date.now();
  return Math.max(0, Math.ceil(ms / (24 * 60 * 60 * 1000)));
}

export default async function CandidatesListPage() {
  const candidates = await prisma.candidate.findMany({
    where: { expiresAt: { gt: new Date() } },
    orderBy: { createdAt: "desc" },
  });

  return (
    <main className="min-h-screen bg-gray-100 text-black p-4 md:p-8 max-w-5xl mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-4 mb-6">
        <h1 className="text-3xl font-black">CVs recibidos</h1>
        <Link href="/admin" className="text-sm font-bold underline">
          ← Volver al admin
        </Link>
      </div>

      {candidates.length === 0 ? (
        <div className="bg-white rounded-3xl p-10 border border-gray-200 text-center text-gray-500">
          No hay CVs activos ahora mismo.
        </div>
      ) : (
        <div className="bg-white rounded-3xl border border-gray-200 overflow-hidden divide-y divide-gray-100">
          {candidates.map((c) => (
            <Link
              key={c.id}
              href={`/admin/candidates/${c.id}`}
              className="flex items-center justify-between gap-4 p-5 hover:bg-gray-50 transition-colors"
            >
              <div>
                <p className="font-black">
                  #{c.id} — {POSITION_LABEL[c.position] || c.position}
                </p>
                <p className="text-sm text-gray-500">
                  {c.country} · {EDUCATION_LABEL[c.education] || c.education} ·{" "}
                  {new Date(c.createdAt).toLocaleDateString("es-ES")}
                </p>
              </div>
              <div className="text-right text-xs">
                <span className="block font-bold text-red-600">
                  borra en {daysLeft(c.expiresAt)} d
                </span>
                <span className="text-gray-400">
                  {c.emailSent ? "email enviado" : "email pendiente"}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
```

- [ ] **Step 2: Build**

Run: `npm run build`
Expected: sin errores; aparece la ruta `/admin/candidates`.

- [ ] **Step 3: Verificación manual**

Con sesión admin, abrir `http://localhost:3000/admin/candidates`.
Expected: lista los candidatos vivos ordenados por fecha desc, cada uno enlaza a su detalle. Sin candidatos: mensaje "No hay CVs activos ahora mismo."

- [ ] **Step 4: Commit**

```bash
git add "app/(admin-zone)/admin/candidates/page.js"
git commit -m "feat(admin): listado de CVs recibidos vivos"
```

---

### Task 7: Cambiar el botón del email a RRHH

**Files:**
- Modify: `app/lib/notifications/candidateReady.js:71-75`

- [ ] **Step 1: Construir la URL de gestión**

En `app/lib/notifications/candidateReady.js`, justo después de la línea `const summaryHtml = ...` (antes del `try {`), añadir:

```js
  const baseUrl = process.env.NEXTAUTH_URL || "https://www.room714.com";
  const manageUrl = `${baseUrl}/admin/candidates/${candidateId}`;
```

- [ ] **Step 2: Reemplazar el botón de descarga directa**

Reemplazar este bloque del HTML:

```js
  <p style="margin-top: 24px;">
    <a href="${cvBlobUrl}" style="background:#000;color:#fff;padding:12px 20px;text-decoration:none;border-radius:8px;font-weight:bold;display:inline-block;">
      Descargar CV original (PDF)
    </a>
  </p>
```

por:

```js
  <p style="margin-top: 24px;">
    <a href="${manageUrl}" style="background:#000;color:#fff;padding:12px 20px;text-decoration:none;border-radius:8px;font-weight:bold;display:inline-block;">
      Ver y gestionar CV &rarr;
    </a>
  </p>
```

(El parámetro `cvBlobUrl` sigue llegando a la función pero ya no se usa en el email; no hace falta tocar la llamada en `submit/route.js`.)

- [ ] **Step 3: Build**

Run: `npm run build`
Expected: sin errores.

- [ ] **Step 4: Verificación manual**

Revisar que el HTML del email apunta a `${NEXTAUTH_URL}/admin/candidates/<id>` y no a la URL del blob. (Opcional: enviar un CV de prueba que pase la criba y comprobar el correo recibido.)

- [ ] **Step 5: Commit**

```bash
git add app/lib/notifications/candidateReady.js
git commit -m "feat(careers): el email a RRHH enlaza al gestor admin en vez de al blob público"
```

---

### Task 8: Acceso a CVs desde el sidebar del admin

**Files:**
- Modify: `app/(admin-zone)/admin/page.js:324-331`

- [ ] **Step 1: Añadir el enlace en la columna de botones**

En `app/(admin-zone)/admin/page.js`, asegurar el import de `Link` arriba del fichero (junto a los demás imports):

```js
import Link from "next/link";
```

Luego, en la columna de botones del sidebar, justo después del botón "Generar post IA" (el `<button onClick={handleGenerateAi} ...>...</button>`) y antes del `<h3 className="font-black pl-4 mt-4 text-xl">Publicaciones</h3>`, añadir:

```js
            <Link
              href="/admin/candidates"
              className="bg-white border-2 border-black text-black px-2 py-4 rounded-2xl hover:bg-black hover:text-white font-bold transition-colors uppercase text-center"
            >
              CVs recibidos
            </Link>
```

- [ ] **Step 2: Build**

Run: `npm run build`
Expected: sin errores.

- [ ] **Step 3: Verificación manual**

Con sesión admin, abrir `http://localhost:3000/admin`. Pulsar "CVs recibidos".
Expected: navega a `/admin/candidates`.

- [ ] **Step 4: Commit**

```bash
git add "app/(admin-zone)/admin/page.js"
git commit -m "feat(admin): acceso a CVs recibidos desde el sidebar"
```

---

## Verificación end-to-end final

- [ ] En incógnito, pulsar el enlace del email (`/admin/candidates/<id>`) → redirige a login → tras entrar, aterriza en el detalle del candidato correcto.
- [ ] El PDF se ve incrustado; la URL del blob no aparece en el HTML ni en la pestaña de red (solo `/api/admin/candidates/<id>/cv`).
- [ ] Eliminar un candidato → desaparece del listado y `/api/admin/candidates/<id>/cv` devuelve 404.
- [ ] `npm run build` limpio.
