// Sondeo de un solo uso: qué combinaciones de modelo y herramienta funcionan.
// Se borra en la Task 15. Cuesta unos céntimos.
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

const ESQUEMA = {
  type: "json_schema",
  schema: {
    type: "object",
    properties: {
      empresa: { type: "string" },
      hace_producto_digital: { type: "boolean" },
    },
    required: ["empresa", "hace_producto_digital"],
    additionalProperties: false,
  },
};

async function probar(etiqueta, params) {
  try {
    const r = await client.messages.create(params);
    const texto = r.content.filter((b) => b.type === "text").map((b) => b.text).join("");
    console.log(`\n✅ ${etiqueta}`);
    console.log("   stop_reason:", r.stop_reason);
    console.log("   usage:", JSON.stringify(r.usage));
    console.log("   texto:", texto.slice(0, 200).replace(/\n/g, " "));
  } catch (err) {
    console.log(`\n❌ ${etiqueta}`);
    console.log("   ", err.status, String(err.message).slice(0, 260));
  }
}

const PREGUNTA = "¿A qué se dedica la empresa española Mahou San Miguel y cuánto factura?";

await probar("A · haiku-4-5 + web_search_20250305", {
  model: "claude-haiku-4-5", max_tokens: 1024,
  tools: [{ type: "web_search_20250305", name: "web_search", max_uses: 2 }],
  messages: [{ role: "user", content: PREGUNTA }],
});

await probar("B · haiku-4-5 + web_search_20260318 + allowed_callers direct", {
  model: "claude-haiku-4-5", max_tokens: 1024,
  tools: [{ type: "web_search_20260318", name: "web_search", max_uses: 2, allowed_callers: ["direct"] }],
  messages: [{ role: "user", content: PREGUNTA }],
});

await probar("C · haiku-4-5 + output_config.format", {
  model: "claude-haiku-4-5", max_tokens: 1024,
  output_config: { format: ESQUEMA },
  messages: [{ role: "user", content: "Mahou San Miguel fabrica cerveza. Devuelve el JSON." }],
});

await probar("D · haiku-4-5 + web_search + output_config.format a la vez", {
  model: "claude-haiku-4-5", max_tokens: 1024,
  tools: [{ type: "web_search_20250305", name: "web_search", max_uses: 2 }],
  output_config: { format: ESQUEMA },
  messages: [{ role: "user", content: PREGUNTA }],
});

await probar("E · opus-5 + web_search_20260318 + response_inclusion excluded", {
  model: "claude-opus-5", max_tokens: 2048, thinking: { type: "adaptive" },
  tools: [{ type: "web_search_20260318", name: "web_search", max_uses: 3, response_inclusion: "excluded" }],
  messages: [{ role: "user", content: PREGUNTA }],
});

await probar("F · opus-5 + web_search + output_config.format a la vez", {
  model: "claude-opus-5", max_tokens: 2048, thinking: { type: "adaptive" },
  tools: [{ type: "web_search_20260318", name: "web_search", max_uses: 3 }],
  output_config: { format: ESQUEMA },
  messages: [{ role: "user", content: PREGUNTA }],
});
