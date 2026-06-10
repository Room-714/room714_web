import { Resend } from "resend";

const FROM = "Room 714 RRHH <rrhh@room714.com>";

const COPY = {
  es: {
    subject: "Gracias por tu interés en Room 714",
    greeting: (name) =>
      name ? `Hola ${name.split(" ")[0]},` : "Hola,",
    body: [
      "Hemos recibido tu CV. Gracias por pensar en Room 714 para tu próximo movimiento.",
      "Una nota práctica: los CVs envejecen rápido — uno de hace unos meses ya no refleja en quién te has convertido. Por eso conservamos los que recibimos un máximo de <strong>1 mes</strong>. Pasado ese plazo, lo borramos automáticamente.",
      "Si en este tiempo no nos ponemos en contacto, es porque en este momento no tenemos una posición abierta que encaje con tu perfil. No es nada personal: es la realidad de un equipo pequeño que sólo abre vacantes cuando hay trabajo real esperando.",
      'Cuando tengamos vacantes, las anunciamos en nuestras redes. Si te interesa estar al tanto, síguenos en <a href="https://www.linkedin.com/company/room-714" style="color:#E63946;text-decoration:underline;">LinkedIn</a>.',
    ],
    signature: "Un saludo,<br>El equipo de Room 714",
    noReply:
      "Este correo se envía desde una cuenta que no monitorizamos. Si necesitas escribirnos, hazlo a <a href='mailto:hello@room714.com' style='color:#E63946;'>hello@room714.com</a>.",
  },
  en: {
    subject: "Thanks for your interest in Room 714",
    greeting: (name) =>
      name ? `Hi ${name.split(" ")[0]},` : "Hi,",
    body: [
      "We've received your CV. Thank you for considering Room 714 for your next move.",
      "One practical note: CVs age fast — one from a few months ago no longer reflects who you've become. That's why we keep what we receive for a maximum of <strong>1 month</strong>. After that, it's deleted automatically.",
      "If we don't reach out in that time, it's because we don't currently have an open position that fits your profile. Nothing personal — that's just the reality of a small team that only opens roles when there's real work waiting.",
      'When we have openings, we announce them on our socials. To stay in the loop, follow us on <a href="https://www.linkedin.com/company/room-714" style="color:#E63946;text-decoration:underline;">LinkedIn</a>.',
    ],
    signature: "Best,<br>The Room 714 team",
    noReply:
      "This message is sent from an unmonitored address. To reach us, write to <a href='mailto:hello@room714.com' style='color:#E63946;'>hello@room714.com</a>.",
  },
};

export async function sendCandidateThanksEmail({ to, name, lang = "es" }) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn("RESEND_API_KEY no configurada, saltando thanks al candidato");
    return { success: false, skipped: true };
  }
  if (!to) {
    return { success: false, skipped: true, reason: "no email" };
  }

  const t = COPY[lang] || COPY.es;
  const resend = new Resend(apiKey);

  const bodyHtml = t.body.map((p) => `<p style="margin:0 0 14px 0;">${p}</p>`).join("");

  try {
    const { error } = await resend.emails.send({
      from: FROM,
      to: [to],
      replyTo: "no-reply@room714.com",
      subject: t.subject,
      html: `
<div style="font-family: -apple-system, Segoe UI, sans-serif; color: #222; max-width: 600px; margin: 0 auto; padding: 24px;">
  <p style="font-size: 16px; margin: 0 0 18px 0;">${t.greeting(name)}</p>
  <div style="font-size: 15px; line-height: 1.6;">
    ${bodyHtml}
  </div>
  <p style="font-size: 15px; line-height: 1.6; margin-top: 28px;">${t.signature}</p>
  <hr style="border:none; border-top: 1px solid #eee; margin: 28px 0 14px 0;">
  <p style="font-size: 12px; color: #888; line-height: 1.5;">${t.noReply}</p>
</div>
      `,
    });

    if (error) {
      console.error("Resend error candidateThanks:", error);
      return { success: false, error };
    }
    return { success: true };
  } catch (error) {
    console.error("candidateThanks email error:", error);
    return { success: false, error: error.message };
  }
}
