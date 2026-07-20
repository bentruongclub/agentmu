/**
 * Image generation via xAI (SpaceXAI) images API when XAI_API_KEY is set.
 * Saves image metadata/URL or base64 path under sessions/artifacts/images when workspace given.
 */
import fs from "node:fs/promises";
import path from "node:path";

export async function generateImage(
  prompt: string,
  opts: {
    workspace?: string;
    fetchImpl?: typeof fetch;
    model?: string;
  } = {}
): Promise<string> {
  const p = prompt.trim();
  if (!p) return "error: empty prompt";

  let apiKey =
    process.env.XAI_API_KEY?.trim() || process.env.GROK_API_KEY?.trim();
  if (!apiKey) {
    try {
      const { resolveXaiCredentials } = await import("../oauth.js");
      const creds = await resolveXaiCredentials();
      apiKey = creds?.apiKey;
    } catch {
      /* ignore */
    }
  }
  if (!apiKey) {
    return (
      "error: generate_image unavailable — missing credentials. " +
      "Run `agentmu login` (SuperGrok / X Premium+) or set XAI_API_KEY (https://console.x.ai)."
    );
  }

  const fetchFn = opts.fetchImpl ?? globalThis.fetch;
  if (typeof fetchFn !== "function") {
    return "error: fetch unavailable in this runtime (no network primitive)";
  }

  const baseUrl =
    process.env.AGENTMU_BASE_URL?.trim() || "https://api.x.ai/v1";
  const model = opts.model || process.env.AGENTMU_IMAGE_MODEL || "grok-2-image";

  try {
    const res = await fetchFn(`${baseUrl.replace(/\/$/, "")}/images/generations`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        prompt: p,
        n: 1,
        response_format: "url",
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return `error: generate_image HTTP ${res.status} ${res.statusText}${
        body ? ` — ${body.slice(0, 500)}` : ""
      }`;
    }

    const data = (await res.json()) as {
      data?: Array<{ url?: string; b64_json?: string; revised_prompt?: string }>;
    };
    const item = data.data?.[0];
    if (!item) {
      return "error: generate_image returned no image data";
    }

    let savedNote = "";
    if (opts.workspace) {
      const dir = path.join(opts.workspace, "sessions", "artifacts", "images");
      await fs.mkdir(dir, { recursive: true });
      const stamp = new Date().toISOString().replace(/[:.]/g, "-");
      const metaPath = path.join(dir, `${stamp}_image.json`);
      const meta = {
        product: "AgentMu",
        prompt: p,
        model,
        url: item.url ?? null,
        revised_prompt: item.revised_prompt ?? null,
        createdAt: new Date().toISOString(),
      };
      await fs.writeFile(metaPath, JSON.stringify(meta, null, 2) + "\n", "utf8");
      savedNote = `\nmetadata saved: ${metaPath}`;
    }

    if (item.url) {
      return `generate_image ok\nurl: ${item.url}${
        item.revised_prompt ? `\nrevised_prompt: ${item.revised_prompt}` : ""
      }${savedNote}`;
    }
    if (item.b64_json) {
      if (opts.workspace) {
        const dir = path.join(opts.workspace, "sessions", "artifacts", "images");
        await fs.mkdir(dir, { recursive: true });
        const stamp = new Date().toISOString().replace(/[:.]/g, "-");
        const imgPath = path.join(dir, `${stamp}.png`);
        await fs.writeFile(imgPath, Buffer.from(item.b64_json, "base64"));
        return `generate_image ok\nsaved: ${imgPath}${savedNote}`;
      }
      return `generate_image ok\nb64_json length: ${item.b64_json.length}${savedNote}`;
    }
    return `error: generate_image response missing url and b64_json`;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return `error: generate_image failed — network or upstream unavailable (${msg})`;
  }
}
