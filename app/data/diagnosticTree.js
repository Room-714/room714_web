// Árbol de decisión para el diagnóstico de necesidades del cliente.
// Cada nodo tiene: questionKey (clave i18n), options con next (siguiente nodo) o result (diagnóstico final).
// Los resultados mapean a intereses del formulario de contacto para prellenar.
// Profundidad: 4 niveles (q1 → q2 rama → q3 detalle → q4 situación transversal)

export const diagnosticTree = {
  start: {
    questionKey: "q1",
    options: [
      { labelKey: "q1_a", next: "product_depth" },
      { labelKey: "q1_b", next: "ux_depth" },
      { labelKey: "q1_c", next: "design_depth" },
      { labelKey: "q1_d", next: "tech_depth" },
    ],
  },

  // ═══════════════════════════════════════════════
  // RAMA PRODUCTO
  // ═══════════════════════════════════════════════
  product_depth: {
    questionKey: "q2_product",
    options: [
      { labelKey: "q2_product_a", next: "product_validation" },
      { labelKey: "q2_product_b", next: "product_stage" },
      { labelKey: "q2_product_c", next: "product_growth" },
    ],
  },
  product_validation: {
    questionKey: "q3_product_validation",
    options: [
      { labelKey: "q3_product_validation_a", next: "situation_product_scratch" },
      { labelKey: "q3_product_validation_b", next: "situation_product_scratch" },
      { labelKey: "q3_product_validation_c", next: "situation_product_strategy" },
    ],
  },
  product_stage: {
    questionKey: "q3_product",
    options: [
      { labelKey: "q3_product_a", next: "situation_product_scratch" },
      { labelKey: "q3_product_b", next: "situation_product_pivot" },
      { labelKey: "q3_product_c", next: "situation_product_scale" },
    ],
  },
  product_growth: {
    questionKey: "q3_product_growth",
    options: [
      { labelKey: "q3_product_growth_a", next: "situation_product_strategy" },
      { labelKey: "q3_product_growth_b", next: "situation_product_pivot" },
      { labelKey: "q3_product_growth_c", next: "situation_product_scale" },
    ],
  },

  // Preguntas transversales de situación — Producto
  situation_product_scratch: {
    questionKey: "q4_situation",
    options: [
      { labelKey: "q4_situation_a", result: "result_product_scratch_urgent" },
      { labelKey: "q4_situation_b", result: "result_product_scratch" },
      { labelKey: "q4_situation_c", result: "result_product_scratch_internal" },
    ],
  },
  situation_product_pivot: {
    questionKey: "q4_situation",
    options: [
      { labelKey: "q4_situation_a", result: "result_product_pivot_urgent" },
      { labelKey: "q4_situation_b", result: "result_product_pivot" },
      { labelKey: "q4_situation_c", result: "result_product_pivot_internal" },
    ],
  },
  situation_product_scale: {
    questionKey: "q4_situation",
    options: [
      { labelKey: "q4_situation_a", result: "result_product_scale_urgent" },
      { labelKey: "q4_situation_b", result: "result_product_scale" },
      { labelKey: "q4_situation_c", result: "result_product_scale_internal" },
    ],
  },
  situation_product_strategy: {
    questionKey: "q4_situation",
    options: [
      { labelKey: "q4_situation_a", result: "result_product_strategy_urgent" },
      { labelKey: "q4_situation_b", result: "result_product_strategy" },
      { labelKey: "q4_situation_c", result: "result_product_strategy_internal" },
    ],
  },

  // ═══════════════════════════════════════════════
  // RAMA UX
  // ═══════════════════════════════════════════════
  ux_depth: {
    questionKey: "q2_ux",
    options: [
      { labelKey: "q2_ux_a", next: "ux_data" },
      { labelKey: "q2_ux_b", next: "ux_scope" },
      { labelKey: "q2_ux_c", next: "ux_data" },
    ],
  },
  ux_data: {
    questionKey: "q3_ux",
    options: [
      { labelKey: "q3_ux_a", next: "situation_ux_audit" },
      { labelKey: "q3_ux_b", next: "situation_ux_redesign" },
      { labelKey: "q3_ux_c", next: "situation_ux_research" },
    ],
  },
  ux_scope: {
    questionKey: "q3_ux_scope",
    options: [
      { labelKey: "q3_ux_scope_a", next: "situation_ux_redesign" },
      { labelKey: "q3_ux_scope_b", next: "situation_ux_redesign" },
      { labelKey: "q3_ux_scope_c", next: "situation_ux_audit" },
    ],
  },

  // Preguntas transversales de situación — UX
  situation_ux_audit: {
    questionKey: "q4_situation",
    options: [
      { labelKey: "q4_situation_a", result: "result_ux_audit_urgent" },
      { labelKey: "q4_situation_b", result: "result_ux_audit" },
      { labelKey: "q4_situation_c", result: "result_ux_audit_internal" },
    ],
  },
  situation_ux_redesign: {
    questionKey: "q4_situation",
    options: [
      { labelKey: "q4_situation_a", result: "result_ux_redesign_urgent" },
      { labelKey: "q4_situation_b", result: "result_ux_redesign" },
      { labelKey: "q4_situation_c", result: "result_ux_redesign_internal" },
    ],
  },
  situation_ux_research: {
    questionKey: "q4_situation",
    options: [
      { labelKey: "q4_situation_a", result: "result_ux_research_urgent" },
      { labelKey: "q4_situation_b", result: "result_ux_research" },
      { labelKey: "q4_situation_c", result: "result_ux_research_internal" },
    ],
  },

  // ═══════════════════════════════════════════════
  // RAMA DISEÑO
  // ═══════════════════════════════════════════════
  design_depth: {
    questionKey: "q2_design",
    options: [
      { labelKey: "q2_design_a", next: "design_brand_detail" },
      { labelKey: "q2_design_b", next: "design_ui_detail" },
      { labelKey: "q2_design_c", next: "design_dashboard_detail" },
    ],
  },
  design_brand_detail: {
    questionKey: "q3_design_brand",
    options: [
      { labelKey: "q3_design_brand_a", next: "situation_design_brand" },
      { labelKey: "q3_design_brand_b", next: "situation_design_brand" },
      { labelKey: "q3_design_brand_c", next: "situation_design_ui" },
    ],
  },
  design_ui_detail: {
    questionKey: "q3_design_ui",
    options: [
      { labelKey: "q3_design_ui_a", next: "situation_design_ui" },
      { labelKey: "q3_design_ui_b", next: "situation_design_ui" },
      { labelKey: "q3_design_ui_c", next: "situation_design_brand" },
    ],
  },
  design_dashboard_detail: {
    questionKey: "q3_design_dashboard",
    options: [
      { labelKey: "q3_design_dashboard_a", next: "situation_design_dashboard" },
      { labelKey: "q3_design_dashboard_b", next: "situation_design_dashboard" },
      { labelKey: "q3_design_dashboard_c", next: "situation_design_ui" },
    ],
  },

  // Preguntas transversales de situación — Diseño
  situation_design_brand: {
    questionKey: "q4_situation",
    options: [
      { labelKey: "q4_situation_a", result: "result_design_brand_urgent" },
      { labelKey: "q4_situation_b", result: "result_design_brand" },
      { labelKey: "q4_situation_c", result: "result_design_brand_internal" },
    ],
  },
  situation_design_ui: {
    questionKey: "q4_situation",
    options: [
      { labelKey: "q4_situation_a", result: "result_design_ui_urgent" },
      { labelKey: "q4_situation_b", result: "result_design_ui" },
      { labelKey: "q4_situation_c", result: "result_design_ui_internal" },
    ],
  },
  situation_design_dashboard: {
    questionKey: "q4_situation",
    options: [
      { labelKey: "q4_situation_a", result: "result_design_dashboard_urgent" },
      { labelKey: "q4_situation_b", result: "result_design_dashboard" },
      { labelKey: "q4_situation_c", result: "result_design_dashboard_internal" },
    ],
  },

  // ═══════════════════════════════════════════════
  // RAMA TECH
  // ═══════════════════════════════════════════════
  tech_depth: {
    questionKey: "q2_tech",
    options: [
      { labelKey: "q2_tech_a", next: "tech_build_detail" },
      { labelKey: "q2_tech_b", next: "tech_legacy_detail" },
      { labelKey: "q2_tech_c", next: "tech_ai_detail" },
    ],
  },
  tech_build_detail: {
    questionKey: "q3_tech_build",
    options: [
      { labelKey: "q3_tech_build_a", next: "situation_tech_build" },
      { labelKey: "q3_tech_build_b", next: "situation_tech_build" },
      { labelKey: "q3_tech_build_c", next: "situation_tech_build" },
    ],
  },
  tech_legacy_detail: {
    questionKey: "q3_tech_legacy",
    options: [
      { labelKey: "q3_tech_legacy_a", next: "situation_tech_legacy" },
      { labelKey: "q3_tech_legacy_b", next: "situation_tech_legacy" },
      { labelKey: "q3_tech_legacy_c", next: "situation_tech_legacy" },
    ],
  },
  tech_ai_detail: {
    questionKey: "q3_tech_ai",
    options: [
      { labelKey: "q3_tech_ai_a", next: "situation_tech_ai" },
      { labelKey: "q3_tech_ai_b", next: "situation_tech_ai" },
      { labelKey: "q3_tech_ai_c", next: "situation_tech_build" },
    ],
  },

  // Preguntas transversales de situación — Tech
  situation_tech_build: {
    questionKey: "q4_situation",
    options: [
      { labelKey: "q4_situation_a", result: "result_tech_build_urgent" },
      { labelKey: "q4_situation_b", result: "result_tech_build" },
      { labelKey: "q4_situation_c", result: "result_tech_build_internal" },
    ],
  },
  situation_tech_legacy: {
    questionKey: "q4_situation",
    options: [
      { labelKey: "q4_situation_a", result: "result_tech_legacy_urgent" },
      { labelKey: "q4_situation_b", result: "result_tech_legacy" },
      { labelKey: "q4_situation_c", result: "result_tech_legacy_internal" },
    ],
  },
  situation_tech_ai: {
    questionKey: "q4_situation",
    options: [
      { labelKey: "q4_situation_a", result: "result_tech_ai_urgent" },
      { labelKey: "q4_situation_b", result: "result_tech_ai" },
      { labelKey: "q4_situation_c", result: "result_tech_ai_internal" },
    ],
  },
};

// ═══════════════════════════════════════════════════════════════
// Mapeo de resultados a claves de intereses del formulario de contacto.
// interestKeys referencia las claves interest_N del diccionario de contacto.
// Cada resultado base tiene variantes _urgent e _internal que comparten
// categoría e intereses pero ofrecen textos de resultado distintos.
// ═══════════════════════════════════════════════════════════════
export const diagnosticResults = {
  // --- Producto ---
  result_product_scratch:          { resultKey: "result_product_scratch",          category: "PRODUCT", interestKeys: ["interest_1", "interest_3"] },
  result_product_scratch_urgent:   { resultKey: "result_product_scratch_urgent",   category: "PRODUCT", interestKeys: ["interest_1", "interest_3"] },
  result_product_scratch_internal: { resultKey: "result_product_scratch_internal", category: "PRODUCT", interestKeys: ["interest_1", "interest_3", "interest_5"] },

  result_product_pivot:          { resultKey: "result_product_pivot",          category: "PRODUCT", interestKeys: ["interest_3", "interest_2"] },
  result_product_pivot_urgent:   { resultKey: "result_product_pivot_urgent",   category: "PRODUCT", interestKeys: ["interest_3", "interest_2"] },
  result_product_pivot_internal: { resultKey: "result_product_pivot_internal", category: "PRODUCT", interestKeys: ["interest_3", "interest_2", "interest_5"] },

  result_product_scale:          { resultKey: "result_product_scale",          category: "PRODUCT", interestKeys: ["interest_3", "interest_6"] },
  result_product_scale_urgent:   { resultKey: "result_product_scale_urgent",   category: "PRODUCT", interestKeys: ["interest_3", "interest_6"] },
  result_product_scale_internal: { resultKey: "result_product_scale_internal", category: "PRODUCT", interestKeys: ["interest_3", "interest_6", "interest_5"] },

  result_product_strategy:          { resultKey: "result_product_strategy",          category: "PRODUCT", interestKeys: ["interest_3", "interest_5"] },
  result_product_strategy_urgent:   { resultKey: "result_product_strategy_urgent",   category: "PRODUCT", interestKeys: ["interest_3", "interest_5"] },
  result_product_strategy_internal: { resultKey: "result_product_strategy_internal", category: "PRODUCT", interestKeys: ["interest_3", "interest_5"] },

  // --- UX ---
  result_ux_audit:          { resultKey: "result_ux_audit",          category: "UX", interestKeys: ["interest_5"] },
  result_ux_audit_urgent:   { resultKey: "result_ux_audit_urgent",   category: "UX", interestKeys: ["interest_5"] },
  result_ux_audit_internal: { resultKey: "result_ux_audit_internal", category: "UX", interestKeys: ["interest_5"] },

  result_ux_redesign:          { resultKey: "result_ux_redesign",          category: "UX", interestKeys: ["interest_2", "interest_5"] },
  result_ux_redesign_urgent:   { resultKey: "result_ux_redesign_urgent",   category: "UX", interestKeys: ["interest_2", "interest_5"] },
  result_ux_redesign_internal: { resultKey: "result_ux_redesign_internal", category: "UX", interestKeys: ["interest_2", "interest_5"] },

  result_ux_research:          { resultKey: "result_ux_research",          category: "UX", interestKeys: ["interest_5"] },
  result_ux_research_urgent:   { resultKey: "result_ux_research_urgent",   category: "UX", interestKeys: ["interest_5"] },
  result_ux_research_internal: { resultKey: "result_ux_research_internal", category: "UX", interestKeys: ["interest_5"] },

  // --- Diseño ---
  result_design_brand:          { resultKey: "result_design_brand",          category: "DESIGN", interestKeys: ["interest_2"] },
  result_design_brand_urgent:   { resultKey: "result_design_brand_urgent",   category: "DESIGN", interestKeys: ["interest_2"] },
  result_design_brand_internal: { resultKey: "result_design_brand_internal", category: "DESIGN", interestKeys: ["interest_2"] },

  result_design_ui:          { resultKey: "result_design_ui",          category: "DESIGN", interestKeys: ["interest_2", "interest_7"] },
  result_design_ui_urgent:   { resultKey: "result_design_ui_urgent",   category: "DESIGN", interestKeys: ["interest_2", "interest_7"] },
  result_design_ui_internal: { resultKey: "result_design_ui_internal", category: "DESIGN", interestKeys: ["interest_2", "interest_7"] },

  result_design_dashboard:          { resultKey: "result_design_dashboard",          category: "DESIGN", interestKeys: ["interest_7"] },
  result_design_dashboard_urgent:   { resultKey: "result_design_dashboard_urgent",   category: "DESIGN", interestKeys: ["interest_7"] },
  result_design_dashboard_internal: { resultKey: "result_design_dashboard_internal", category: "DESIGN", interestKeys: ["interest_7"] },

  // --- Tech ---
  result_tech_build:          { resultKey: "result_tech_build",          category: "TECH", interestKeys: ["interest_6"] },
  result_tech_build_urgent:   { resultKey: "result_tech_build_urgent",   category: "TECH", interestKeys: ["interest_6"] },
  result_tech_build_internal: { resultKey: "result_tech_build_internal", category: "TECH", interestKeys: ["interest_6"] },

  result_tech_legacy:          { resultKey: "result_tech_legacy",          category: "TECH", interestKeys: ["interest_4"] },
  result_tech_legacy_urgent:   { resultKey: "result_tech_legacy_urgent",   category: "TECH", interestKeys: ["interest_4"] },
  result_tech_legacy_internal: { resultKey: "result_tech_legacy_internal", category: "TECH", interestKeys: ["interest_4"] },

  result_tech_ai:          { resultKey: "result_tech_ai",          category: "TECH", interestKeys: ["interest_8"] },
  result_tech_ai_urgent:   { resultKey: "result_tech_ai_urgent",   category: "TECH", interestKeys: ["interest_8"] },
  result_tech_ai_internal: { resultKey: "result_tech_ai_internal", category: "TECH", interestKeys: ["interest_8"] },
};
