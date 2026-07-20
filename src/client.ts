import OpenAI from "openai";
import type { AgentMuConfig } from "./config.js";
import { resolveXaiCredentials } from "./oauth.js";

export async function createClient(cfg: AgentMuConfig): Promise<OpenAI> {
  const creds = await resolveXaiCredentials();
  if (!creds) {
    throw new Error(
      "No xAI credentials.\n" +
        "  SuperGrok / X Premium+:  agentmu login\n" +
        "  or API key:              export XAI_API_KEY=...  (https://console.x.ai)"
    );
  }
  return new OpenAI({
    apiKey: creds.apiKey,
    baseURL: creds.baseUrl || cfg.baseUrl,
  });
}

/** Sync helper for places that still only check env (prefer resolveXaiCredentials). */
export function getEnvApiKey(): string | undefined {
  return process.env.XAI_API_KEY || process.env.GROK_API_KEY;
}
