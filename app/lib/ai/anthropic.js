import Anthropic from "@anthropic-ai/sdk";

let _client = null;

export function getAnthropicClient() {
  if (!_client) {
    if (!process.env.ANTHROPIC_API_KEY) {
      throw new Error("ANTHROPIC_API_KEY no configurada");
    }
    _client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return _client;
}

export const MODEL = "claude-sonnet-4-6";
