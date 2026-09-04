// Las cuatro situaciones por las que entra un cliente. Igual que Services.js
// y Projects.js, aquí solo vive lo que NO es texto: la clave de ruta, el
// número y la ilustración. Los textos salen del diccionario.
const SITUACION_META = [
  { clave: "productoClientes", number: "01", image: "/services_01.svg" },
  { clave: "productoEquipo", number: "02", image: "/services_02.svg" },
  { clave: "iaProducto", number: "03", image: "/services_03.svg" },
  { clave: "empezarDeCero", number: "04", image: "/services_04.svg" },
];

export const CLAVES_SITUACION = SITUACION_META.map((s) => s.clave);

export const getSituacionesData = (dict) =>
  SITUACION_META.map(({ clave, number, image }) => {
    const t = dict.situaciones[clave];
    return {
      clave,
      number,
      image,
      title: t.cardTitle,
      description: t.cardDescription,
      cta: t.cardCta,
    };
  });
