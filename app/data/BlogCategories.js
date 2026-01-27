// Estos son los que coinciden EXACTAMENTE con tu Enum de Prisma
export const CATEGORY_IDS = ["TECH", "DESIGN", "PRODUCT", "UX"];

// Añadimos "ALL" solo para la lógica de la interfaz de usuario
export const FILTER_CATEGORIES = ["ALL", ...CATEGORY_IDS];

export const CATEGORY_LABELS = {
  TECH: { es: "Tecnología", en: "Tech Insights" },
  DESIGN: { es: "Diseño UX&UI", en: "UX&UI Design" },
  PRODUCT: { es: "Producto", en: "Product Management" },
  UX: { es: "Experiencia de Usuario", en: "User Experience" },
  ALL: { es: "Todos", en: "All" },
};
