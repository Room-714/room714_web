// SISTEMA DE DISEÑO
//
// No está inventado: está extraído de la web original contando lo que ya se
// usaba (commit 537f249, antes del rediseño). Cuando había varias opciones se
// ha elegido la más repetida, y las demás se han eliminado.
//
// Regla: una página no escribe tamaños, canales ni colores a mano. Usa estas
// constantes. Si algo no encaja en el sistema, se discute el sistema; no se
// añade una excepción en la página.
//
// Lo que había antes de esto: cuatro canales laterales distintos, seis
// tamaños de h2 sin jerarquía, cuatro rojos y los grises repartidos entre
// utilidades y hexadecimales a mano.

// ─── CANAL LATERAL ─────────────────────────────────────────────────────────
// El del nav, para que el contenido alinee con el logo, que es el ancla
// izquierda de todo el sitio. Responsive en los cuatro tramos.

export const CANAL = "px-6 sm:px-8 md:px-10 lg:px-16";

/** Separación vertical entre secciones. */
export const AIRE = "py-12 md:py-14 lg:py-16";

/**
 * Aire entre un botón que cierra una sección y la sección siguiente. Sin
 * esto el botón queda pegado al borde y parece que pertenece al bloque de
 * abajo.
 */
export const AIRE_TRAS_BOTON = "pb-16 md:pb-20 lg:pb-24";

/** Separación vertical de una sección de cierre o CTA. */
export const AIRE_CIERRE = "py-14 md:py-16 lg:py-20";

// ─── ANCHOS ────────────────────────────────────────────────────────────────
// Sin `mx-auto`: el sitio alinea a la izquierda. Centrar la columna la
// despega del logo y del titular.

/**
 * Medida de lectura. El original no estrecha el texto: el artículo del blog
 * usa `prose max-w-none`, o sea todo el ancho del canal. Con un marco de
 * 1600 px, meter el contenido en max-w-4xl dejaba la mitad derecha de cada
 * página vacía.
 *
 * Vacío para poder seguir escribiendo {MEDIDA} en las plantillas sin que
 * recorte nada.
 */
export const MEDIDA = "";

/** Para una entradilla junto a un titular grande, como en Proyectos. */
export const MEDIDA_ENTRADILLA = "max-w-3xl";

// ─── TIPOGRAFÍA ────────────────────────────────────────────────────────────
// Cuatro tamaños y un micro. Cada uno con sus tramos responsive. La familia
// (font-title / font-body / font-hand) y el color se ponen en cada uso,
// porque cambian según el fondo de la sección.

/** Display. Solo para el gesto grande de una portada o cabecera de sección. */
export const DISPLAY = "text-6xl md:text-8xl lg:text-9xl leading-none";

/** Titular de página o de sección. Es el h2 más repetido del original. */
export const TITULAR = "text-3xl md:text-4xl lg:text-5xl leading-tight";

/** Titular dentro de una sección, y entradillas. */
export const SUBTITULAR = "text-xl md:text-2xl lg:text-3xl leading-snug";

/** Cuerpo de texto. */
export const CUERPO = "text-base md:text-lg lg:text-2xl leading-normal";

/** Avisos, pies, micro-copy. */
export const MICRO = "text-sm md:text-base leading-normal";

/**
 * `font-hand` (Mynerve) necesita más interlineado que las otras dos familias
 * en cuanto pasa de una línea: sus ascendentes y descendentes son largos y la
 * T de una línea se monta sobre la g de la anterior.
 *
 * Se escribe literal donde se usa para que Tailwind la vea.
 */
export const HAND = "leading-[1.45]";

// ─── COLOR ─────────────────────────────────────────────────────────────────
// Tres rojos con un trabajo cada uno, y dos parejas de texto según el fondo.
// El original ya los usaba así; lo que faltaba era no mezclarlos.

export const ROJO = {
  /** Acento: enlaces, números, rótulos a mano. */
  texto: "text-red-500",
  /** Botón primario. */
  boton: "bg-red-600",
  /** Fondo de sección y filetes de acento. */
  fondo: "bg-red-700",
};

/** Sobre fondo claro. */
export const CLARO = {
  titulo: "text-black",
  cuerpo: "text-gray-700",
  apagado: "text-gray-500",
};

/** Sobre fondo oscuro. */
export const OSCURO = {
  titulo: "text-white",
  cuerpo: "text-gray-300",
  apagado: "text-gray-400",
};

// ─── SUPERFICIES ───────────────────────────────────────────────────────────

/**
 * La tarjeta del sitio: fondo claro con cuadrícula. Estaba copiada a mano,
 * con sus cuatro líneas de clases, en cinco sitios distintos.
 */
export const TARJETA =
  "rounded-4xl overflow-hidden bg-[#F2F2F2] " +
  "bg-[linear-gradient(to_right,rgba(0,0,0,0.05)_1px,transparent_1px),linear-gradient(to_bottom,rgba(0,0,0,0.05)_1px,transparent_1px)] " +
  "bg-size-[40px_40px]";

/** La misma tarjeta cuando es un enlace. Cambia UNA cosa al pasar el ratón. */
export const TARJETA_ENLACE = `${TARJETA} hover:bg-[#F8F8F8] transition-colors duration-500`;

/** El filete rojo superior de la tarjeta. */
export const FILETE = "h-2 w-full bg-red-700";

/** El borde superior redondeado con el que se solapan las secciones. */
export const SECCION_REDONDA = "rounded-t-[50px]";
