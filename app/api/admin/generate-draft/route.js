import { NextResponse } from "next/server";
import { generateDraftForToday } from "@/app/lib/ai/orchestrator";
import { isAuthorizedAdmin } from "@/app/lib/auth";

export const maxDuration = 300;

const VALID_CATEGORIES = ["TECH", "PRODUCT", "UX", "DESIGN"];

// Temas descartados con "Elegir otro ángulo". Acotados: van al prompt.
function limpiarEvitar(evitar) {
  if (!Array.isArray(evitar)) return [];
  return evitar
    .filter((t) => typeof t === "string" && t.trim())
    .map((t) => t.trim().slice(0, 200))
    .slice(0, 10);
}

async function handle(request, options) {
  if (!(await isAuthorizedAdmin(request))) {
    return new Response("No autorizado", { status: 401 });
  }

  const categoryOverride = options.category;
  if (categoryOverride && !VALID_CATEGORIES.includes(categoryOverride)) {
    return NextResponse.json(
      { error: `Categoría inválida. Usa una de: ${VALID_CATEGORIES.join(", ")}` },
      { status: 400 },
    );
  }

  const sendEmail = options.sendEmail !== false;
  const tema = typeof options.tema === "string" && options.tema.trim() ? options.tema.trim().slice(0, 200) : undefined;

  try {
    // Desde el panel, un duplicado no se genera: se devuelve para el aviso
    // ("Ampliar el existente" / "Elegir otro ángulo"). `preview` comprueba
    // sin generar ni escribir.
    const result = await generateDraftForToday({
      categoryOverride,
      sendEmail,
      tema,
      evitar: limpiarEvitar(options.evitar),
      alDuplicar: "avisar",
      preview: options.preview === true,
    });
    return NextResponse.json(result);
  } catch (error) {
    console.error("Error en admin/generate-draft:", error);
    return NextResponse.json(
      { error: error.message, stack: error.stack },
      { status: 500 },
    );
  }
}

export async function POST(request) {
  const body = await request.json().catch(() => ({}));
  return handle(request, {
    category: body.category,
    sendEmail: body.sendEmail,
    tema: body.tema,
    evitar: body.evitar,
    preview: body.preview,
  });
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  return handle(request, {
    category: searchParams.get("category"),
    sendEmail: searchParams.get("sendEmail") !== "false",
    tema: searchParams.get("tema") ?? undefined,
    evitar: searchParams.getAll("evitar"),
    preview: searchParams.get("preview") === "1",
  });
}
