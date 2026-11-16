import { NextResponse } from "next/server";
import { Resend } from "resend";
import { guardarLead, normalizarCampana } from "@/app/lib/leads/guardar";
import { BUZON_CONTACTO, REMITENTE, escaparHtml } from "@/app/lib/leads/email";
import { ORIGENES } from "@/app/data/formacionIa";

const ORIGENES_VALIDOS = new Set([ORIGENES.hablemos, ORIGENES.landing]);

export async function POST(req) {
  const apiKey = process.env.RESEND_API_KEY;

  console.log(
    "Comprobando API KEY:",
    apiKey ? apiKey.substring(0, 4) + "..." : "ESTÁ VACÍA"
  );

  if (!apiKey) {
    console.error("Error: RESEND_API_KEY no configurada en .env.local");
    return NextResponse.json(
      { error: "Email service misconfigured" },
      { status: 500 }
    );
  }

  const resend = new Resend(apiKey);

  try {
    const body = await req.json();
    const { name, email, company, message, interests, employees, campana } = body;
    // El origen solo puede ser uno de los conocidos; cualquier otra cosa es
    // el formulario de siempre.
    const origen = ORIGENES_VALIDOS.has(body.origen) ? body.origen : ORIGENES.hablemos;
    const c = normalizarCampana(campana);

    // Formateamos los intereses para evitar errores si el array está vacío
    const formattedInterests =
      Array.isArray(interests) && interests.length > 0
        ? interests.join(", ")
        : "No interests selected";

    // Se guarda antes de enviar: si el email falla, el contacto queda.
    // guardarLead nunca lanza.
    await guardarLead({
      origen,
      email,
      nombre: name,
      empresa: company,
      mensaje: message,
      situacion: Array.isArray(interests) ? interests.join(", ") : null,
      empleados: employees,
      campana: c,
    });

    const e = escaparHtml;
    const filaCampana = Object.keys(c).length
      ? `<p><strong>Campaign:</strong> ${e(Object.entries(c).map(([k, v]) => `${k}=${v}`).join(" · "))}</p>`
      : "";

    const { data, error } = await resend.emails.send({
      from: REMITENTE,
      to: [BUZON_CONTACTO],
      // replyTo (no reply_to: el SDK de Resend descarta la forma con guion
      // bajo) permite que al darle a "Responder" le escribas al cliente.
      replyTo: email,
      subject:
        origen === ORIGENES.landing
          ? `New Project Inquiry from ${name} · Formación IA`
          : `New Project Inquiry from ${name}`,
      html: `
        <div style="font-family: sans-serif; color: #333; max-width: 600px;">
          <h2 style="border-bottom: 1px solid #eee; padding-bottom: 10px;">New Contact Form Submission</h2>
          <p><strong>Source:</strong> ${e(origen)}</p>
          <p><strong>Name:</strong> ${e(name)}</p>
          <p><strong>Email:</strong> ${e(email)}</p>
          <p><strong>Company:</strong> ${e(company || "—")}</p>
          ${origen === ORIGENES.landing ? `<p><strong>Employees:</strong> ${e(employees || "—")}</p>` : `<p><strong>Situation:</strong> ${e(formattedInterests)}</p>`}
          ${filaCampana}
          <p style="margin-top: 20px;"><strong>Message:</strong></p>
          <div style="background: #f9f9f9; padding: 20px; border-radius: 12px; border: 1px solid #eee; line-height: 1.6; white-space: pre-wrap;">
            ${e(message)}
          </div>
          <footer style="margin-top: 30px; font-size: 12px; color: #999;">
            This email was sent from the Room 714 contact form.
          </footer>
        </div>
      `,
    });

    if (error) {
      console.error("Resend Error:", error);
      return NextResponse.json({ error }, { status: 500 });
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error("Catch Error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
