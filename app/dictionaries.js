// app/dictionaries.js
const dictionaries = {
  // Nota el './' porque ahora la carpeta está en el mismo nivel que este archivo
  en: () => import("./dictionaries/en.json").then((module) => module.default),
};

export const getDictionary = async (locale) => {
  // Aseguramos que locale sea un string y exista, si no, por defecto 'en'
  const key =
    typeof locale === "string" && dictionaries[locale] ? locale : "en";

  try {
    return await dictionaries[key]();
  } catch (error) {
    console.error("Error cargando diccionario:", error);
    // Retorno de emergencia para que la web no se quede en blanco
    return dictionaries["en"]();
  }
};
