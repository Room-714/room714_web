// Landing de campaña «Formación y consultoría de IA para empresas».
//
// Solo existe en castellano (la ruta vive en SOLO_ES de app/lib/routes.mjs),
// así que sus textos van aquí y no en los diccionarios, que son bilingües.
// Los textos son los aprobados, tal cual: no se reescriben aquí.
//
// Formación y consultoría son UN solo producto. Nada de esta página puede
// sugerir paquetes, niveles ni precio.

export const FORMACION_IA = {
  seo: {
    title: "Formación y consultoría de IA para empresas | Room 714",
    description:
      "Formamos a tu plantilla en el uso práctico de la IA y definimos con IT y dirección dónde incorporarla en tus procesos. Un solo programa, en remoto y en tres meses.",
  },

  // Texto del enlace del footer.
  footer: "Formación en IA",

  hero: {
    antetitulo: "Formación y consultoría de IA para empresas",
    titular: "IA útil desde el primer día.",
    subtitulo: "Tu gente ya usa IA. Ponle orden y sácale partido.",
    texto:
      "Un solo programa de tres meses: formamos a tu equipo con casos reales de su trabajo y, a la vez, decidimos con IT y dirección dónde y cómo incorporar la IA en tus procesos.",
    ctaPrincipal: "Reservar sesión de diagnóstico",
    ctaSecundario: "Hacer el inventario de IA",
    // La misma promesa que la portada (home.cierre del diccionario).
    nota: "Sesión de diagnóstico de 30 minutos. Nos escribes, te respondemos en 24 h laborables y fijamos hora.",
  },

  problema: {
    titulo: "La IA ya está en tu empresa. Falta el orden.",
    puntos: [
      "Unos la usan sin control. Nadie sabe qué datos se están subiendo ni a qué herramientas.",
      "Otros apenas la han probado. La diferencia de productividad entre compañeros crece cada mes.",
      "Nadie ha decidido dónde aporta. Hay pruebas sueltas, pero no un plan con prioridades.",
    ],
  },

  inventario: {
    titulo: "¿Y en la tuya? Haz el inventario de IA en dos minutos.",
    texto:
      "Cinco preguntas. Al terminar ves los puntos a revisar y te enviamos dos plantillas: una política de uso de IA de una página y la lista de comprobación del artículo 4.",
    nota: "Tus respuestas no salen de tu navegador hasta que pides el resultado por email.",
  },

  propuesta: {
    titulo:
      "Las personas aprenden a usarla. La empresa decide dónde incorporarla.",
    nota: "Un solo programa, dos frentes a la vez.",
    tarjetas: [
      {
        titulo: "Con toda la plantilla",
        subtitulo: "Formación práctica para un uso fácil de la IA.",
        texto:
          "Cinco módulos de dos horas, en remoto, con casos reales de su trabajo. No hace falta base técnica.",
        resultado:
          "control de las herramientas y más productividad en cualquier área.",
      },
      {
        titulo: "Con IT y dirección",
        subtitulo: "Consultoría para la incorporación de la IA.",
        texto:
          "Un módulo formativo para el equipo de IT sobre el entorno corporativo de IA y un ejercicio consultivo en tres fases, con entrevistas a IT y a las áreas.",
        resultado:
          "un equipo de IT que domina el entorno y un plan de proyectos de IA priorizado para tus procesos.",
      },
    ],
    etiquetaResultado: "Resultado:",
  },

  programa: {
    titulo: "Programa formativo: cinco módulos, diez horas.",
    formato: "2 horas · en remoto",
    modulos: [
      {
        titulo: "Qué es la IA, cómo pedirle las cosas y qué está permitido",
        objetivo:
          "Tener en una sola sesión toda la base de los módulos prácticos: entender qué es la IA, darle instrucciones con método y saber qué datos y usos están permitidos.",
        tipo: "Base",
      },
      {
        titulo: "Trabajar con documentos",
        objetivo:
          "Usar la IA para leer, extraer, comparar y transformar documentos largos, y comprobar lo que dice sobre ellos.",
        tipo: "Práctica",
      },
      {
        titulo: "Datos, análisis e información externa",
        objetivo:
          "Analizar hojas de cálculo y buscar información con la IA, y comprobar cifras y fuentes.",
        tipo: "Práctica",
      },
      {
        titulo: "Asistentes, conectores y agentes",
        objetivo:
          "Pasar del chat suelto a un asistente configurado con el contexto de cada departamento, y ver qué es un agente y dónde debe intervenir la persona.",
        tipo: "Práctica",
      },
      {
        titulo: "Ejercicio libre tutelado",
        objetivo:
          "Resolver con la IA al menos un problema real del propio trabajo, con ayuda del formador, y aprender de los resultados de los demás.",
        tipo: "Trabajo tutelado",
      },
    ],
  },

  consultoria: {
    titulo: "Consultoría: dónde y cómo incorporar la IA en tu empresa.",
    texto:
      "Tiene dos partes. Primero, que tu equipo de IT domine cómo funciona un entorno corporativo de IA. Después, decidir juntos en qué procesos de la empresa aporta la IA y con qué proyectos se incorpora.",
    parte1: {
      etiqueta: "Parte 1 · Módulo formativo para el equipo de IT",
      titulo: "Cómo funciona un entorno corporativo de IA.",
      texto:
        "Una sesión orientativa y práctica para que IT domine las piezas antes de abrir la IA a toda la empresa, y sepa cómo se concreta cada concepto en cada plataforma.",
      listas: [
        {
          titulo: "Las piezas del entorno",
          puntos: [
            "Roles (propietario, administrador y miembro)",
            "Licencias",
            "Dominio verificado e inicio de sesión único",
            "Espacios compartidos y conectores",
            "Retención y auditoría",
          ],
        },
        {
          titulo: "La organización interna",
          puntos: [
            "Quién administra el entorno",
            "Ciclo de alta y baja de usuarios ligado a RR. HH.",
            "Aprobación de herramientas nuevas",
            "Gestión de incidentes",
          ],
        },
      ],
    },
    parte2: {
      etiqueta: "Parte 2 · Ejercicio consultivo en tres fases",
      titulo: "Un plan de proyectos de IA para tus procesos.",
      texto:
        "Coordinados con tu equipo de IT, levantamos la situación de la empresa con entrevistas, primero con IT y después con el resto de áreas, y la convertimos en un plan.",
      etiquetaSalesCon: "Sales con:",
      fases: [
        {
          titulo: "As-Is. Situación actual",
          texto:
            "Levantamos la situación de la empresa en tecnología, negocio y procesos mediante entrevistas con IT y con las distintas áreas.",
          salesCon: "Las posibles vías para incorporar la IA, identificadas.",
        },
        {
          titulo: "To-Be. Caminos de evolución",
          texto:
            "Trazamos distintos caminos de evolución tecnológica, de procedimientos, cultural y organizativa para que la dirección compare y elija.",
          salesCon: "El camino que mejor encaja con tu empresa, decidido.",
        },
        {
          titulo: "To-Do. Plan de proyectos",
          texto:
            "Convertimos ese camino en proyectos concretos de IA agéntica y de machine learning para tus procesos, ordenados por prioridad e importancia.",
          salesCon: "El plan de proyectos, incluidos los de resultado rápido.",
        },
      ],
    },
  },

  llevas: {
    titulo: "Lo que te llevas.",
    puntos: [
      "Una plantilla que usa la IA con criterio en su trabajo diario.",
      "Certificado de asistencia para cada participante.",
      "Una política de uso de IA de una página, lista para aplicar.",
      "Un dossier con la formación impartida, por perfil y por herramienta.",
      "Un equipo de IT que sabe administrar el entorno corporativo de IA.",
      "Un plan de proyectos de IA priorizado para tus procesos.",
    ],
    normativa: {
      etiqueta: "Y la normativa",
      titulo: "Lo que pide el Reglamento europeo de IA, sin alarmismo.",
      texto:
        "El artículo 4 obliga a las empresas que usan IA a tomar medidas para que su personal sepa utilizarla. No exige exámenes ni certificados oficiales, pero conviene poder demostrar lo que se ha hecho. El programa te deja esa documentación preparada.",
      nota: "Información general, no asesoramiento jurídico.",
    },
  },

  calendario: {
    titulo: "Un solo programa. Tres meses.",
    texto:
      "La formación y la consultoría empiezan el mismo día y avanzan en paralelo. El calendario de detalle se cierra en la reunión de arranque según tu disponibilidad.",
    meses: ["Mes 1", "Mes 2", "Mes 3"],
    semanas: 12,
    // `linea` decide el color de la barra; la etiqueta de texto es la que
    // lleva el significado, así que no depende solo del color.
    lineas: [
      {
        linea: "arranque",
        etiqueta: "Arranque · plan de sesiones y entrevistas",
        desde: 1,
        hasta: 1,
      },
      {
        linea: "formacion",
        etiqueta:
          "Formación · módulos 1 a 5 con toda la plantilla (un módulo cada una o dos semanas)",
        desde: 2,
        hasta: 10,
      },
      {
        linea: "consultoria",
        etiqueta:
          "Consultoría · módulo formativo para IT sobre el entorno corporativo de IA",
        desde: 2,
        hasta: 3,
      },
      {
        linea: "consultoria",
        etiqueta: "Consultoría · As-Is, entrevistas con IT y con las áreas",
        desde: 2,
        hasta: 7,
      },
      {
        linea: "consultoria",
        etiqueta: "Consultoría · To-Be, caminos de evolución con la dirección",
        desde: 6,
        hasta: 10,
      },
      {
        linea: "consultoria",
        etiqueta: "Consultoría · To-Do, plan de proyectos y cierre ejecutivo",
        desde: 9,
        hasta: 12,
      },
    ],
    cta: "Reservar sesión de diagnóstico",
  },

  porQue: {
    titulo: "Formamos sobre lo que construimos.",
    texto:
      "Somos un estudio de producto digital. Diseñamos y desarrollamos software e IA para empresas, así que el plan de proyectos que te dejamos es uno que sabríamos ejecutar.",
    enlaces: [
      { texto: "Casos", ruta: "casos" },
      { texto: "IA dentro del producto", ruta: "iaProducto" },
    ],
  },

  faq: {
    titulo: "Preguntas frecuentes",
    preguntas: [
      {
        p: "¿Hace falta base técnica?",
        r: "No. La formación está pensada para cualquier área y cualquier nivel de partida.",
      },
      {
        p: "¿Con qué herramientas trabajáis?",
        r: "Con las que tu empresa ya usa o quiere adoptar. No vendemos licencias.",
      },
      {
        p: "¿Dais un certificado?",
        r: "Entregamos certificado de asistencia y un dossier de la formación. No existe una certificación oficial de alfabetización en IA.",
      },
      {
        p: "¿Es presencial?",
        r: "Es en remoto, con sesiones cortas y separadas para no parar la actividad.",
      },
      {
        p: "¿Cuánta gente puede participar?",
        r: "Toda la plantilla. El número de grupos y de repeticiones de cada módulo se acuerda según el tamaño de la empresa y el alcance contratado.",
      },
      {
        p: "¿Qué pasa después?",
        r: "Decides tú. Puedes ejecutar el plan de proyectos con tu equipo, con nosotros o con quien quieras.",
      },
    ],
  },

  cierre: {
    titulo: "Cuéntanos cómo está la IA en tu empresa.",
    texto:
      "Vemos qué se está usando, qué riesgos hay y por dónde tiene sentido empezar.",
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
