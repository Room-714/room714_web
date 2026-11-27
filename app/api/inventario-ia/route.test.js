import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Nada real: ni base de datos ni correos.
const enviar = vi.hoisted(() => vi.fn());
const guardarLead = vi.hoisted(() => vi.fn());
vi.mock("resend", () => ({
  Resend: class {
    emails = { send: enviar };
  },
}));
vi.mock("@/app/lib/leads/guardar", async (importOriginal) => ({
  ...(await importOriginal()),
  guardarLead,
}));

const { POST } = await import("./route");

const RESPUESTAS = {
  datos: ["documentos", "clientes"],
  normas: ["ninguna"],
  formacion: ["no"],
  cuentas: ["personales"],
  plan: ["no"],
};
const EMAIL = "persona@empresa.test";

const peticion = (body) =>
  new Request("http://x/api/inventario-ia", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

let log;
let error;

beforeEach(() => {
  process.env.RESEND_API_KEY = "re_prueba";
  enviar.mockReset().mockResolvedValue({ error: null });
  guardarLead.mockReset().mockResolvedValue(undefined);
  log = vi.spyOn(console, "log").mockImplementation(() => {});
  error = vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => vi.restoreAllMocks());

const todoLoRegistrado = () => JSON.stringify([...log.mock.calls, ...error.mock.calls]);

describe("POST /api/inventario-ia", () => {
  it("con las cinco preguntas y sin casilla de privacidad, envía el diagnóstico", async () => {
    const res = await POST(peticion({ email: EMAIL, respuestas: RESPUESTAS, campana: {} }));
    expect(res.status).toBe(200);
    expect(enviar).toHaveBeenCalledTimes(2); // al cliente y el aviso interno
    expect(enviar.mock.calls[0][0].to).toEqual([EMAIL]);
  });

  it("acepta todavía respuestas antiguas con las siete preguntas", async () => {
    const res = await POST(
      peticion({ email: EMAIL, acepta: true, respuestas: { ...RESPUESTAS, herramientas: ["chat"], quien: ["equipos"] } }),
    );
    expect(res.status).toBe(200);
  });

  it("registra una línea al ir bien, con nivel y campaña y sin datos personales", async () => {
    await POST(peticion({ email: EMAIL, respuestas: RESPUESTAS, campana: { gclid: "TEST123", utm_source: "google" } }));
    expect(log).toHaveBeenCalledWith("[inventario-ia] ok", {
      nivel: "critico",
      tieneGclid: true,
      utm_source: "google",
    });
    expect(todoLoRegistrado()).not.toContain(EMAIL);
    expect(todoLoRegistrado()).not.toContain("clientes");
  });

  it("el aviso interno lleva la campaña, para saber qué viene de Google Ads", async () => {
    await POST(peticion({ email: EMAIL, respuestas: RESPUESTAS, campana: { gclid: "TEST123" } }));
    expect(enviar.mock.calls[1][0].html).toContain("gclid=TEST123");
  });

  it("si Resend falla, lo registra sin el email", async () => {
    enviar.mockResolvedValueOnce({ error: { name: "validation_error", statusCode: 422, message: `bad ${EMAIL}` } });
    const res = await POST(peticion({ email: EMAIL, respuestas: RESPUESTAS }));
    expect(res.status).toBe(502);
    expect(error).toHaveBeenCalledWith("[inventario-ia] error", {
      motivo: "Resend",
      nivel: "critico",
      name: "validation_error",
      statusCode: 422,
    });
    expect(todoLoRegistrado()).not.toContain(EMAIL);
  });

  it("rechaza respuestas incompletas y lo registra sin datos", async () => {
    const { plan, ...sinPlan } = RESPUESTAS;
    expect(plan).toBeDefined();
    const res = await POST(peticion({ email: EMAIL, respuestas: sinPlan }));
    expect(res.status).toBe(400);
    expect(todoLoRegistrado()).not.toContain(EMAIL);
  });
});
