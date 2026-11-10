// Ofertas de empleo publicadas. Cada una tiene su página (la ruta vive en
// app/lib/routes.mjs) y su posición en el enum CandidatePosition, que es la
// que el chat manda al endpoint (app/api/careers/oferta).
//
// El texto es el de la oferta tal cual. El castellano manda: es el que leen
// la criba de las respuestas del chat y el resumen de IA del CV.
//
// Cada sección lleva `puntos` (lista) o `enLinea` (elementos cortos que se
// pintan en una sola línea separados por «·»).

export const OFERTA_IA_DATA = {
  ruta: "ofertaIaData",
  position: "AI_DATA_SPECIALIST",
  // JobPosting de Google Empleos.
  datePosted: "2026-11-10",
  validThrough: "2027-01-09", // datePosted + 60 días
  employmentType: "FULL_TIME",
  es: {
    titulo: "Especialista en IA y Data",
    condiciones:
      "100% remoto (España) · Jornada completa · Salario según valía del candidato/a",
    seo: {
      title: "Empleo: Especialista en IA y Data (remoto) | Room 714",
      description:
        "Únete a Room 714 como Especialista en IA y Data, 100% remoto en España. Machine Learning, IA generativa (LLMs, RAG, agentes) y pipelines de datos en producción.",
    },
    entradilla:
      "Buscamos a alguien que ya haya llevado algún proyecto de IA o datos más allá del notebook y quiera crecer construyendo soluciones que se usan de verdad. Trabajarás en proyectos de producto digital para empresas, donde el dato y la IA resuelven problemas de negocio concretos.",
    secciones: [
      {
        titulo: "Qué harás",
        puntos: [
          "Desarrollar soluciones con Machine Learning e IA generativa (LLMs, RAG, agentes).",
          "Construir y mejorar pipelines de datos (ETL/ELT), cuidando la calidad y disponibilidad del dato.",
          "Participar en el diseño de arquitecturas de datos e IA junto al equipo.",
          "Probar y proponer nuevas herramientas y frameworks del ecosistema IA/Data.",
          "Trabajar con buenas prácticas de ingeniería: Git, testing, CI/CD.",
        ],
      },
      {
        titulo: "Qué buscamos",
        puntos: [
          "Formación en Ingeniería Informática, Matemáticas, Estadística o similar.",
          "2-4 años de experiencia en Data Science, ML Engineering o desarrollo de soluciones de IA.",
          "Buen nivel de Python y su ecosistema de datos (pandas, NumPy, scikit-learn).",
          "SQL con soltura (PostgreSQL, MySQL).",
          "Experiencia práctica con APIs de IA (OpenAI, Anthropic, Hugging Face) y arquitecturas RAG.",
          "Experiencia básica con al menos una plataforma cloud (AWS, GCP o Azure).",
          "Manejo de Git.",
          "Capacidad para explicar lo técnico a perfiles no técnicos.",
        ],
      },
      {
        titulo: "Valorable",
        enLinea: [
          "PyTorch o TensorFlow",
          "bases de datos vectoriales",
          "NoSQL",
          "BigQuery, Snowflake o Redshift",
          "herramientas de MLOps",
        ],
      },
      {
        titulo: "Qué ofrecemos",
        puntos: [
          "Salario según valía del candidato/a.",
          "100% remoto desde cualquier punto de España.",
          "Proyectos reales de IA en producción, no pilotos que se quedan en demo.",
          "Un equipo pequeño donde trabajas directamente con quien decide y aprendes rápido.",
          "Recorrido para crecer hacia un rol senior.",
        ],
      },
    ],
    postular: {
      titulo: "Cómo postular",
      texto: "Rellena el formulario de candidatura de esta página.",
    },
    cta: "Postular a esta oferta",
  },
  en: {
    titulo: "AI & Data Specialist",
    condiciones:
      "100% remote (Spain) · Full-time · Salary based on the candidate’s experience and skills",
    seo: {
      title: "Job: AI & Data Specialist (remote) | Room 714",
      description:
        "Join Room 714 as an AI & Data Specialist, 100% remote from Spain. Machine Learning, generative AI (LLMs, RAG, agents) and data pipelines in production.",
    },
    entradilla:
      "We're looking for someone who has already taken an AI or data project beyond the notebook and wants to grow by building solutions that people actually use. You'll work on digital product projects for companies, where data and AI solve concrete business problems.",
    secciones: [
      {
        titulo: "What you'll do",
        puntos: [
          "Build solutions with Machine Learning and generative AI (LLMs, RAG, agents).",
          "Build and improve data pipelines (ETL/ELT), looking after data quality and availability.",
          "Take part in designing data and AI architectures with the team.",
          "Try out and propose new tools and frameworks from the AI/Data ecosystem.",
          "Work with good engineering practices: Git, testing, CI/CD.",
        ],
      },
      {
        titulo: "What we're looking for",
        puntos: [
          "A background in Computer Engineering, Mathematics, Statistics or similar.",
          "2-4 years of experience in Data Science, ML Engineering or building AI solutions.",
          "Good Python and its data ecosystem (pandas, NumPy, scikit-learn).",
          "Comfortable with SQL (PostgreSQL, MySQL).",
          "Hands-on experience with AI APIs (OpenAI, Anthropic, Hugging Face) and RAG architectures.",
          "Basic experience with at least one cloud platform (AWS, GCP or Azure).",
          "Git.",
          "Able to explain technical topics to non-technical people.",
        ],
      },
      {
        titulo: "Nice to have",
        enLinea: [
          "PyTorch or TensorFlow",
          "vector databases",
          "NoSQL",
          "BigQuery, Snowflake or Redshift",
          "MLOps tooling",
        ],
      },
      {
        titulo: "What we offer",
        puntos: [
          "Salary based on the candidate’s experience and skills.",
          "100% remote from anywhere in Spain.",
          "Real AI projects in production, not pilots that never get past the demo.",
          "A small team where you work directly with the people who decide, and learn fast.",
          "A path to grow into a senior role.",
        ],
      },
    ],
    postular: {
      titulo: "How to apply",
      texto: "Fill in the application form on this page.",
    },
    cta: "Apply for this role",
  },
};

/** El texto plano de la oferta (castellano), para la criba y el resumen IA. */
export function textoOferta(oferta = OFERTA_IA_DATA) {
  const t = oferta.es;
  const lineas = [t.titulo, t.condiciones, "", t.entradilla];
  for (const s of t.secciones) {
    lineas.push("", `${s.titulo}:`);
    if (s.enLinea) lineas.push(s.enLinea.join(" · "));
    for (const p of s.puntos ?? []) lineas.push(`- ${p}`);
  }
  return lineas.join("\n");
}

/** Las ofertas por posición, para quien recibe solo la posición. */
export const OFERTAS_POR_POSICION = {
  [OFERTA_IA_DATA.position]: OFERTA_IA_DATA,
};
