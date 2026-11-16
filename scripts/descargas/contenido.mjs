// Texto de los dos documentos descargables de la landing de IA en tu empresa.
// Lo comparten la versión PDF y la DOCX (scripts/generar-descargas.mjs), así
// que solo hay un sitio donde corregir una frase. Es el texto aprobado, tal
// cual. Los textos entre corchetes son huecos que rellena la empresa: el
// generador los resalta.

export const PIE =
  "Plantilla de Room 714 · room714.com · Información general, no asesoramiento jurídico.";

export const POLITICA = {
  fichero: "politica-uso-ia-room714",
  rotulo: "Plantilla · Política de uso de IA",
  titulo: "Política de uso de la inteligencia artificial en [NOMBRE DE LA EMPRESA]",
  subtitulo: "Versión [1.0] · En vigor desde [FECHA] · Próxima revisión [FECHA]",
  secciones: [
    {
      titulo: "Para qué sirve esta política.",
      texto:
        "Queremos que toda la plantilla aproveche la IA en su trabajo y que lo haga sin poner en riesgo a la empresa, a sus clientes ni a sus compañeros. Se aplica a cualquier persona que trabaje para [NOMBRE DE LA EMPRESA], incluidos colaboradores externos.",
    },
    {
      titulo: "Herramientas aprobadas.",
      texto:
        "Solo se usan para el trabajo las herramientas de esta lista, con la cuenta de empresa: [HERRAMIENTA 1], [HERRAMIENTA 2], [HERRAMIENTA 3]. Para proponer una herramienta nueva, escribe a [RESPONSABLE].",
    },
    {
      titulo: "Qué no se introduce nunca.",
      texto:
        "Datos personales de clientes, empleados o candidatos; contraseñas y credenciales; información financiera, contractual o estratégica no pública; [OTROS DATOS PROPIOS DE LA EMPRESA]. En caso de duda, no se introduce y se pregunta.",
    },
    {
      titulo: "Revisión humana.",
      texto:
        "Lo que genera la IA es un borrador. Quien lo usa lo revisa, comprueba cifras y fuentes, y responde del resultado como si lo hubiera hecho sin ayuda.",
    },
    {
      titulo: "Transparencia.",
      texto:
        "No se presenta como propio un contenido generado con IA cuando eso pueda inducir a error a un cliente o a un tercero. Las decisiones que afecten a personas no se toman solo con IA.",
    },
    {
      titulo: "Formación.",
      texto:
        "Nadie usa estas herramientas sin haber recibido la formación básica de la empresa. La formación se repite cuando cambia una herramienta o su uso.",
    },
    {
      titulo: "Incidentes.",
      texto:
        "Si se ha introducido información que no debía o una herramienta se comporta de forma inesperada, se avisa el mismo día a [RESPONSABLE].",
    },
    {
      titulo: "Responsable.",
      texto:
        "[NOMBRE Y CARGO] resuelve dudas, mantiene la lista de herramientas y revisa esta política cada [SEIS] meses.",
    },
  ],
};

export const CHECKLIST = {
  fichero: "checklist-articulo-4-room714",
  rotulo: "Plantilla · Artículo 4 del Reglamento europeo de IA",
  titulo: "Alfabetización en IA: lista de comprobación para la empresa",
  intro:
    "El artículo 4 del Reglamento europeo de IA pide a las empresas que usan o desarrollan IA que tomen medidas para que su personal, y quien use IA en su nombre, sepa utilizarla. No exige un nivel concreto, ni exámenes, ni certificados. Lo que conviene es poder enseñar qué se ha hecho. Esta lista sigue los pasos que recomienda la Comisión Europea.",
  casillas: [
    "Tenemos un inventario de las herramientas de IA que se usan, con un responsable y los equipos que usan cada una.",
    "Sabemos, para cada herramienta, si la usamos (responsable del despliegue) o la desarrollamos y ponemos en servicio con nuestro nombre (proveedor).",
    "Hemos anotado los riesgos de cada herramienta: errores e invenciones, datos confidenciales o personales, resultados sin revisar.",
    "Toda la plantilla ha recibido una formación básica: qué es la IA, cómo funciona, qué usamos y qué no se debe hacer.",
    "Hay formación adicional por perfil: usuarios intensivos, responsables que aprueban el uso y equipo de IT.",
    "Existe una política de uso de IA escrita y la plantilla la conoce.",
    "Guardamos un registro de la formación: fecha, asistentes, contenido y herramientas tratadas.",
    "Los colaboradores externos que usan IA en nuestro nombre tienen la formación que exige su tarea.",
    "Revisamos inventario, riesgos y formación cada vez que cambia una herramienta o un uso.",
    "Si usamos algún sistema de alto riesgo, quien lo supervisa tiene formación específica.",
  ],
  nota:
    "Lista elaborada con la redacción del artículo 4 vigente desde julio de 2026 y las preguntas y respuestas de la Comisión Europea. Revísala si cambia la normativa.",
};

/** Parte un texto en trozos normales y huecos [ENTRE CORCHETES]. */
export function trocear(texto) {
  const trozos = [];
  const re = /\[[^\]]+\]/g;
  let ultimo = 0;
  for (const m of texto.matchAll(re)) {
    if (m.index > ultimo) trozos.push({ texto: texto.slice(ultimo, m.index), hueco: false });
    trozos.push({ texto: m[0], hueco: true });
    ultimo = m.index + m[0].length;
  }
  if (ultimo < texto.length) trozos.push({ texto: texto.slice(ultimo), hueco: false });
  return trozos;
}
