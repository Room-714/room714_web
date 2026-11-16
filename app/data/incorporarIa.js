// Landing de campaña «Incorporar la IA en tu empresa».
//
// Solo existe en castellano (la ruta vive en SOLO_ES de app/lib/routes.mjs),
// así que sus textos van aquí y no en los diccionarios, que son bilingües.
//
// Segunda versión (2026-11-16): página corta, centrada en el problema del
// riesgo y el descontrol, en cinco bloques. Textos aprobados por José
// Antonio; no se reescriben aquí.
//
// Tercera revisión (2026-11-16): Room 714 no vende formación en IA, ayuda a
// incorporar la IA en la empresa. Las sesiones con la plantilla son un medio
// dentro de ese programa, no el producto. Es UN solo programa: nada de esta
// página puede sugerir paquetes, niveles ni precio.
//
// Cuarta revisión (2026-11-16): un único objetivo, vender la colaboración.
// El inventario de IA queda aparcado: su componente y su lógica siguen en el
// repositorio, pero la página no lo muestra y su API está desactivada
// (app/api/_inventario-ia; quitar el guion bajo para reactivarla).

export const INCORPORAR_IA = {
  seo: {
    title: "Consultoría para incorporar la IA en tu empresa | Room 714",
    description:
      "Tus empleados usan la IA sin normas. Te ayudamos a incorporarla con orden: reglas por escrito, un equipo que sabe usarla y un plan con IT. En remoto.",
  },

  // Texto del enlace del footer.
  footer: "IA en tu empresa",

  hero: {
    antetitulo: "Incorporar la IA en tu empresa",
    titular: "Tus empleados ya usan la IA. Falta que tu empresa la controle.",
    subtitulo: "Sin normas, sin formación y sin nadie que lo controle.",
    texto:
      "En tres meses, Room 714 enseña a tu equipo a usarla bien y decide contigo y con IT dónde incorporarla en tus procesos.",
    cta: "Hablemos",
  },

  problema: {
    titulo: "Lo que ya está pasando en tu empresa, aunque nadie lo diga.",
    puntos: [
      "Cada uno usa la herramienta que le parece, muchas veces con su cuenta personal.",
      "Se pegan contratos, datos de clientes y documentos internos en chats que nadie ha aprobado.",
      "Si mañana hay una fuga, nadie sabría decir qué se subió ni dónde.",
    ],
    remate: "Prohibirla no sirve: se sigue usando, solo que a escondidas.",
  },

  // Los dos bloques de la oferta («Room 714 para Urgasa»): la plantilla y
  // la empresa (IT y dirección), en paralelo.
  frentes: {
    titulo:
      "Dos frentes a la vez. Lo que aprende tu equipo alimenta el plan de tu empresa.",
    bloques: [
      {
        titulo: "Tu equipo aprende a usarla sin miedo.",
        texto:
          "Cinco sesiones prácticas de dos horas, en remoto, con casos reales de su trabajo: documentos, datos, asistentes y agentes. En la última, cada persona resuelve con la IA un problema real suyo. No hace falta base técnica y no se para la actividad.",
        resultado:
          "Controlan las herramientas y ganan productividad, estén en el área que estén.",
      },
      {
        titulo: "Tu empresa decide dónde le aporta.",
        texto:
          "Primero, tu equipo de IT aprende a administrar el entorno corporativo de IA: licencias, accesos, conectores y auditoría. Después entrevistamos a IT y a las áreas, trazamos con dirección los caminos posibles y lo convertimos en un plan de proyectos por orden de prioridad, con resultados rápidos incluidos.",
        resultado:
          "En tres meses, un plan de acción claro para incorporar la IA en tus procesos.",
      },
    ],
  },

  queda: {
    titulo: "Al terminar, la IA deja de ser un riesgo y pasa a ser un plan.",
    puntos: [
      "Reglas de uso por escrito, que la plantilla conoce.",
      "Un equipo que la usa con criterio, con certificado de asistencia y la documentación que pide el artículo 4.",
      "Un equipo de IT que sabe administrar el entorno.",
      "Un plan de proyectos de IA ordenado por prioridad.",
    ],
  },

  cierre: {
    titulo: "Hablemos de tu caso.",
    texto:
      "Cuéntanos cómo se usa hoy la IA en tu empresa y te decimos por dónde empezaríamos.",
    // Resumen de la bio de «Quién está detrás» (about.quien del
    // diccionario): no añade nada que no esté ya publicado allí.
    quien: {
      nombre: "José Antonio Ces",
      cargo: "Fundador y CEO de Room 714",
      bio: "Ingeniero de Telecomunicación con más de treinta años en producto B2B: de Ericsson y Telefónica a fundar Room 714 en 2016. Ha sido consultor senior de transformación digital para empresas como LaLiga, GMV o MasOrange.",
    },
    // Etiqueta de la pregunta de texto libre del formulario en esta landing.
    pregunta: "¿Qué te preocupa?",
    empleados: {
      pregunta: "Número de empleados",
      opciones: ["Menos de 20", "De 20 a 50", "De 51 a 250", "Más de 250"],
    },
  },
};

/** Origen con el que se guarda cada contacto, en `Lead.origen`. */
export const ORIGENES = {
  hablemos: "hablemos",
  landing: "landing-ia-empresas",
  inventario: "inventario-ia",
};

/** Los dos documentos descargables, servidos desde public/descargas. */
export const DESCARGAS = {
  politica: {
    titulo: "Política de uso de la inteligencia artificial",
    pdf: "/descargas/politica-uso-ia-room714.pdf",
    docx: "/descargas/politica-uso-ia-room714.docx",
  },
  checklist: {
    titulo: "Alfabetización en IA: lista de comprobación del artículo 4",
    pdf: "/descargas/checklist-articulo-4-room714.pdf",
    docx: "/descargas/checklist-articulo-4-room714.docx",
  },
};

/** Ancla del formulario final, para los botones y el email. */
export const ANCLA_FORMULARIO = "hablemos";
