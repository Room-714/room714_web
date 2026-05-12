import { NextResponse } from "next/server";
import { generateDraftForToday } from "@/app/lib/ai/orchestrator";
import { isAuthorizedAdmin } from "@/app/lib/auth";

export const maxDuration = 300;

const VALID_CATEGORIES = ["TECH", "PRODUCT", "UX", "DESIGN"];

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

  try {
    const result = await generateDraftForToday({
      categoryOverride,
      sendEmail,
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
  });
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  return handle(request, {
    category: searchParams.get("category"),
    sendEmail: searchParams.get("sendEmail") !== "false",
  });
}
