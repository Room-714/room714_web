// Auditoría de las URLs de blog del sitemap.
//
// Recorre TODAS las URLs de artículo que anuncia el sitemap y comprueba que
// cada una devuelve el artículo que le corresponde: mismo slug, HTTP 200 sin
// saltos, y el H1 (y el <title>) coincidiendo con el título que la base de
// datos tiene guardado para ese slug.
//
// El sitemap es la fuente porque es lo que Google rastrea: si una URL de ahí
// redirige o pinta otro artículo, es un problema real de indexación, no una
// curiosidad interna.
//
// Uso:
//   node --env-file=.env.local scripts/auditar-slugs-blog.mjs
//   node --env-file=.env.local scripts/auditar-slugs-blog.mjs --base=http://localhost:3000
//   node --env-file=.env.local scripts/auditar-slugs-blog.mjs --json
//
// Sale con código 1 si encuentra discrepancias, para poder usarlo en CI.

import { PrismaClient } from "@prisma/client";

const args = process.argv.slice(2);
const getArg = (name, fallback) => {
  const hit = args.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
};

const BASE = getArg("base", "https://www.room714.com").replace(/\/$/, "");
const CONCURRENCY = Number(getArg("concurrency", "6"));
const AS_JSON = args.includes("--json");
const MAX_HOPS = 5;

// ─── Utilidades ─────────────────────────────────────────────────────────────

// Normaliza para comparar títulos: sin etiquetas, sin entidades, sin tildes,
// sin puntuación y en minúsculas. Es deliberadamente permisiva: lo que busca
// son artículos DISTINTOS, no diferencias de comillas o de acentos.
const normalizar = (texto) =>
  (texto || "")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;|&#34;|&laquo;|&raquo;|&#171;|&#187;/g, '"')
    .replace(/&#39;|&apos;|&lsquo;|&rsquo;/g, "'")
    .replace(/&aacute;/g, "a")
    .replace(/&eacute;/g, "e")
    .replace(/&iacute;/g, "i")
    .replace(/&oacute;/g, "o")
    .replace(/&uacute;/g, "u")
    .replace(/&ntilde;/g, "n")
    .replace(/&[a-z#0-9]+;/gi, " ")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const extraer = (html, etiqueta) => {
  const m = html.match(new RegExp(`<${etiqueta}[^>]*>([\\s\\S]*?)</${etiqueta}>`, "i"));
  return m ? m[1] : null;
};

// Recorre la cadena de redirecciones a mano para poder contarla, en lugar de
// dejar que fetch la siga en silencio.
async function seguir(url) {
  const saltos = [];
  let actual = url;
  for (let i = 0; i < MAX_HOPS; i++) {
    const res = await fetch(actual, {
      redirect: "manual",
      headers: { "user-agent": "room714-slug-audit" },
    });
    if (res.status >= 300 && res.status < 400) {
      const destino = res.headers.get("location");
      if (!destino) return { saltos, status: res.status, url: actual, html: "" };
      saltos.push({ desde: actual, status: res.status, hacia: destino });
      actual = new URL(destino, actual).toString();
      continue;
    }
    const html = res.ok ? await res.text() : "";
    return { saltos, status: res.status, url: actual, html };
  }
  return { saltos, status: 310, url: actual, html: "" }; // demasiados saltos
}

async function enLotes(items, limite, tarea) {
  const salida = [];
  let cursor = 0;
  const obreros = Array.from({ length: Math.min(limite, items.length) }, async () => {
    while (cursor < items.length) {
      const i = cursor++;
      salida[i] = await tarea(items[i], i);
    }
  });
  await Promise.all(obreros);
  return salida;
}

// ─── 1. URLs de artículo del sitemap ────────────────────────────────────────

async function urlsDelSitemap() {
  const res = await fetch(`${BASE}/sitemap.xml`, {
    headers: { "user-agent": "room714-slug-audit" },
  });
  if (!res.ok) throw new Error(`sitemap.xml devolvió ${res.status}`);
  const xml = await res.text();
  const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1].trim());

  return locs
    .map((loc) => {
      const { pathname } = new URL(loc);
      // /es/blog/<slug> sí; /es/blog y /es/blog/category/<slug> no.
      const m = pathname.match(/^\/(es|en)\/blog\/(?!category\/)([^/]+)\/?$/);
      if (!m) return null;
      // El sitemap siempre anuncia el dominio de producción. Para poder
      // auditar una rama en local hay que quedarse con la RUTA y colgarla del
      // --base indicado; si no, --base solo cambiaría de dónde se lee el
      // sitemap y las 132 peticiones seguirían yendo a producción.
      return {
        url: `${BASE}${pathname}`,
        anunciada: loc,
        lang: m[1],
        slug: decodeURIComponent(m[2]),
      };
    })
    .filter(Boolean);
}

// ─── 2. La verdad: lo que dice la base de datos ─────────────────────────────

async function esperadoPorSlug(prisma) {
  const traducciones = await prisma.postTranslation.findMany({
    select: {
      slug: true,
      lang: true,
      title: true,
      postId: true,
      post: { select: { published: true, date: true } },
    },
  });
  const mapa = new Map();
  for (const t of traducciones) {
    mapa.set(`${t.lang}|${t.slug}`, {
      title: t.title,
      postId: t.postId,
      published: t.post.published,
      date: t.post.date,
    });
  }

  const redirecciones = await prisma.postRedirect.findMany({
    select: { fromSlug: true, lang: true, toSlug: true, reason: true },
  });
  const redir = new Map(redirecciones.map((r) => [`${r.lang}|${r.fromSlug}`, r]));

  return { mapa, redir };
}

// ─── 3. Comparación ─────────────────────────────────────────────────────────

function revisar({ entrada, respuesta, esperado, redireccion }) {
  const problemas = [];

  if (redireccion) {
    problemas.push(
      `el sitemap anuncia un slug que la tabla PostRedirect manda a "${redireccion.toSlug ?? "(404)"}" (${redireccion.reason})`,
    );
  }
  if (respuesta.saltos.length > 0) {
    const cadena = respuesta.saltos
      .map((s) => `${s.status}→${new URL(s.hacia, s.desde).pathname}`)
      .join(" ");
    problemas.push(`redirige: ${cadena}`);
  }
  if (respuesta.status !== 200) {
    problemas.push(`HTTP ${respuesta.status}`);
  }

  const h1 = respuesta.html ? extraer(respuesta.html, "h1") : null;
  const titleTag = respuesta.html ? extraer(respuesta.html, "title") : null;

  if (!esperado) {
    problemas.push("no hay ninguna traducción con ese slug en la base de datos");
  } else if (respuesta.status === 200) {
    if (!h1) {
      problemas.push("la página no trae ningún <h1>");
    } else if (normalizar(h1) !== normalizar(esperado.title)) {
      problemas.push(
        `el H1 no es el del slug — esperado "${esperado.title}", servido "${normalizar(h1).slice(0, 90)}"`,
      );
    }
    if (titleTag && esperado && !normalizar(titleTag).startsWith(normalizar(esperado.title))) {
      problemas.push(`el <title> tampoco cuadra: "${titleTag.trim().slice(0, 90)}"`);
    }
    if (esperado && !esperado.published) {
      problemas.push("el post no está publicado y sin embargo responde 200");
    }
  }

  return {
    ...entrada,
    status: respuesta.status,
    saltos: respuesta.saltos.length,
    esperado: esperado?.title ?? null,
    servido: h1 ? normalizar(h1) : null,
    problemas,
  };
}

// ─── Programa ───────────────────────────────────────────────────────────────

async function main() {
  const prisma = new PrismaClient();
  try {
    const entradas = await urlsDelSitemap();
    if (!AS_JSON) {
      console.log(`Base:    ${BASE}`);
      console.log(`Sitemap: ${entradas.length} URLs de artículo\n`);
    }

    const { mapa, redir } = await esperadoPorSlug(prisma);

    const filas = await enLotes(entradas, CONCURRENCY, async (entrada) => {
      const clave = `${entrada.lang}|${entrada.slug}`;
      try {
        const respuesta = await seguir(entrada.url);
        return revisar({
          entrada,
          respuesta,
          esperado: mapa.get(clave),
          redireccion: redir.get(clave),
        });
      } catch (error) {
        return { ...entrada, status: 0, saltos: 0, problemas: [`error de red: ${error.message}`] };
      }
    });

    const malas = filas.filter((f) => f.problemas.length > 0);

    if (AS_JSON) {
      console.log(JSON.stringify({ base: BASE, total: filas.length, discrepancias: malas }, null, 2));
    } else if (malas.length === 0) {
      console.log(`✓ ${filas.length} URLs revisadas, cero discrepancias.`);
    } else {
      console.log(`✗ ${malas.length} discrepancias de ${filas.length} URLs:\n`);
      for (const f of malas) {
        console.log(`  ${f.lang}/blog/${f.slug}`);
        for (const p of f.problemas) console.log(`      · ${p}`);
        console.log("");
      }
    }

    process.exitCode = malas.length > 0 ? 1 : 0;
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
