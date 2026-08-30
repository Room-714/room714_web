// Avisa a Google de los 18 destinos de la consolidación para que reprocese
// antes las redirecciones.
//
// Ojo con lo que NO se importa: `app/lib/seo/indexingApi.js` haría exactamente
// esto, pero importa `./googleAuth` sin extensión, y Node en ESM exige la
// extensión en los imports relativos — eso lo resuelven Next y vitest, no
// `node` a secas. Así que se importa `googleAuth.js` (que solo importa
// `crypto`, un builtin, y sí carga bien) y se llama al endpoint a mano.
import { PrismaClient } from "@prisma/client";
import { getAccessToken } from "../app/lib/seo/googleAuth.js";

const ENDPOINT = "https://indexing.googleapis.com/v3/urlNotifications:publish";
const SCOPE = "https://www.googleapis.com/auth/indexing";

const prisma = new PrismaClient();
const DESDE = new Date("2026-08-30T00:00:00Z");

const redirs = await prisma.postRedirect.findMany({
  where: { reason: "consolidation", createdAt: { gte: DESDE }, toSlug: { not: null } },
  select: { toSlug: true, lang: true },
});

const urls = [...new Set(redirs.map((r) => `https://www.room714.com/${r.lang}/blog/${r.toSlug}`))];
console.log(`destinos únicos a notificar: ${urls.length}`);

const token = await getAccessToken(SCOPE);

for (const url of urls) {
  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ url, type: "URL_UPDATED" }),
  });
  console.log(`  ${res.ok ? "ok " : "ERR"} ${res.status} ${url}`);
  if (!res.ok) console.log("      " + (await res.text()).slice(0, 150));
}

await prisma.$disconnect();
