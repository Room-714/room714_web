// Landing de campaña «Formación y consultoría de IA para empresas».
//
// Solo existe en castellano (la ruta vive en SOLO_ES de app/lib/routes.mjs),
// así que sus textos van aquí y no en los diccionarios, que son bilingües.
//
// Segunda versión (2026-11-16): página corta, centrada en el problema del
// riesgo y el descontrol, en cinco bloques. Textos aprobados por José
// Antonio; no se reescriben aquí.
//
// Formación y consultoría son UN solo producto. Nada de esta página puede
// sugerir paquetes, niveles ni precio.

export const FORMACION_IA = {
  seo: {
    title: "Formación y consultoría de IA para empresas | Room 714",
    description:
      "Tu plantilla ya usa IA sin normas. En tres meses la formamos, ponemos reglas por escrito y decidimos con IT dónde incorporarla. En remoto.",
  },

  // Texto del enlace del footer.
  footer: "Formación en IA",

  hero: {
    antetitulo: "Formación y consultoría de IA para empresas",
    titular: "Tu plantilla ya usa IA. ¿Sabes con qué datos?",
    subtitulo: "Sin normas, sin formación y sin nadie que lo controle.",
    texto:
      "En tres meses lo ponemos en orden: formamos a todo el equipo, dejamos por escrito las reglas de uso y decidimos con IT dónde la IA sí aporta.",
    ctaPrincipal: "Reservar sesión de diagnóstico",
    ctaSecundario: "Hacer el inventario de IA",
    nota: "Sesión de diagnóstico de 30 minutos. Te respondemos en 24 h laborables.",
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

  inventario: {
    titulo: "¿Y en tu empresa? Compruébalo en dos minutos.",
    texto:
      "Cinco preguntas. Al terminar ves los puntos a revisar y te enviamos dos plantillas: una política de uso de IA y la lista de comprobación del artículo 4.",
    nota: "Tus respuestas no salen de tu navegador hasta que pides el resultado por email.",
  },

  resultados: {
    titulo: "En tres meses, la IA pasa de riesgo a herramienta.",
    tarjetas: [
      {
        titulo: "Reglas claras.",
        texto:
          "Una política de uso de una página: qué herramientas se usan, qué datos no se meten nunca y quién responde.",
      },
      {
        titulo: "Una plantilla que sabe usarla.",
        texto:
          "Cinco sesiones prácticas de dos horas, en remoto, con casos de su propio trabajo. Con certificado de asistencia y la documentación para demostrar lo que pide el artículo 4 del Reglamento europeo de IA.",
      },
      {
        titulo: "Un plan para lo siguiente.",
        texto:
          "Con IT y dirección decidimos en qué procesos aporta la IA y con qué proyectos, por orden de prioridad.",
      },
    ],
  },

  como: {
    titulo: "Un solo programa. Formación y consultoría a la vez.",
    pasos: [
      {
        cuando: "Semana 1",
        titulo: "Arranque.",
        texto: "Vemos qué se usa hoy y planificamos las sesiones y las entrevistas.",
      },
      {
        cuando: "Semanas 2 a 10",
        titulo: "Formación.",
        texto: "Cinco sesiones con toda la plantilla. No hace falta base técnica.",
      },
      {
        cuando: "Semanas 2 a 12",
        titulo: "Consultoría.",
        texto:
          "IT aprende a administrar el entorno corporativo de IA, entrevistamos a las áreas y cerramos el plan de proyectos.",
      },
    ],
    remate:
      "No vendemos licencias: trabajamos con las herramientas que ya usáis o queréis adoptar.",
  },

  cierre: {
    titulo: "Cuéntanos cómo se usa hoy la IA en tu empresa.",
    texto:
      "En 30 minutos vemos qué se está usando, qué riesgos hay y por dónde empezar. No es una reunión comercial.",
    firma: "Te atiende José Antonio Ces, fundador de Room 714.",
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
export const ANCLA_INVENTARIO = "inventario";
