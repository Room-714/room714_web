import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Ninguna llamada real: la BD, Make, el modelo y el correo están simulados.
const prismaMock = vi.hoisted(() => ({
  $queryRaw: vi.fn(),
  linkedInEnvio: { create: vi.fn(), updateMany: vi.fn() },
  post: { findMany: vi.fn(), updateMany: vi.fn() },
}));
const anthropicCreate = vi.hoisted(() => vi.fn());
const avisar = vi.hoisted(() => vi.fn());

vi.mock("@/app/lib/prisma", () => ({ prisma: prismaMock }));
vi.mock("@/app/lib/ai/anthropic", () => ({
  MODEL: "modelo-de-prueba",
  getAnthropicClient: () => ({ messages: { create: anthropicCreate } }),
}));
vi.mock("@/app/lib/notifications/linkedinFallo", () => ({ sendLinkedInFalloEmail: avisar }));

const { GET } = await import("./route");

const WEBHOOK_EMPRESA = "https://hook.example.test/empresa";
const WEBHOOK_PERSONAL = "https://hook.example.test/personal";

// Semana del lunes 16 de noviembre de 2026 (CET). 08:30 Madrid = 07:30 UTC.
const VIERNES_0830 = new Date("2026-11-20T07:30:00Z");
const VIERNES_0845 = new Date("2026-11-20T07:45:00Z");
const MARTES_0830 = new Date("2026-11-17T07:30:00Z");
const JUEVES_0830 = new Date("2026-11-19T07:30:00Z");

const peticion = (query = "", secret = "secreto") =>
  new Request(`http://x/api/cron/publish-linkedin${query}`, {
    headers: { authorization: `Bearer ${secret}` },
  });

// Filas tal y como las devuelve Postgres con json_agg: fechas sin zona.
const sinZona = (iso) => iso.replace("Z", "").replace(".000", "");
const filaPost = (id, category, iso, slug, tomas = []) => ({
  id,
  date: sinZona(iso),
  category,
  image: "https://img/portada.jpg",
  slug,
  title: `Post ${id}`,
  content: "<p>Contenido del artículo</p>",
  tags: [],
  linkedinPost: null,
  linkedinHashtags: [],
  tomas,
});
const toma = (id) => ({ id, variant: 1, angle: "data", text: `Texto de empresa ${id}`, hashtags: ["UX"], imageBlobUrl: "https://img/t.jpg" });

const POSTS_SEMANA = [
  filaPost(2, "PRODUCT", "2026-11-19T06:30:00Z", "post-jueves", [toma(20)]), // C1
  filaPost(1, "UX", "2026-11-16T06:30:00Z", "post-lunes", [toma(10)]), // C2
  filaPost(0, "TECH", "2026-11-12T06:30:00Z", "post-semana-pasada"),
];

const fila = (extra = {}) => ({
  posts: POSTS_SEMANA,
  recientesPerfil: [],
  usadosPerfil: [],
  enviosSemana: [],
  ...extra,
});

const cuerpo = (inicio) =>
  [
    inicio,
    "El formulario pedía catorce datos antes de enseñar un solo precio y nadie en el equipo lo veía como un problema, porque cada campo tenía un dueño que lo defendía en su comité.",
    "Lo que había detrás no era diseño: era que cada área había añadido su pregunta por si acaso, sin medir lo que costaba en abandonos ni quién la usaba después.",
    "Quitamos todo lo que no hacía falta para dar un precio y dejamos el resto para cuando el cliente ya había decidido. Las altas completas subieron y el soporte dejó de recibir llamadas.",
  ].join("\n\n");
const cuerpoDistinto = () =>
  [
    "En retail vi algo parecido la semana pasada: una cadena cobraba dos veces a quien cambiaba de tienda.",
    "Cada sistema cuadraba por separado, así que ningún informe lo enseñaba y las reclamaciones llegaban sueltas a atención al cliente, que las resolvía una a una sin ver el patrón.",
    "El fallo estaba en el traspaso del pedido entre tiendas, que nadie había dibujado de principio a fin porque cada equipo solo conocía su tramo.",
    "Pintamos el recorrido completo con el equipo de caja, encontramos el doble cobro en una tarde y lo cerramos antes del siguiente cierre mensual, que era cuando más dolía.",
  ].join("\n\n");
const respuestaModelo = (inicio = "Una aseguradora perdía a la mitad de sus clientes en el alta.", idea = "Altas con datos de más", texto = cuerpo(inicio)) => ({
  stop_reason: "tool_use",
  content: [{ type: "tool_use", input: { texto, hashtags: ["CX"], idea } }],
});

let fetchMock;
const ahora = (fecha) => vi.setSystemTime(fecha);
const consultas = () => prismaMock.$queryRaw.mock.calls.length;
const escrituras = () =>
  prismaMock.linkedInEnvio.create.mock.calls.length + prismaMock.linkedInEnvio.updateMany.mock.calls.length;

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  process.env.CRON_SECRET = "secreto";
  process.env.MAKE_WEBHOOK_URL = WEBHOOK_EMPRESA;
  process.env.MAKE_WEBHOOK_LINKEDIN_PERSONAL = WEBHOOK_PERSONAL;
  delete process.env.LINKEDIN_APPROVAL_FLOW;
  delete process.env.LINKEDIN_COMPANY_AUTOPOST;
  delete process.env.LINKEDIN_PERSONAL_AUTOPOST;
  prismaMock.$queryRaw.mockReset().mockResolvedValue([fila()]);
  prismaMock.linkedInEnvio.create.mockReset().mockResolvedValue({ id: 1 });
  prismaMock.linkedInEnvio.updateMany.mockReset().mockResolvedValue({ count: 1 });
  prismaMock.post.findMany.mockReset().mockResolvedValue([]);
  prismaMock.post.updateMany.mockReset();
  anthropicCreate.mockReset().mockResolvedValue(respuestaModelo());
  avisar.mockReset().mockResolvedValue({ success: true });
  fetchMock = vi.fn(async () => ({ ok: true, status: 200 }));
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("cron publish-linkedin: guardas", () => {
  it("sin el secreto responde 401 y no consulta nada", async () => {
    ahora(VIERNES_0830);
    expect((await GET(peticion("", "otro"))).status).toBe(401);
    expect(consultas()).toBe(0);
  });

  it("fuera de franja no toca la base de datos", async () => {
    for (const fecha of [new Date("2026-11-18T07:30:00Z"), new Date("2026-11-20T07:35:00Z"), new Date("2026-11-20T06:00:00Z")]) {
      ahora(fecha);
      const body = await (await GET(peticion())).json();
      expect(body.message).toMatch(/Fuera de franja/);
    }
    expect(consultas()).toBe(0);
    expect(prismaMock.post.findMany).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("interruptor de empresa apagado: el viernes no consulta ni envía", async () => {
    process.env.LINKEDIN_COMPANY_AUTOPOST = "false";
    ahora(VIERNES_0830);
    const body = await (await GET(peticion())).json();
    expect(body.automatico.omitido).toMatch(/LINKEDIN_COMPANY_AUTOPOST/);
    expect(consultas()).toBe(0);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("interruptor personal apagado: el martes no consulta ni envía", async () => {
    process.env.LINKEDIN_PERSONAL_AUTOPOST = "false";
    ahora(MARTES_0830);
    const body = await (await GET(peticion())).json();
    expect(body.automatico.omitido).toMatch(/LINKEDIN_PERSONAL_AUTOPOST/);
    expect(consultas()).toBe(0);
    expect(anthropicCreate).not.toHaveBeenCalled();
  });

  it("sin el webhook del perfil, el canal personal se salta sin fallar ni avisar", async () => {
    delete process.env.MAKE_WEBHOOK_LINKEDIN_PERSONAL;
    ahora(MARTES_0830);
    const body = await (await GET(peticion())).json();
    expect(body.automatico.omitido).toMatch(/MAKE_WEBHOOK_LINKEDIN_PERSONAL/);
    expect(consultas()).toBe(0);
    expect(avisar).not.toHaveBeenCalled();
  });

  it("con LINKEDIN_APPROVAL_FLOW=true vuelve el flujo de aprobación y la empresa automática se apaga", async () => {
    process.env.LINKEDIN_APPROVAL_FLOW = "true";
    ahora(VIERNES_0830);
    const body = await (await GET(peticion())).json();
    expect(prismaMock.post.findMany).toHaveBeenCalledTimes(1);
    expect(body.aprobados.processed).toBe(0);
    expect(body.automatico.omitido).toMatch(/LINKEDIN_APPROVAL_FLOW/);
    expect(consultas()).toBe(0);
  });
});

describe("página de empresa (viernes 08:30)", () => {
  it("publica el mejor post de la semana (C2 > C1) con su toma y UTM, en una lectura y una escritura", async () => {
    ahora(VIERNES_0830);
    const body = await (await GET(peticion())).json();

    expect(body.automatico).toMatchObject({ canal: "empresa", modo: "principal", enviado: true });
    expect(body.automatico.post.id).toBe(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(WEBHOOK_EMPRESA);
    const payload = JSON.parse(init.body);
    expect(payload.canal).toBe("empresa");
    expect(payload.linkedin_post).toBe("Texto de empresa 10");
    expect(payload.url).toBe(
      "https://www.room714.com/es/blog/post-lunes?utm_source=linkedin&utm_medium=social&utm_campaign=blog&utm_content=post-lunes",
    );
    expect(payload.link_for_first_comment).toBe(payload.url);

    expect(consultas()).toBe(1);
    expect(escrituras()).toBe(1);
    expect(prismaMock.linkedInEnvio.create.mock.calls[0][0].data).toMatchObject({
      canal: "EMPRESA",
      dia: new Date("2026-11-20T00:00:00Z"),
      postId: 1,
      texto: "Texto de empresa 10",
      estado: "ENVIADO",
      intentos: 1,
      error: null,
      enviadoAt: VIERNES_0830,
    });
  });

  it("semana sin posts nuevos: no publica ni escribe nada", async () => {
    prismaMock.$queryRaw.mockResolvedValue([fila({ posts: [POSTS_SEMANA[2]] })]);
    ahora(VIERNES_0830);
    const body = await (await GET(peticion())).json();
    expect(body.automatico.omitido).toMatch(/no hay posts nuevos/);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(escrituras()).toBe(0);
  });

  it("si ya publicó esta semana, no repite", async () => {
    prismaMock.$queryRaw.mockResolvedValue([
      fila({ enviosSemana: [{ id: 5, canal: "EMPRESA", dia: "2026-11-20", estado: "ENVIADO", intentos: 1 }] }),
    ]);
    ahora(VIERNES_0830);
    await GET(peticion());
    expect(fetchMock).not.toHaveBeenCalled();
    expect(escrituras()).toBe(0);
  });
});

describe("fallos de envío y reintento", () => {
  const fallido = (extra = {}) => ({
    id: 7,
    canal: "EMPRESA",
    dia: "2026-11-20",
    postId: 1,
    texto: "Texto de empresa 10",
    idea: null,
    payload: { canal: "empresa", linkedin_post: "Texto de empresa 10", post_id: 1 },
    estado: "FALLIDO",
    intentos: 1,
    error: "Make respondió 500",
    ...extra,
  });

  it("08:30: si Make falla, lo guarda como fallido para el reintento y no avisa todavía", async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 500 });
    ahora(VIERNES_0830);
    const body = await (await GET(peticion())).json();
    expect(body.automatico).toMatchObject({ enviado: false, error: "Make respondió 500" });
    expect(prismaMock.linkedInEnvio.create.mock.calls[0][0].data).toMatchObject({
      estado: "FALLIDO",
      intentos: 1,
      error: "Make respondió 500",
      enviadoAt: null,
    });
    expect(prismaMock.linkedInEnvio.create.mock.calls[0][0].data.payload.canal).toBe("empresa");
    expect(avisar).not.toHaveBeenCalled();
  });

  it("08:30: si Make no responde (red caída), también cuenta como fallo", async () => {
    fetchMock.mockRejectedValue(new Error("ECONNRESET"));
    ahora(VIERNES_0830);
    await GET(peticion());
    expect(prismaMock.linkedInEnvio.create.mock.calls[0][0].data.error).toMatch(/No se pudo contactar con Make: ECONNRESET/);
  });

  it("08:45: reenvía lo mismo y, si sale, lo marca como enviado", async () => {
    prismaMock.$queryRaw.mockResolvedValue([fila({ enviosSemana: [fallido()] })]);
    ahora(VIERNES_0845);
    const body = await (await GET(peticion())).json();
    expect(body.automatico).toMatchObject({ modo: "reintento", enviado: true });
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual(fallido().payload);
    expect(prismaMock.linkedInEnvio.updateMany.mock.calls[0][0]).toMatchObject({
      where: { id: 7, estado: "FALLIDO", intentos: 1 },
      data: { estado: "ENVIADO", intentos: 2, enviadoAt: VIERNES_0845 },
    });
    expect(consultas()).toBe(1);
    expect(escrituras()).toBe(1);
    expect(avisar).not.toHaveBeenCalled();
  });

  it("08:45: si vuelve a fallar, avisa a José por correo con el error y no lo intenta más", async () => {
    prismaMock.$queryRaw.mockResolvedValue([fila({ enviosSemana: [fallido()] })]);
    fetchMock.mockResolvedValue({ ok: false, status: 502 });
    ahora(VIERNES_0845);
    const body = await (await GET(peticion())).json();
    expect(body.automatico).toMatchObject({ enviado: false, aviso: "correo enviado" });
    expect(prismaMock.linkedInEnvio.updateMany.mock.calls[0][0].data).toMatchObject({
      estado: "FALLIDO",
      intentos: 2,
      error: "Make respondió 502",
    });
    expect(avisar).toHaveBeenCalledTimes(1);
    expect(avisar.mock.calls[0][0]).toMatchObject({ canal: "empresa", intentos: 2, fecha: "2026-11-20" });
    expect(avisar.mock.calls[0][0].error).toMatch(/Make respondió 500[\s\S]*Make respondió 502/);
  });

  it("08:45: tras dos fallos no hay tercer intento", async () => {
    prismaMock.$queryRaw.mockResolvedValue([fila({ enviosSemana: [fallido({ intentos: 2 })] })]);
    ahora(VIERNES_0845);
    const body = await (await GET(peticion())).json();
    expect(body.automatico.omitido).toMatch(/Ya se reintentó/);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(escrituras()).toBe(0);
    expect(avisar).not.toHaveBeenCalled();
  });

  it("08:45: si a las 08:30 salió bien, no hace nada", async () => {
    prismaMock.$queryRaw.mockResolvedValue([fila({ enviosSemana: [fallido({ estado: "ENVIADO" })] })]);
    ahora(VIERNES_0845);
    await GET(peticion());
    expect(fetchMock).not.toHaveBeenCalled();
    expect(escrituras()).toBe(0);
  });

  it("08:45: sin fallo de hoy no hay nada que reintentar", async () => {
    ahora(VIERNES_0845);
    const body = await (await GET(peticion())).json();
    expect(body.automatico.omitido).toMatch(/ningún envío fallido/);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("perfil de José (martes y jueves 08:30)", () => {
  it("genera el texto del post más reciente sin usar y lo manda a su escenario de Make", async () => {
    ahora(JUEVES_0830);
    const body = await (await GET(peticion())).json();
    expect(body.automatico).toMatchObject({ canal: "personal", enviado: true });
    expect(body.automatico.post.id).toBe(2);

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(WEBHOOK_PERSONAL);
    const payload = JSON.parse(init.body);
    expect(payload.canal).toBe("personal");
    expect(payload.post_id).toBe(2);
    expect(payload.texto).not.toMatch(/https?:|www\./);
    expect(payload.texto).toContain("pide una sesión de diagnóstico (enlace en mi perfil)");

    expect(consultas()).toBe(1);
    expect(escrituras()).toBe(1);
    expect(prismaMock.linkedInEnvio.create.mock.calls[0][0].data).toMatchObject({
      canal: "PERSONAL",
      dia: new Date("2026-11-19T00:00:00Z"),
      postId: 2,
      texto: payload.texto,
      idea: "Altas con datos de más",
      estado: "ENVIADO",
    });
  });

  it("no reutiliza posts: si el más reciente ya se usó, coge el anterior", async () => {
    prismaMock.$queryRaw.mockResolvedValue([fila({ usadosPerfil: [2] })]);
    ahora(JUEVES_0830);
    const body = await (await GET(peticion())).json();
    expect(body.automatico.post.id).toBe(1);
  });

  it("deduplica contra los textos ya publicados: si repite la apertura, genera otro", async () => {
    const yaPublicado = {
      postId: 99,
      texto: `${cuerpo("Una aseguradora perdía a la mitad de sus clientes en el alta.")}\n\nSi te pasa algo parecido…`,
      idea: "Otra idea",
      enviadoAt: "2026-11-17T07:30:00",
    };
    prismaMock.$queryRaw.mockResolvedValue([fila({ recientesPerfil: [yaPublicado], usadosPerfil: [99] })]);
    anthropicCreate
      .mockResolvedValueOnce(respuestaModelo())
      .mockResolvedValueOnce(respuestaModelo(null, "Cobros duplicados", cuerpoDistinto()));
    ahora(JUEVES_0830);
    await GET(peticion());
    expect(anthropicCreate).toHaveBeenCalledTimes(2);
    const payload = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(payload.texto.startsWith("En retail vi algo parecido")).toBe(true);
  });

  it("si no se puede generar el texto, no envía nada y el reintento lo vuelve a generar", async () => {
    anthropicCreate.mockRejectedValueOnce(new Error("overloaded"));
    ahora(MARTES_0830);
    await GET(peticion());
    expect(fetchMock).not.toHaveBeenCalled();
    const guardado = prismaMock.linkedInEnvio.create.mock.calls[0][0].data;
    expect(guardado).toMatchObject({ estado: "FALLIDO", error: "overloaded", texto: null });
    expect(guardado.payload).toBeUndefined();

    prismaMock.$queryRaw.mockResolvedValue([
      fila({ enviosSemana: [{ id: 8, canal: "PERSONAL", dia: "2026-11-17", estado: "FALLIDO", intentos: 1, payload: null, error: "overloaded" }] }),
    ]);
    ahora(new Date("2026-11-17T07:45:00Z"));
    const body = await (await GET(peticion())).json();
    expect(body.automatico).toMatchObject({ modo: "reintento", enviado: true });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(prismaMock.linkedInEnvio.updateMany.mock.calls[0][0].data).toMatchObject({ estado: "ENVIADO", intentos: 2, postId: 1 });
  });
});

describe("vista previa (?preview=1)", () => {
  it("enseña lo que saldría en cada canal sin enviar ni guardar nada", async () => {
    ahora(new Date("2026-11-19T12:00:00Z")); // jueves por la tarde
    const body = await (await GET(peticion("?preview=1"))).json();
    expect(body.mode).toBe("preview");
    expect(body.canales.empresa).toMatchObject({
      proximaEjecucion: "2026-11-20T07:30:00.000Z",
      activo: true,
      post: { id: 1, cluster: "C2" },
    });
    expect(body.canales.empresa.payload.url).toContain("utm_content=post-lunes");
    expect(body.canales.personal).toMatchObject({ proximaEjecucion: "2026-11-24T07:30:00.000Z", post: { id: 2 } });
    expect(body.canales.personal.texto).toContain("diagnóstico");
    expect(fetchMock).not.toHaveBeenCalled();
    expect(escrituras()).toBe(0);
    expect(consultas()).toBe(1);
  });

  it("también sin el secreto responde 401", async () => {
    expect((await GET(peticion("?preview=1", "otro"))).status).toBe(401);
  });
});
