// Todo lo que se puede descartar sin gastar un crédito, antes de que nadie mire
// la ficha. Es la última defensa gratis: lo que pase de aquí ocupa un hueco de
// los veinte del día.
//
// Trabaja solo con lo que la búsqueda de Apollo devuelve de verdad: `id`,
// `title` y el nombre de la empresa. Nada de sector ni plantilla, que Apollo no
// da en la búsqueda por mucho que se le pida.

// Empresas que resuelven dentro lo que Room714 vende: no son clientes, son
// competencia o proveedores del mismo servicio.
//
// Van como palabras completas y no como subcadenas por una razón concreta y con
// cicatriz: la primera versión de las reglas de `interestFor` usaba /(cto|tech)/
// sin límites de palabra, y "director" contiene "cto", así que los diez primeros
// prospectos importados —todos directores— quedaron etiquetados como empresa de
// software. Nada de subcadenas sueltas aquí.
export const EXCLUDED_COMPANY_PATTERNS = [
  /\bsoftware\b/i,
  /\bagencia\b/i,
  /\bagency\b/i,
  /\bconsulting\b/i,
  /\bconsultor(?:a|es|ia|ía)?\b/i,
  /\bdigital\b/i,
  /\bstudio\b/i,
  /\bestudio\b/i,
  /\blabs?\b/i,
  /\bmarketing\b/i,
  /\bsaas\b/i,
];

function normalizeTitle(title) {
  return String(title || "").trim().toLowerCase().replace(/\s+/g, " ");
}

function normalizeCompany(name) {
  return String(name || "").trim().toLowerCase();
}

// Devuelve `{ kept, dropped }`. `dropped` lleva el motivo de cada descarte para
// que la respuesta del cron sea diagnosticable sin abrir la base de datos: si un
// día la cola sale vacía, el porqué tiene que estar a la vista.
export function filterCandidates(people = [], { rules = {}, knownIds = new Set() } = {}) {
  const excludedTitles = (rules.excludedTitles ?? []).map(normalizeTitle);
  const kept = [];
  const dropped = [];
  const empresasVistas = new Set();

  for (const p of people) {
    const drop = (reason) => dropped.push({ apolloId: p?.id ?? null, reason });

    if (!p?.id) {
      drop("sin id de Apollo");
      continue;
    }
    if (knownIds.has(p.id)) {
      drop("ya estaba en el historial");
      continue;
    }

    if (excludedTitles.includes(normalizeTitle(p.title))) {
      drop(`cargo excluido por las reglas: ${p.title}`);
      continue;
    }

    const company = p.organization?.name ?? null;
    if (company && EXCLUDED_COMPANY_PATTERNS.some((re) => re.test(company))) {
      drop(`la empresa parece del sector que ya resuelve esto: ${company}`);
      continue;
    }

    // Una persona por empresa: dos directores de la misma compañía son un solo
    // contacto y gastarían dos créditos por la misma puerta.
    const companyKey = normalizeCompany(company);
    if (companyKey && empresasVistas.has(companyKey)) {
      drop("ya hay otro candidato de esa empresa");
      continue;
    }
    if (companyKey) empresasVistas.add(companyKey);

    kept.push(p);
  }

  return { kept, dropped };
}
