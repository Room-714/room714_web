import { prisma } from "@/app/lib/prisma";
import { campanaDeQuery, CLAVES_CAMPANA } from "@/app/lib/campana";

// Guarda un contacto en la tabla Lead. Nunca lanza: si la base de datos
// falla (o la tabla aún no existe en producción), el email sigue saliendo y
// el contacto no se pierde, porque el email lleva los mismos datos.

const CORTE = 500;
const recorta = (v, max = CORTE) =>
  typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null;

/** Normaliza los parámetros de campaña que manda el cliente. */
export function normalizarCampana(campana) {
  if (!campana || typeof campana !== "object") return {};
  const query = new URLSearchParams();
  for (const clave of CLAVES_CAMPANA) {
    if (typeof campana[clave] === "string") query.set(clave, campana[clave]);
  }
  return campanaDeQuery(query.toString());
}

export async function guardarLead({
  origen,
  email,
  nombre,
  empresa,
  mensaje,
  situacion,
  empleados,
  respuestas,
  campana,
}) {
  const c = normalizarCampana(campana);
  try {
    const lead = await prisma.lead.create({
      data: {
        origen,
        email: recorta(email, 320),
        nombre: recorta(nombre),
        empresa: recorta(empresa),
        mensaje: recorta(mensaje, 5000),
        situacion: recorta(situacion),
        empleados: recorta(empleados),
        respuestas: respuestas ?? undefined,
        utmSource: c.utm_source ?? null,
        utmMedium: c.utm_medium ?? null,
        utmCampaign: c.utm_campaign ?? null,
        utmTerm: c.utm_term ?? null,
        gclid: c.gclid ?? null,
      },
      select: { id: true },
    });
    return lead.id;
  } catch (error) {
    console.error("Lead: no se pudo guardar el contacto", error?.message);
    return null;
  }
}
