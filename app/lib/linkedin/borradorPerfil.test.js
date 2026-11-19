import { describe, expect, it, vi } from "vitest";
import { MODEL } from "@/app/lib/ai/anthropic";
import {
  CIERRE_POR_DEFECTO,
  buildBorradorPerfilPrompt,
  generarBorradorPerfil,
  limpiarBorrador,
} from "./borradorPerfil";

const clienteFalso = (respuesta) => ({
  messages: { create: vi.fn(async () => respuesta) },
});

describe("buildBorradorPerfilPrompt", () => {
  it("pide problema de cliente, sin enlaces y cierre con diagnóstico", () => {
    const prompt = buildBorradorPerfilPrompt({
      titulo: "Onboarding que no retiene",
      contenidoHtml: "<h2>Idea</h2><p>Texto <strong>clave</strong></p>",
    });
    expect(prompt).toContain("Onboarding que no retiene");
    expect(prompt).toContain("Texto clave");
    expect(prompt).not.toContain("<p>");
    expect(prompt).toMatch(/problema concreto de un cliente/);
    expect(prompt).toMatch(/Sin enlaces ni URLs/);
    expect(prompt).toMatch(/sesión de diagnóstico/);
  });
});

describe("limpiarBorrador", () => {
  it("quita cualquier URL del cuerpo", () => {
    const t = limpiarBorrador(
      "Un cliente perdía usuarios.\nMás en https://www.room714.com/es/blog/x\nwww.room714.com\n\n¿Hacemos una sesión de diagnóstico?",
    );
    expect(t).not.toMatch(/https?:|www\./);
    expect(t).toContain("¿Hacemos una sesión de diagnóstico?");
  });

  it("añade la invitación al diagnóstico si falta", () => {
    expect(limpiarBorrador("Un cliente perdía usuarios.")).toBe(
      `Un cliente perdía usuarios.\n\n${CIERRE_POR_DEFECTO}`,
    );
  });
});

describe("generarBorradorPerfil", () => {
  it("devuelve el texto limpio usando el modelo del proyecto", async () => {
    const client = clienteFalso({
      stop_reason: "end_turn",
      content: [{ type: "text", text: "Un cliente perdía el 40 % en el alta. https://x.com\n\nTe propongo un diagnóstico." }],
    });
    const texto = await generarBorradorPerfil({ titulo: "T", contenidoHtml: "<p>C</p>", client });
    expect(texto).toBe("Un cliente perdía el 40 % en el alta.\n\nTe propongo un diagnóstico.");
    const args = client.messages.create.mock.calls[0][0];
    expect(args.model).toBe(MODEL);
    expect(args.messages[0].role).toBe("user");
  });

  it("si el modelo rechaza, avisa con un error", async () => {
    const client = clienteFalso({ stop_reason: "refusal", content: [] });
    await expect(
      generarBorradorPerfil({ titulo: "T", contenidoHtml: "", client }),
    ).rejects.toThrow("no ha querido");
  });
});
