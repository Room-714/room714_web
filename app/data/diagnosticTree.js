// Árbol de decisión para el diagnóstico de necesidades del cliente.
// Cada nodo tiene: question (clave i18n), options con next (siguiente nodo) o result (diagnóstico final).
// Los resultados mapean a intereses del formulario de contacto para prellenar.

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

  // --- RAMA PRODUCTO ---
  product_depth: {
    questionKey: "q2_product",
    options: [
      { labelKey: "q2_product_a", next: "product_stage" },
      { labelKey: "q2_product_b", next: "product_stage" },
      { labelKey: "q2_product_c", result: "result_product_strategy" },
    ],
  },
  product_stage: {
    questionKey: "q3_product",
    options: [
      { labelKey: "q3_product_a", result: "result_product_scratch" },
      { labelKey: "q3_product_b", result: "result_product_pivot" },
      { labelKey: "q3_product_c", result: "result_product_scale" },
    ],
  },

  // --- RAMA UX ---
  ux_depth: {
    questionKey: "q2_ux",
    options: [
      { labelKey: "q2_ux_a", next: "ux_data" },
      { labelKey: "q2_ux_b", result: "result_ux_redesign" },
      { labelKey: "q2_ux_c", result: "result_ux_audit" },
    ],
  },
  ux_data: {
    questionKey: "q3_ux",
    options: [
      { labelKey: "q3_ux_a", result: "result_ux_audit" },
      { labelKey: "q3_ux_b", result: "result_ux_redesign" },
      { labelKey: "q3_ux_c", result: "result_ux_research" },
    ],
  },

  // --- RAMA DISEÑO ---
  design_depth: {
    questionKey: "q2_design",
    options: [
      { labelKey: "q2_design_a", result: "result_design_brand" },
      { labelKey: "q2_design_b", result: "result_design_ui" },
      { labelKey: "q2_design_c", result: "result_design_dashboard" },
    ],
  },

  // --- RAMA TECH ---
  tech_depth: {
    questionKey: "q2_tech",
    options: [
      { labelKey: "q2_tech_a", result: "result_tech_build" },
      { labelKey: "q2_tech_b", result: "result_tech_legacy" },
      { labelKey: "q2_tech_c", result: "result_tech_ai" },
    ],
  },
};

// Mapeo de resultados a claves de intereses del formulario de contacto.
// interestKeys referencia las claves interest_N del diccionario de contacto.
export const diagnosticResults = {
  result_product_scratch: {
    resultKey: "result_product_scratch",
    category: "PRODUCT",
    interestKeys: ["interest_1", "interest_3"],
  },
  result_product_pivot: {
    resultKey: "result_product_pivot",
    category: "PRODUCT",
    interestKeys: ["interest_3", "interest_2"],
  },
  result_product_scale: {
    resultKey: "result_product_scale",
    category: "PRODUCT",
    interestKeys: ["interest_3", "interest_6"],
  },
  result_product_strategy: {
    resultKey: "result_product_strategy",
    category: "PRODUCT",
    interestKeys: ["interest_3", "interest_5"],
  },
  result_ux_audit: {
    resultKey: "result_ux_audit",
    category: "UX",
    interestKeys: ["interest_5"],
  },
  result_ux_redesign: {
    resultKey: "result_ux_redesign",
    category: "UX",
    interestKeys: ["interest_2", "interest_5"],
  },
  result_ux_research: {
    resultKey: "result_ux_research",
    category: "UX",
    interestKeys: ["interest_5"],
  },
  result_design_brand: {
    resultKey: "result_design_brand",
    category: "DESIGN",
    interestKeys: ["interest_2"],
  },
  result_design_ui: {
    resultKey: "result_design_ui",
    category: "DESIGN",
    interestKeys: ["interest_2", "interest_7"],
  },
  result_design_dashboard: {
    resultKey: "result_design_dashboard",
    category: "DESIGN",
    interestKeys: ["interest_7"],
  },
  result_tech_build: {
    resultKey: "result_tech_build",
    category: "TECH",
    interestKeys: ["interest_6"],
  },
  result_tech_legacy: {
    resultKey: "result_tech_legacy",
    category: "TECH",
    interestKeys: ["interest_4"],
  },
  result_tech_ai: {
    resultKey: "result_tech_ai",
    category: "TECH",
    interestKeys: ["interest_8"],
  },
};
