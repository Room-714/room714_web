// Ofertas de empleo publicadas. Cada una tiene su página (la ruta vive en
// app/lib/routes.mjs) y su posición en el enum CandidatePosition, que es la
// que el wizard manda al endpoint y la que decide los requisitos de la criba
// (app/lib/careers/criba.js).
//
// El texto es el de la oferta tal cual. El castellano manda: es el que se lee
// el resumen de IA del CV para valorar el encaje.

export const OFERTA_IA_DATA = {
  ruta: "ofertaIaData",
  position: "AI_DATA_SPECIALIST",
  datePosted: "2026-11-07",
  es: {
    titulo: "Especialista Senior en IA y Data",
    seo: {
      title: "Empleo: Especialista Senior en IA y Data | Room 714",
      description:
        "Buscamos un/a Senior AI & Data Specialist en España: ML, IA generativa (LLMs, RAG, agentes), pipelines de datos y MLOps. Mínimo 3 años de experiencia. Envía tu CV.",
    },
    entradilla:
      "Buscamos un/a Senior AI & Data Specialist para trabajar la estrategia, diseño e implementación de soluciones basadas en Inteligencia Artificial y analítica de datos. El objetivo es identificar oportunidades, optimizar procesos e impulsar la cultura data-driven, de modo que el dato sea la solución a un problema de negocio.",
    secciones: [
      {
        titulo: "Funciones y responsabilidades",
        puntos: [
          ["Estrategia y arquitectura de IA/Data", "diseñar y validar arquitecturas de datos e IA escalables y seguras, alineadas con las necesidades del negocio."],
          ["Desarrollo de soluciones de IA", "implementar modelos de Machine Learning, Deep Learning e Inteligencia Artificial Generativa como LLMs, RAG o agentes conversacionales."],
          ["Gestión y pipeline de datos", "supervisar y optimizar flujos de datos (ETL/ELT), asegurando la calidad, gobernanza y disponibilidad del dato para análisis e inferencia."],
          ["Evaluación y selección tecnológica", "investigar, proponer y adoptar nuevas herramientas, frameworks y proveedores del ecosistema de IA y Data."],
          ["Experiencia técnica", "mantener buenas prácticas de ingeniería de software, MLOps y CI/CD para datos."],
        ],
      },
      {
        titulo: "Requisitos del perfil",
        puntos: [
          ["Formación universitaria", "en Ingeniería Informática, Matemáticas, Estadística o similares, y experiencia mínima de 3 años en roles de Data Science, Machine Learning Engineering o desarrollo de soluciones de IA en entornos de producción."],
          ["Python", "dominio del lenguaje y de sus librerías de datos e IA (pandas, NumPy, scikit-learn, PyTorch o TensorFlow)."],
          ["Bases de datos", "sólidos conocimientos en bases de datos SQL (PostgreSQL, MySQL) y NoSQL, así como conceptos de Data Warehousing (Snowflake, BigQuery, Redshift)."],
          ["IA generativa y LLMs", "experiencia práctica en integración de APIs de IA (OpenAI, Anthropic, Hugging Face, etc.), arquitecturas RAG, bases de datos vectoriales y frameworks."],
          ["Cloud y MLOps", "experiencia con al menos una plataforma cloud (AWS, GCP o Azure) y herramientas de MLOps."],
          ["Control de versiones", "manejo fluido de Git."],
        ],
      },
      {
        titulo: "Soft skills",
        puntos: [
          [null, "Capacidad de comunicación técnica y no técnica."],
          [null, "Pensamiento analítico, visión crítica y orientación a la resolución de problemas."],
          [null, "Proactividad y capacidad de priorizar en diversos proyectos dinámicos."],
        ],
      },
    ],
    aplicar: "Inscríbete",
    aplicarLead:
      "Tres preguntas rápidas y tu CV en PDF. Lo lee una persona del equipo, con ayuda de una IA.",
  },
  en: {
    titulo: "Senior AI & Data Specialist",
    seo: {
      title: "Job: Senior AI & Data Specialist | Room 714",
      description:
        "We're hiring a Senior AI & Data Specialist based in Spain: ML, generative AI (LLMs, RAG, agents), data pipelines and MLOps. 3+ years of experience. Send us your CV.",
    },
    entradilla:
      "We're looking for a Senior AI & Data Specialist to own the strategy, design and implementation of solutions built on Artificial Intelligence and data analytics. The goal is to spot opportunities, optimise processes and drive a data-driven culture, so that data becomes the answer to a business problem.",
    secciones: [
      {
        titulo: "Role and responsibilities",
        puntos: [
          ["AI/Data strategy and architecture", "design and validate scalable, secure data and AI architectures aligned with business needs."],
          ["AI solution development", "build Machine Learning, Deep Learning and Generative AI solutions such as LLMs, RAG or conversational agents."],
          ["Data management and pipelines", "oversee and optimise data flows (ETL/ELT), ensuring data quality, governance and availability for analysis and inference."],
          ["Technology evaluation and selection", "research, propose and adopt new tools, frameworks and vendors from the AI and Data ecosystem."],
          ["Engineering practice", "uphold good software engineering, MLOps and CI/CD-for-data practices."],
        ],
      },
      {
        titulo: "What we're looking for",
        puntos: [
          ["University degree", "in Computer Engineering, Mathematics, Statistics or similar, and at least 3 years in Data Science, Machine Learning Engineering or AI solution development roles in production environments."],
          ["Python", "fluency in the language and its data and AI libraries (pandas, NumPy, scikit-learn, PyTorch or TensorFlow)."],
          ["Databases", "solid knowledge of SQL (PostgreSQL, MySQL) and NoSQL databases, plus Data Warehousing concepts (Snowflake, BigQuery, Redshift)."],
          ["Generative AI and LLMs", "hands-on experience integrating AI APIs (OpenAI, Anthropic, Hugging Face, etc.), RAG architectures, vector databases and frameworks."],
          ["Cloud and MLOps", "experience with at least one cloud platform (AWS, GCP or Azure) and MLOps tooling."],
          ["Version control", "fluent with Git."],
        ],
      },
      {
        titulo: "Soft skills",
        puntos: [
          [null, "Able to communicate with technical and non-technical audiences."],
          [null, "Analytical thinking, a critical eye and a problem-solving mindset."],
          [null, "Proactive, and able to prioritise across several fast-moving projects."],
        ],
      },
    ],
    aplicar: "Apply",
    aplicarLead:
      "Three quick questions and your CV as a PDF. A person on the team reads it, with help from an AI.",
  },
};

/** El texto plano de la oferta, para dárselo al resumen de IA del CV. */
export function textoOferta(oferta = OFERTA_IA_DATA) {
  const t = oferta.es;
  const lineas = [t.titulo, "", t.entradilla];
  for (const s of t.secciones) {
    lineas.push("", `${s.titulo}:`);
    for (const [rotulo, texto] of s.puntos) {
      lineas.push(`- ${rotulo ? `${rotulo}: ` : ""}${texto}`);
    }
  }
  return lineas.join("\n");
}

/** Las ofertas por posición, para quien recibe solo la posición. */
export const OFERTAS_POR_POSICION = {
  [OFERTA_IA_DATA.position]: OFERTA_IA_DATA,
};
