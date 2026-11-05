// Corpus de posts existentes y detección de temas duplicados para el
// generador de posts.
//
// En octubre de 2026 el generador escribió cuatro posts casi iguales sobre
// "diferencia entre diseño de producto y diseño UX" en cuatro miércoles
// seguidos: la búsqueda objetivo solo se daba por cubierta si un TÍTULO
// contenía todas sus palabras, y ninguno decía "diferencia" (el slug sí).
// Aquí vive lo que lo evita:
//
// - cargarCorpus: UNA sola consulta (publicados, programados y borradores)
//   que alimenta todo lo demás. La BD de producción se ha quedado sin
//   conexiones otras veces, así que el generador no hace otra lectura.
// - buscarParecidos: comparación léxica del tema propuesto contra títulos,
//   metaTitle y slugs, con términos clave normalizados y pesados por rareza.
// - metasRepetidas: metaTitle y metaDescription que ya usa otro post.
//
// Todo menos cargarCorpus es puro, para poder probarlo sin base de datos.

import { prisma } from "@/app/lib/prisma";

const VACIAS = new Set(
  [
    // Español
    "a al algo ante antes como con cual cuales cuando cuanto cuanta de del desde donde el ella ellos en entre era es esa ese eso esta este esto estos hay la las le les lo los mas me mi mis muy no nos o para pero por porque que quien se sea segun ser si sin sobre son su sus tan te tiene tu tus un una uno unos unas ya y",
    // Inglés
    "a an and are as at be before but by can do does for from has have how if in into is it its not of on or so than that the their them then there these they this to too vs was what when where which who why will with without you your",
  ]
    .join(" ")
    .split(" "),
);

/** Minúsculas, sin acentos y sin signos: "¿Diseño UX?" → "diseno ux". */
export function normalizar(texto) {
  return String(texto || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

// Raíz tosca para que el singular y el plural cuenten igual, la misma que
// usa busquedasObjetivo.js ("productos" → "producto", "errores" → "error").
const raiz = (p) => (p.length > 4 ? p.replace(/(es|s)$/, "") : p);

/** Términos clave de un texto o un slug, sin repetir y sin palabras vacías. */
export function terminosClave(texto) {
  return [
    ...new Set(
      normalizar(texto)
        .split(" ")
        .filter((p) => p && !VACIAS.has(p))
        .map(raiz),
    ),
  ];
}

/** Estado de un post en el panel: publicado, programado o borrador. */
export function estadoDe(post, ahora = new Date()) {
  if (!post.published) return "borrador";
  return new Date(post.date) <= ahora ? "publicado" : "programado";
}

/**
 * Agrupa las filas de la consulta (una por traducción) en posts con sus dos
 * idiomas. Exportada para probarla con filas inventadas.
 */
export function agruparFilas(filas) {
  const porId = new Map();
  for (const f of filas) {
    let post = porId.get(f.id);
    if (!post) {
      post = {
        id: f.id,
        date: new Date(f.date),
        createdAt: new Date(f.createdAt),
        category: f.category,
        published: f.published,
        es: null,
        en: null,
      };
      porId.set(f.id, post);
    }
    if (f.lang === "es" || f.lang === "en") {
      post[f.lang] = {
        slug: f.slug,
        title: f.title,
        metaTitle: f.metaTitle ?? null,
        metaDescription: f.metaDescription ?? null,
        tags: f.tags ?? [],
      };
    }
  }
  return [...porId.values()];
}

/**
 * La única lectura de la BD del generador: título, metaTitle, metaDescription,
 * slug y tags de cada traducción de cada post (publicado, programado o
 * borrador), sin el `content`, que es el campo pesado. Un JOIN en una sola
 * sentencia SQL, con el cliente de Prisma que ya existe.
 */
export async function cargarCorpus() {
  const filas = await prisma.$queryRaw`
    SELECT p."id", p."date", p."createdAt", p."category"::text AS "category",
           p."published", t."lang", t."slug", t."title", t."metaTitle",
           t."metaDescription", t."tags"
    FROM "Post" p
    JOIN "PostTranslation" t ON t."postId" = p."id"
    ORDER BY p."date" DESC, p."id" DESC`;
  return agruparFilas(filas);
}

const fecha = (d) => new Date(d).toISOString().split("T")[0];

/**
 * Los títulos existentes, para el prompt del generador y del planificador.
 * Misma forma que devolvía getPublishedTitles, más el estado: ahora entran
 * también los programados y los borradores, que también se pisan.
 */
export function titulosExistentes(corpus, ahora = new Date()) {
  return corpus.map((p) => ({
    id: p.id,
    estado: estadoDe(p, ahora),
    date: fecha(p.date),
    category: p.category,
    title_es: p.es?.title ?? null,
    title_en: p.en?.title ?? null,
    metaTitle_es: p.es?.metaTitle ?? null,
    slug_es: p.es?.slug ?? null,
    tags: p.es?.tags ?? p.en?.tags ?? [],
  }));
}

/**
 * Los últimos posts creados, con la forma que devolvía getRecentPosts: el
 * generador los usa para el enlazado interno y para validar sus slugs.
 */
export function postsRecientes(corpus, limite = 10) {
  return [...corpus]
    .sort((a, b) => b.createdAt - a.createdAt || b.id - a.id)
    .slice(0, limite)
    .map((p) => ({
      date: fecha(p.date),
      category: p.category,
      title: p.es?.title ?? p.en?.title ?? "(sin título)",
      tags: p.es?.tags ?? [],
      slug_es: p.es?.slug ?? null,
      slug_en: p.en?.slug ?? null,
    }));
}

/** Todos los slugs ocupados (el slug es único en toda la tabla, no por idioma). */
export function slugsOcupados(corpus) {
  const set = new Set();
  for (const p of corpus) {
    if (p.es?.slug) set.add(p.es.slug);
    if (p.en?.slug) set.add(p.en.slug);
  }
  return set;
}

/** El slug, o el slug con -2, -3… si ya está ocupado. Sin consultas. */
export function slugUnico(slug, ocupados) {
  let candidato = slug;
  for (let i = 2; ocupados.has(candidato); i += 1) {
    if (i > 50) throw new Error(`No se pudo generar slug único para ${slug}`);
    candidato = `${slug}-${i}`;
  }
  return candidato;
}

/** Peso de cada término según lo raro que es en el corpus de ese idioma. */
function pesosPorRareza(corpus, lang) {
  const df = new Map();
  let n = 0;
  for (const p of corpus) {
    const t = p[lang];
    if (!t) continue;
    n += 1;
    const terminos = new Set([
      ...terminosClave(t.title),
      ...terminosClave(t.metaTitle),
      ...terminosClave(t.slug),
    ]);
    for (const termino of terminos) df.set(termino, (df.get(termino) ?? 0) + 1);
  }
  // "producto" o "digital" salen en medio blog y casi no distinguen; un
  // término que solo usan dos posts ("diferencia") pesa mucho más. El +1
  // final evita que un término muy común pese cero.
  return (termino) => Math.log((n + 1) / ((df.get(termino) ?? 0) + 1)) + 1;
}

/**
 * A partir de esta cobertura pesada del tema, el post se considera el mismo
 * tema. Calibrado con los títulos reales del blog: 0,7 marca "cómo validar
 * una idea de producto digital" frente a "Validar una idea de producto antes
 * de construir" (0,72) y deja pasar "errores al lanzar un producto digital"
 * frente a "El Error de Diseño que Arruina Productos Digitales" (0,67). Lo
 * que solo se parece en el fondo, con otras palabras, lo caza la comprobación
 * semántica del planificador, no esta.
 */
export const UMBRAL_PARECIDO = 0.7;

/**
 * Posts existentes que cubren el tema propuesto, de más a menos parecido.
 *
 * Para cada post se mira cada campo por separado (título, metaTitle, slug)
 * y en el idioma del tema: qué parte de los términos clave del tema aparece
 * en ese campo, pesando cada término por su rareza. Mirar los campos sueltos
 * y no juntos evita que título y metaTitle sumen entre los dos un parecido
 * que ninguno tiene.
 *
 * `tema` es { es, en }; cualquiera de los dos puede faltar.
 */
export function buscarParecidos(tema, corpus, { umbral = UMBRAL_PARECIDO } = {}) {
  const resultados = [];
  for (const lang of ["es", "en"]) {
    const terminosTema = terminosClave(tema?.[lang]);
    if (terminosTema.length < 2) continue;
    const peso = pesosPorRareza(corpus, lang);
    const total = terminosTema.reduce((s, t) => s + peso(t), 0);

    for (const post of corpus) {
      const traduccion = post[lang];
      if (!traduccion) continue;
      for (const campo of ["title", "metaTitle", "slug"]) {
        const delCampo = new Set(terminosClave(traduccion[campo]));
        const comunes = terminosTema.filter((t) => delCampo.has(t));
        if (comunes.length < 2) continue;
        const puntuacion = comunes.reduce((s, t) => s + peso(t), 0) / total;
        if (puntuacion >= umbral) {
          resultados.push({ post, lang, campo, puntuacion, comunes });
        }
      }
    }
  }

  // Un post aparece una vez, con su campo más parecido.
  const mejorPorPost = new Map();
  for (const r of resultados) {
    const previo = mejorPorPost.get(r.post.id);
    if (!previo || r.puntuacion > previo.puntuacion) mejorPorPost.set(r.post.id, r);
  }
  // A igual parecido, primero el publicado y, entre publicados, el más
  // antiguo: es el original, al que se habrán redirigido las copias (los
  // duplicados de octubre siguen en la BD con su slug, que también coincide).
  const rango = (p) => (p.published ? 0 : 1);
  return [...mejorPorPost.values()].sort(
    (a, b) =>
      b.puntuacion - a.puntuacion ||
      rango(a.post) - rango(b.post) ||
      a.post.date - b.post.date,
  );
}

/** Lo que el panel necesita para enseñar un post existente en el aviso. */
export function resumenPost(post, ahora = new Date()) {
  const estado = estadoDe(post, ahora);
  const slug = post.es?.slug ?? post.en?.slug ?? null;
  const lang = post.es?.slug ? "es" : "en";
  return {
    id: post.id,
    estado,
    title: post.es?.title ?? post.en?.title ?? "(sin título)",
    slug,
    // Solo un post en vivo tiene URL pública; los demás se abren en el editor.
    url: estado === "publicado" && slug ? `/${lang}/blog/${slug}` : null,
  };
}

/** Para comparar metadatos: normalizado y con los espacios colapsados. */
const clave = (texto) => normalizar(texto).replace(/\s+/g, " ");

/**
 * Los metaTitle y metaDescription del borrador que ya usa algún post
 * existente (en cualquier idioma). Vacío = se puede guardar.
 */
export function metasRepetidas(borrador, corpus) {
  const usados = { metaTitle: new Map(), metaDescription: new Map() };
  for (const p of corpus) {
    for (const lang of ["es", "en"]) {
      for (const campo of ["metaTitle", "metaDescription"]) {
        const valor = p[lang]?.[campo];
        if (valor && clave(valor)) usados[campo].set(clave(valor), p.id);
      }
    }
  }

  const repetidas = [];
  for (const lang of ["es", "en"]) {
    for (const [campoBorrador, campo] of [
      [`meta_title_${lang}`, "metaTitle"],
      [`meta_description_${lang}`, "metaDescription"],
    ]) {
      const valor = borrador[campoBorrador];
      if (!valor || !clave(valor)) continue;
      const postId = usados[campo].get(clave(valor));
      if (postId !== undefined) repetidas.push({ campo: campoBorrador, valor, postId });
    }
  }
  return repetidas;
}
