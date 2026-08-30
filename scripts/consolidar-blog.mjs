// Consolidación del blog: 34 artículos cortos que se canibalizan entre sí
// redirigen al artículo que mejor cubre su tema.
//
// Script de un solo uso. Se borra al terminar: el registro permanente de qué se
// fusionó y por qué es la spec, en
// docs/superpowers/specs/2026-08-30-consolidacion-blog-design.md
//
// Dos fases. Sin argumentos hace una simulación y no escribe nada; con
// --aplicar escribe. La simulación no es una cortesía: es el único sitio donde
// se ve, antes de tocar producción, que los 52 slugs existen y que ningún
// origen es destino de otro.
//
//   node --env-file=.env.local scripts/consolidar-blog.mjs
//   node --env-file=.env.local scripts/consolidar-blog.mjs --aplicar
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const APLICAR = process.argv.includes("--aplicar");

// El mapa, en slugs españoles. Las contrapartidas inglesas se resuelven solas a
// través del Post, que es el que une las dos traducciones: escribirlas a mano
// sería una segunda lista que mantener sincronizada y una segunda oportunidad
// de equivocarse.
const MAPA = [
  // Grupos con un artículo largo que ya cubre el tema
  ["codigo-barato-ingenieria-cara-ia-deuda-tecnica", [
    "ingenieria-de-precision-no-fabricas-de-codigo",
    "tu-codigo-es-un-activo-o-una-deuda-pendiente",
  ]],
  ["seguridad-arquitecturas-ia-el-agujero-que-nadie-audita", [
    "product-led-governance-la-seguridad-como-feature-no-como-freno",
    "seguridad-en-ia-el-neutron-que-tumba-la-muralla",
  ]],
  ["rag-no-es-magia-como-elegir-arquitectura-de-recuperacion", [
    "data-flywheels-el-motor-secreto-de-la-ia",
    "graphrag-de-la-busqueda-de-textos-a-la-comprension-de-relaciones",
    "el-modelo-canonico-que-no-alucine-tu-ia",
  ]],
  ["accesibilidad-no-es-una-feature-es-infraestructura", [
    "accesibilidad-el-requisito-que-nadie-pone-en-el-roadmap",
  ]],

  // Grupos huérfanos: gana el mejor del grupo
  ["la-friccion-es-un-impuesto-al-beneficio", [
    "aplicando-el-factor-sentidino",
    "menos-manuales-mas-sentido-comun",
    "tu-software-es-una-ayuda-o-un-obstaculo-diario",
  ]],
  ["el-equilibrio-vital-entre-estetica-y-usabilidad", [
    "si-no-vende-no-es-diseno-es-decoracion",
    "estetica-que-factura",
    "tu-interfaz-esta-devaluando-tu-servicio",
  ]],
  ["local-first-la-arquitectura-que-le-devuelve-el-control-a-tu-producto", [
    "invertir-en-un-mundo-que-caduca-cada-martes",
    "el-efecto-google-por-que-tu-ram-ahora-vale-el-doble",
    "tu-equipo-de-desarrollo-necesita-una-ia-local",
    "el-retorno-del-hierro-la-resurreccion-del-co-location",
    "eficiencia-sobre-gigantismo-por-que-el-futuro-de-tu-empresa-es-small",
  ]],
  ["ui-generativa-cuando-la-interfaz-deja-de-ser-un-plano", [
    "interfaces-que-piensan-en-voz-alta-el-reto-de-disenar-para-agentes-de-ia",
    "diseno-en-streaming-cuando-la-interfaz-tiene-que-pensar-y-moverse-a-la-vez",
  ]],
  ["anticipatory-ux-eliminando-la-carga-de-decision", [
    "ni-codigo-ni-diseno-el-producto-es-anticipacion",
    "la-mejor-interfaz-es-la-que-no-existe-el-paso-hacia-la-invisible-ui",
  ]],
  ["el-sindrome-de-la-herramienta-nueva-probar-todo-te-impide-construir", [
    "shadow-it-y-el-renacimiento-del-cpo",
    "el-fin-de-la-ia-por-decreto",
  ]],
  ["construir-antes-de-validar-el-error-de-producto-que-destruye-startups", [
    "volviendo-a-las-bases-el-ceo-del-producto",
    "el-minimum-lovable-product-mlp",
  ]],
  ["la-ia-no-se-cansa-en-el-kilometro-42", ["la-ia-no-tiene-nervios"]],
  ["de-programadores-de-sintaxis-a-ingenieros-de-flujos", ["el-colapso-de-la-factoria"]],
  ["unbundling-el-poder-de-la-especializacion", ["ia-unbundling-microservicios-de-proposito-unico"]],
  ["estas-sentado-en-una-mina-de-oro", ["el-techo-de-cristal-de-tu-escalabilidad"]],
  ["el-clasismo-del-software-el-cliente-gana-al-empleado", ["el-asesino-silencioso-de-la-productividad"]],
  ["el-prototipo-que-miente-por-que-tus-tests-de-usabilidad-estan-contaminados", ["la-cura-contra-el-ego-del-disenador"]],
  ["disenadores-en-la-era-de-la-ia-el-juicio-no-se-automatiza", ["ux-2026-del-hacer-pantallas-al-decidir-experiencias"]],
];

// ─── Validación ─────────────────────────────────────────────────────────────
// Se ejecuta siempre, también en simulación, y aborta si algo no cuadra. Es
// preferible no hacer nada a hacer la mitad.

function validarMapa() {
  const problemas = [];
  const destinos = MAPA.map(([d]) => d);
  const origenes = MAPA.flatMap(([, o]) => o);

  // Un origen que además es destino crearía una cadena de redirecciones, y
  // Google deja de seguirlas a partir de unos pocos saltos.
  const cadenas = origenes.filter((o) => destinos.includes(o));
  if (cadenas.length) problemas.push(`encadenamiento: ${cadenas.join(", ")}`);

  // Un origen repetido en dos grupos dejaría la última escritura ganando en
  // silencio, y el artículo acabaría redirigiendo a donde no toca.
  const repetidos = origenes.filter((o, i) => origenes.indexOf(o) !== i);
  if (repetidos.length) problemas.push(`origen repetido: ${[...new Set(repetidos)].join(", ")}`);

  const destRepes = destinos.filter((d, i) => destinos.indexOf(d) !== i);
  if (destRepes.length) problemas.push(`destino repetido: ${[...new Set(destRepes)].join(", ")}`);

  return problemas;
}

async function resolver(slug) {
  return prisma.postTranslation.findUnique({
    where: { slug },
    include: { post: { include: { translations: true } } },
  });
}

async function main() {
  const problemas = validarMapa();
  if (problemas.length) {
    console.error("❌ El mapa no es válido, no se toca nada:");
    for (const p of problemas) console.error("   " + p);
    process.exit(1);
  }

  console.log(APLICAR ? "=== APLICANDO ===" : "=== SIMULACIÓN (no escribe nada) ===");
  console.log();

  const filas = [];
  let faltan = 0;

  for (const [destinoSlug, origenesSlugs] of MAPA) {
    const destino = await resolver(destinoSlug);
    if (!destino) {
      console.error(`❌ destino inexistente: ${destinoSlug}`);
      faltan++;
      continue;
    }
    const destinoEn = destino.post.translations.find((t) => t.lang === "en");
    if (!destinoEn) {
      console.error(`❌ el destino ${destinoSlug} no tiene traducción inglesa`);
      faltan++;
      continue;
    }

    console.log(`→ ${destinoSlug}`);
    for (const oSlug of origenesSlugs) {
      const origen = await resolver(oSlug);
      if (!origen) {
        console.error(`   ❌ origen inexistente: ${oSlug}`);
        faltan++;
        continue;
      }
      const origenEn = origen.post.translations.find((t) => t.lang === "en");
      if (!origenEn) {
        console.error(`   ❌ el origen ${oSlug} no tiene traducción inglesa`);
        faltan++;
        continue;
      }
      console.log(`   ← ${oSlug}`);
      console.log(`     en: ${origenEn.slug} → ${destinoEn.slug}`);
      filas.push(
        { fromSlug: origen.slug, toSlug: destino.slug, lang: "es", postId: origen.postId },
        { fromSlug: origenEn.slug, toSlug: destinoEn.slug, lang: "en", postId: origen.postId },
      );
    }
  }

  if (faltan) {
    console.error(`\n❌ ${faltan} slugs no resueltos. No se escribe nada.`);
    process.exit(1);
  }

  const postsADespublicar = [...new Set(filas.map((f) => f.postId))];

  console.log(`\n=== RESUMEN ===`);
  console.log(`redirecciones a crear: ${filas.length} (${filas.length / 2} por idioma)`);
  console.log(`artículos a despublicar: ${postsADespublicar.length}`);

  if (!APLICAR) {
    console.log("\nSimulación terminada. Nada escrito.");
    console.log("Para aplicar: node --env-file=.env.local scripts/consolidar-blog.mjs --aplicar");
    return;
  }

  // Primero las redirecciones y después despublicar, no al revés: si algo falla
  // en medio, queda una redirección sobre un artículo aún publicado, que es
  // inofensivo porque el chequeo de redirección corre antes de buscar el post.
  // Al revés quedarían 404.
  let creadas = 0;
  for (const f of filas) {
    await prisma.postRedirect.upsert({
      where: { fromSlug_lang: { fromSlug: f.fromSlug, lang: f.lang } },
      update: { toSlug: f.toSlug, reason: "consolidation" },
      create: { fromSlug: f.fromSlug, toSlug: f.toSlug, lang: f.lang, reason: "consolidation" },
    });
    creadas++;
  }
  console.log(`redirecciones escritas: ${creadas}`);

  const desp = await prisma.post.updateMany({
    where: { id: { in: postsADespublicar } },
    data: { published: false },
  });
  console.log(`artículos despublicados: ${desp.count}`);
}

await main();
await prisma.$disconnect();
