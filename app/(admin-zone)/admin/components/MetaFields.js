"use client";

import { META_DESCRIPTION_MAX, META_TITLE_MAX } from "@/app/lib/postMeta";

// Lo que Google ve del post en un idioma: el <title> corto y la meta
// description, con su contador. Vacíos, la web usa el título del post y un
// extracto del cuerpo.
function Contador({ valor, max }) {
  const n = [...(valor || "")].length;
  return (
    <span className={`text-xs font-mono ${n > max ? "text-red-600 font-bold" : "text-gray-400"}`}>
      {n}/{max}
    </span>
  );
}

export default function MetaFields({ lang, formData, onChange }) {
  const titulo = `metaTitle_${lang}`;
  const descripcion = `metaDescription_${lang}`;
  return (
    <div className="space-y-3 rounded-2xl bg-gray-50 p-4">
      <p className="text-xs font-bold uppercase tracking-widest text-gray-400">Google · {lang.toUpperCase()}</p>
      <label className="block space-y-1">
        <span className="flex justify-between text-sm font-bold text-gray-600">
          Título para Google (sin “ | Room 714”)
          <Contador valor={formData[titulo]} max={META_TITLE_MAX} />
        </span>
        <input
          name={titulo}
          value={formData[titulo]}
          onChange={onChange}
          placeholder="Vacío: se usa el título del post"
          className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 outline-none focus:border-black"
        />
      </label>
      <label className="block space-y-1">
        <span className="flex justify-between text-sm font-bold text-gray-600">
          Meta description
          <Contador valor={formData[descripcion]} max={META_DESCRIPTION_MAX} />
        </span>
        <textarea
          name={descripcion}
          value={formData[descripcion]}
          onChange={onChange}
          rows={3}
          placeholder="Vacía: Google ve el principio del artículo"
          className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 outline-none focus:border-black"
        />
      </label>
    </div>
  );
}
