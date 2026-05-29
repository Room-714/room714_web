import { NextResponse } from "next/server";
import { isAuthorizedAdmin } from "@/app/lib/auth";
import { claimOwnership } from "@/app/lib/seo/siteVerificationApi";

export const maxDuration = 60;

export async function POST(request) {
  if (!(await isAuthorizedAdmin(request))) {
    return new Response("No autorizado", { status: 401 });
  }
  try {
    const result = await claimOwnership();
    return NextResponse.json({ success: true, result });
  } catch (err) {
    console.error("[claim-ownership] Fallo:", err);
    return NextResponse.json(
      { success: false, error: err.message, stack: err.stack },
      { status: 500 },
    );
  }
}
