import { NextResponse } from "next/server";
import { Resend } from "resend";

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
    const { name, email, message, interests } = body;

    // Formateamos los intereses para evitar errores si el array está vacío
    const formattedInterests =
      Array.isArray(interests) && interests.length > 0
        ? interests.join(", ")
        : "No interests selected";

    const { data, error } = await resend.emails.send({
      // Remitente grabado a fuego para cuentas gratuitas sin dominio verificado
      from: "Room 714 <onboarding@resend.dev>",
      // Aquí debes poner el correo donde TÚ quieres recibir los mensajes
      to: ["joseantonio.cesfranjo@room714.com"],
      // El reply_to permite que al darle a "Responder" en tu mail, le escribas al cliente
      reply_to: email,
      subject: `New Project Inquiry from ${name}`,
      html: `
        <div style="font-family: sans-serif; color: #333; max-width: 600px;">
          <h2 style="border-bottom: 1px solid #eee; padding-bottom: 10px;">New Contact Form Submission</h2>
          <p><strong>Name:</strong> ${name}</p>
          <p><strong>Email:</strong> ${email}</p>
          <p><strong>Interests:</strong> ${formattedInterests}</p>
          <p style="margin-top: 20px;"><strong>Message:</strong></p>
          <div style="background: #f9f9f9; padding: 20px; border-radius: 12px; border: 1px solid #eee; line-height: 1.6;">
            ${message}
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
