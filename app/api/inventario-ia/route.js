import { NextResponse } from "next/server";
import { Resend } from "resend";
import {
  diagnostico,
  respuestasLegibles,
  validarRespuestas,
} from "@/app/lib/inventarioIa";
import { guardarLead, normalizarCampana } from "@/app/lib/leads/guardar";
import {
  BUZON_CONTACTO,
  REMITENTE,
  REMITENTE_CLIENTES,
  RESPONDER_A,
  emailValido,
  escaparHtml as e,
} from "@/app/lib/leads/email";
import {
  ASUNTO_INVENTARIO,
  htmlInventario,
  textoInventario,
} from "@/app/lib/leads/emailInventario";
import { ORIGENES } from "@/app/data/incorporarIa";

// Recibe el cuestionario de IA cuando el usuario pide el diagnóstico completo
// por email. Es el primer momento en que las respuestas salen del navegador.
//
// El diagnóstico se recalcula aquí con las mismas reglas que el navegador, y el
// email no lleva nada escrito por el cliente salvo su dirección: este
// endpoint no sirve para mandar texto arbitrario a terceros.
//
// Logs: una línea al ir bien y otra al fallar, SIN datos personales (ni el
// email ni las respuestas): solo nivel y si viene de campaña.

/** Lo que se puede registrar de un error de Resend sin datos personales. */
const errorSeguro = (error) => ({ name: error?.name ?? null, statusCode: error?.statusCode ?? null });
export async function POST(req) {
  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  // Campo trampa: invisible para personas, los bots lo rellenan. Se responde
  // como si hubiera ido bien para no darles pistas.
  if (body?.web) return NextResponse.json({ success: true });

  const email = typeof body?.email === "string" ? body.email.trim() : "";
  if (!emailValido(email)) {
    console.error("[inventario-ia] error", { motivo: "email no válido" });
    return NextResponse.json({ error: "Email no válido" }, { status: 400 });
  }
  // La política de privacidad se informa junto al botón de enviar: no hay
  // casilla que marcar, así que `acepta` ya no se exige. No es un
  // consentimiento para comunicaciones comerciales: el correo solo se usa para
  // enviar el diagnóstico pedido y contestar.
  const respuestas = validarRespuestas(body.respuestas);
  if (!respuestas) {
    console.error("[inventario-ia] error", { motivo: "respuestas no válidas" });
    return NextResponse.json({ error: "Respuestas no válidas" }, { status: 400 });
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.error("[inventario-ia] error", { motivo: "RESEND_API_KEY no configurada" });
    return NextResponse.json({ error: "Email no configurado" }, { status: 500 });
  }

  const d = diagnostico(respuestas);
  const campana = normalizarCampana(body.campana);

  // Se guarda antes de enviar; guardarLead nunca lanza.
  await guardarLead({
    origen: ORIGENES.inventario,
    email,
    respuestas: {
      respuestas,
      legibles: respuestasLegibles(respuestas),
      diagnostico: { nivel: d.nivel, pasos: d.pasos },
    },
    campana,
  });

  const resend = new Resend(apiKey);
  const { error } = await resend.emails.send({
    from: REMITENTE_CLIENTES,
    to: [email],
    replyTo: RESPONDER_A,
    subject: ASUNTO_INVENTARIO,
    html: htmlInventario(d),
    text: textoInventario(d),
  });

  if (error) {
    console.error("[inventario-ia] error", { motivo: "Resend", nivel: d.nivel, ...errorSeguro(error) });
    return NextResponse.json({ error: "No se pudo enviar" }, { status: 502 });
  }

  // Aviso interno. Si falla, el usuario ya tiene su email y el contacto está
  // guardado: no se le devuelve error por esto.
  try {
    const filas = respuestasLegibles(respuestas)
      .map(
        (r) =>
          `<p><strong>${e(r.pregunta)}</strong><br>${e(r.respuestas.join(" · "))}</p>`,
      )
      .join("");
    const filaCampana = Object.keys(campana).length
      ? `<p><strong>Campaña:</strong> ${e(
          Object.entries(campana)
            .map(([k, v]) => `${k}=${v}`)
            .join(" · "),
        )}</p>`
      : "";
    await resend.emails.send({
      from: REMITENTE,
      to: [BUZON_CONTACTO],
      replyTo: email,
      subject: `Inventario de IA · ${d.etiqueta} · ${email}`,
      html: `<div style="font-family:sans-serif;color:#333;max-width:600px;">
        <h2 style="border-bottom:1px solid #eee;padding-bottom:10px;">Inventario de IA completado</h2>
        <p><strong>Email:</strong> ${e(email)}</p>
        ${filaCampana}
        <p><strong>${e(d.etiqueta)}:</strong> ${e(d.titular)}</p>
        <p><strong>Pasos que le hemos dado:</strong></p>
        <ol>${d.pasos.map((p) => `<li>${e(p)}</li>`).join("")}</ol>
        <h3>Respuestas</h3>${filas}
      </div>`,
    });
  } catch (err) {
    console.error("[inventario-ia] error", { motivo: "aviso interno", name: err?.name ?? null });
  }

  console.log("[inventario-ia] ok", {
    nivel: d.nivel,
    tieneGclid: Boolean(campana?.gclid),
    utm_source: campana?.utm_source ?? null,
  });
  return NextResponse.json({ success: true });
}
