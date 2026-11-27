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

const FORMULARIO = {
  name: "Nombre Apellido",
  email: "persona@empresa.test",
  company: "Empresa",
  message: "Mensaje privado",
  interests: ["ia"],
};

const peticion = (body) =>
  new Request("http://x/api/contact", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

let log;
let error;

beforeEach(() => {
  process.env.RESEND_API_KEY = "re_prueba_secreta";
  enviar.mockReset().mockResolvedValue({ data: { id: "1" }, error: null });
  guardarLead.mockReset().mockResolvedValue(undefined);
  log = vi.spyOn(console, "log").mockImplementation(() => {});
  error = vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => vi.restoreAllMocks());

const todoLoRegistrado = () => JSON.stringify([...log.mock.calls, ...error.mock.calls]);

describe("POST /api/contact", () => {
  it("el gclid de la campaña llega al correo interno, al lead y al log", async () => {
    const res = await POST(peticion({ ...FORMULARIO, campana: { gclid: "TEST123", utm_source: "google" } }));
    expect(res.status).toBe(200);
    expect(enviar.mock.calls[0][0].html).toContain("gclid=TEST123");
    expect(guardarLead.mock.calls[0][0].campana).toEqual({ gclid: "TEST123", utm_source: "google" });
    expect(log).toHaveBeenCalledWith("[contact] ok", {
      origen: "hablemos",
      tieneGclid: true,
      utm_source: "google",
    });
  });

  it("no registra datos personales ni la clave de Resend", async () => {
    await POST(peticion({ ...FORMULARIO, campana: {} }));
    const registrado = todoLoRegistrado();
    for (const dato of [FORMULARIO.name, FORMULARIO.email, FORMULARIO.message, "re_p"]) {
      expect(registrado).not.toContain(dato);
    }
  });

  it("si Resend falla, lo registra sin datos personales", async () => {
    enviar.mockResolvedValueOnce({ data: null, error: { name: "validation_error", statusCode: 422, message: FORMULARIO.email } });
    const res = await POST(peticion(FORMULARIO));
    expect(res.status).toBe(500);
    expect(error).toHaveBeenCalledWith("[contact] error", {
      motivo: "Resend",
      origen: "hablemos",
      name: "validation_error",
      statusCode: 422,
    });
    expect(todoLoRegistrado()).not.toContain(FORMULARIO.email);
  });
});
