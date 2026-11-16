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
// Quinta revisión: el inventario de IA vuelve y sustituye al formulario de
// contacto al final de la página (el resultado se envía por correo y se
// guarda en la tabla Lead).

export const INCORPORAR_IA = {
  seo: {
    title: "Consultoría para incorporar la IA en tu empresa | Room 714",
    description:
      "Tus empleados usan la IA sin normas. Te ayudamos a incorporarla con orden: reglas por escrito, un equipo que sabe usarla y un plan con IT. En remoto.",
  },

  // Texto del enlace del footer.
  footer: "IA en tu empresa",

  hero: {
    // El titular es el H1 de la página.
    titular: "Tus empleados ya usan la IA, pero… ¿están haciéndolo como deben?",
    subtitulo: "Sin normas, sin formación, sin control.",
    texto:
      "Room 714 tiene la solución para que la IA en tu empresa aporte el máximo valor y suponga el mínimo riesgo.",
    cta: "Hablemos",
  },

  problema: {
    titulo: "Lo que ya está pasando en tu empresa… aunque tú no lo sepas.",
    puntos: [
      "Cada uno usa la herramienta que le parece, muchas veces con su cuenta personal.",
      "Se pegan contratos, datos de clientes y documentos internos en chats que nadie ha aprobado.",
      "Si mañana hay una fuga, nadie sabría decir qué se subió ni dónde.",
    ],
    remate: "Esto no va de prohibir, sino de enseñar.",
  },

  // Los dos ejes de la oferta («Room 714 para Urgasa»): la plantilla y la
  // empresa (IT y dirección), en paralelo.
  frentes: {
    titulo: "En Room 714 te hacemos una propuesta con dos ejes…",
    bloques: [
      {
        titulo: "Que tus empleados sepan cómo usarla.",
        destacado: "tus empleados", // en rojo
        texto:
          "Formación práctica orientada al uso consciente de la IA: cinco sesiones de dos horas, en remoto, con casos reales de su propio trabajo y sin necesidad de base técnica.",
      },
      {
        titulo: "Que tu empresa sepa dónde aplicarla.",
        destacado: "tu empresa", // en rojo
        texto:
          "Tres meses de consultoría junto a IT y dirección, en tres fases (situación actual, caminos de evolución y plan de proyectos), que fijan un plan estratégico para incorporar la IA en tus procesos.",
      },
    ],
  },

  // Continúa la frase del título de `frentes`, en el mismo bloque.
  queda: {
    titulo: "…para que la IA deje de ser un riesgo y pase a ser un plan.",
  },

  cierre: {
    titulo: "Hablemos de tu caso.",
    texto:
      "Responde cinco preguntas sobre cómo se usa hoy la IA en tu empresa y te enviamos el resultado por correo.",
    // Resumen de la bio de «Quién está detrás» (about.quien del
    // diccionario): no añade nada que no esté ya publicado allí.
    quien: {
      nombre: "José Antonio Ces",
      cargo: "Fundador y CEO de Room 714",
      bio: "Ingeniero de Telecomunicación con más de treinta años en producto B2B: de Ericsson y Telefónica a fundar Room 714 en 2016. Ha sido consultor senior de transformación digital para empresas como LaLiga, GMV o MasOrange.",
    },
    // Segundo párrafo, sobre Room 714: sale de «Nosotros» (about.hero del
    // diccionario) y de la frase de «Por qué Room 714» del encargo.
    room714:
      "Room 714 es un estudio de producto digital: un equipo de ingenieros especialistas en el diseño, la usabilidad y la arquitectura de producto. Diseñamos y desarrollamos software e IA para empresas, así que el plan de proyectos que te dejamos es uno que sabríamos ejecutar.",
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
