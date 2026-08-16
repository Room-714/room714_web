// Cliente de Apollo. Solo transporte: aquí no hay reglas de negocio ni
// decisiones sobre a quién buscamos (eso vive en ProspectingProfile.js) ni
// sobre cuánto gastar (eso vive en el cron).
//
// ⚠️ PRESUPUESTO — LEER ANTES DE AÑADIR NINGÚN PARÁMETRO ⚠️
// La cuenta es de plan gratuito: 75 créditos al mes. Enriquecer una persona
// cuesta 1 crédito e incluye su linkedin_url, que es lo único que queremos.
// NUNCA se deben enviar estos parámetros:
//   reveal_personal_emails  → consume créditos extra por email revelado
//   reveal_phone_number     → 8 créditos EXTRA por persona
//   run_waterfall_email     → enriquecimiento en cascada, 25+ créditos
//   run_waterfall_phone     → ídem
// Su valor por defecto es false y así deben quedarse. Añadir uno "por si
// acaso" se lleva por delante la cuota del mes en una sola ejecución.

const APOLLO_BASE = "https://api.apollo.io/api/v1";

// bulk_match no admite más de 10 personas por llamada.
export const ENRICH_BATCH_SIZE = 10;

function apiKey() {
  const key = process.env.APOLLO_API_KEY;
  if (!key) {
    throw new Error(
      "APOLLO_API_KEY no está definida: la prospección automática no puede funcionar sin ella",
    );
  }
  return key;
}

async function apolloPost(path, body) {
  const response = await fetch(`${APOLLO_BASE}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      accept: "application/json",
      "x-api-key": apiKey(),
    },
    body: JSON.stringify(body),
  });

  const text = await response.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    // Respuesta no-JSON: nos quedamos con el texto para el mensaje de error.
  }

  // Ruidoso a propósito: un fallo silencioso aquí se traduce en semanas sin
  // prospectos nuevos y nadie se entera.
  if (!response.ok) {
    const detail =
      data?.error || data?.message || text?.slice(0, 300) || "sin cuerpo";
    throw new Error(`Apollo ${path} respondió ${response.status}: ${detail}`);
  }

  return data ?? {};
}

// Búsqueda de personas. NO consume créditos: devuelve id, nombre parcial,
// cargo y empresa, pero nunca la URL de LinkedIn (para eso hay que enriquecer).
export async function searchPeople(params) {
  const data = await apolloPost("/mixed_people/api_search", params);
  return {
    people: data.people || [],
    totalEntries: data.pagination?.total_entries ?? 0,
  };
}

// Enriquecimiento por lotes. CONSUME 1 CRÉDITO por persona encontrada.
// Máximo 10 ids por llamada; con más, se trocea.
export async function enrichPeople(apolloIds = []) {
  const ids = apolloIds.filter(Boolean);
  if (ids.length === 0) return { matches: [] };

  const matches = [];
  for (let i = 0; i < ids.length; i += ENRICH_BATCH_SIZE) {
    const batch = ids.slice(i, i + ENRICH_BATCH_SIZE);
    const data = await apolloPost("/people/bulk_match", {
      details: batch.map((id) => ({ id })),
      // Ningún reveal_* ni run_waterfall_*: ver el aviso de la cabecera.
    });
    matches.push(...(data.matches || []).filter(Boolean));
  }

  return { matches };
}
