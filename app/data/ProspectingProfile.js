// ─── Perfil de cliente ideal (ICP) para la prospección en LinkedIn ─────────
// Derivado de los servicios de Room714 (UX/UI, Product Management, CX
// Research, Transformación Digital, Software Development). Se usa en dos
// sitios: el prompt del redactor de comentarios (contexto de a quién le
// hablamos) y las búsquedas sugeridas del briefing cuando la lista de
// prospectos aún es corta.
//
// Editar este fichero ES editar la estrategia de prospección: no hay más
// configuración escondida.

export const IDEAL_CUSTOMER_PROFILE = {
  // A quién buscamos: decisores con presupuesto de producto/digital.
  roles: [
    "CEO / Founder",
    "CPO / Head of Product",
    "CTO / VP Engineering",
    "Head of Digital / Transformación Digital",
    "Head of UX / Design Lead",
    "Director de Innovación",
  ],
  // Dónde: empresas con producto digital propio o canal digital relevante.
  sectors: [
    "SaaS y scaleups",
    "Banca y fintech",
    "Retail y ecommerce",
    "Salud digital",
    "Industria con canal digital (B2B)",
    "Medios y educación online",
  ],
  // Señales de que un post suyo es comentable con nuestra voz.
  signals: [
    "Habla de rediseños, lanzamientos o roadmap de producto",
    "Se queja de fricción, churn o conversión",
    "Menciona modernizar sistemas legados",
    "Pregunta o opina sobre IA aplicada a producto",
    "Comparte métricas o aprendizajes de UX/CX",
  ],
  // Palabras clave para búsquedas de contenido en LinkedIn.
  keywords: [
    "UX",
    "product management",
    "experiencia de cliente",
    "transformación digital",
    "producto digital",
    "IA en producto",
  ],
};

// Búsquedas de contenido en LinkedIn para encontrar posts comentables cuando
// un prospecto no ha publicado nada reciente. Rotan por día para no repetir.
export function contentSearchUrl(keyword) {
  return `https://www.linkedin.com/search/results/content/?keywords=${encodeURIComponent(
    keyword,
  )}&sortBy=%22date_posted%22`;
}

// Feed de actividad reciente de un perfil o página a partir de su URL.
export function activityFeedUrl(linkedinUrl) {
  const clean = String(linkedinUrl || "").replace(/\/+$/, "");
  if (clean.includes("/company/")) return `${clean}/posts/`;
  return `${clean}/recent-activity/all/`;
}

// Cuántas tareas de prospección entran en el briefing de cada día laborable.
export const PROSPECT_TASKS_PER_DAY = 2;
