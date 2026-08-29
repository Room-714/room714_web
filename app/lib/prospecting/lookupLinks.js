// Enlaces para investigar a un candidato ANTES de gastar el crédito.
//
// La URL de LinkedIn de la persona no puede aparecer en la ficha: es
// literalmente lo que se compra al enriquecer, y tenerla gratis haría que el
// crédito no sirviera para nada. Pero buscarla uno mismo no cuesta nada, y sin
// ninguna forma de investigar, la decisión se toma con el cargo y el nombre de
// la empresa a secas — que no da para distinguir a un fabricante mediano de la
// filial española de una multinacional con su tecnología centralizada.
//
// Son búsquedas, no perfiles: pueden no encontrar a nadie, y encontrar a la
// persona equivocada. Sirven para decidir, no para guardar.

// Recorta antes de decidir si hay algo. Apollo devuelve campos con espacios y
// cadenas vacías, y `filter(Boolean)` deja pasar "   ": sin este recorte se
// construían búsquedas vacías que abren LinkedIn sin buscar nada.
function limpio(texto) {
  return String(texto ?? "").trim();
}

function q(texto) {
  return encodeURIComponent(limpio(texto));
}

// Búsqueda de personas en LinkedIn por cargo y empresa. Es la que más veces va a
// dar con la persona exacta, porque combina los dos datos que tenemos.
export function linkedinPeopleSearch({ title, company }) {
  const términos = [company, title].map(limpio).filter(Boolean).join(" ");
  if (!términos) return null;
  return `https://www.linkedin.com/search/results/people/?keywords=${q(términos)}`;
}

// La página de la empresa en LinkedIn: para ver a qué se dedican y cuánta gente
// son de verdad, que es el dato que Apollo no nos da en la búsqueda.
export function linkedinCompanySearch({ company }) {
  if (!limpio(company)) return null;
  return `https://www.linkedin.com/search/results/companies/?keywords=${q(company)}`;
}

// Google, para lo que LinkedIn no cuenta: si tienen tienda online, si han salido
// en prensa, si son la filial de alguien.
export function webSearch({ company }) {
  if (!limpio(company)) return null;
  return `https://www.google.com/search?q=${q(company)}`;
}

// Los tres juntos, en el orden en que se van a usar.
export function lookupLinksFor({ title, company }) {
  return [
    { label: "Buscar a la persona", url: linkedinPeopleSearch({ title, company }) },
    { label: "La empresa en LinkedIn", url: linkedinCompanySearch({ company }) },
    { label: "Buscar en Google", url: webSearch({ company }) },
  ].filter((l) => l.url);
}
