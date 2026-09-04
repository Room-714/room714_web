// La página vive en _vistas para poder servirla desde dos rutas, una por
// idioma: /es/casos y /en/cases. Las guardas de next.config impiden que
// /en/casos sirva contenido duplicado.
export { default, generateMetadata } from "../_vistas/casos";
