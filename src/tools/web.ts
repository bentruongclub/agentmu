/**
 * Web search for AgentMu sessions (AgenC-like multi-tool surface).
 * Uses free Wikipedia OpenSearch by default; optional BRAVE_API_KEY / TAVILY_API_KEY.
 */

export type WebSearchResult = {
  title: string;
  url: string;
  snippet?: string;
};

export async function webSearch(
  query: string,
  opts: { maxResults?: number; fetchImpl?: typeof fetch } = {}
): Promise<string> {
  const q = query.trim();
  if (!q) return "error: empty query";

  const max = Math.min(10, Math.max(1, opts.maxResults ?? 5));
  const fetchFn = opts.fetchImpl ?? globalThis.fetch;

  if (typeof fetchFn !== "function") {
    return "error: fetch unavailable in this runtime (no network primitive)";
  }

  const brave = process.env.BRAVE_API_KEY?.trim();
  if (brave) {
    try {
      return await braveSearch(q, max, brave, fetchFn);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      // fall through to Wikipedia with note
      const wiki = await wikipediaSearch(q, max, fetchFn);
      return `note: Brave search failed (${msg}); fell back to Wikipedia\n${wiki}`;
    }
  }

  const tavily = process.env.TAVILY_API_KEY?.trim();
  if (tavily) {
    try {
      return await tavilySearch(q, max, tavily, fetchFn);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const wiki = await wikipediaSearch(q, max, fetchFn);
      return `note: Tavily search failed (${msg}); fell back to Wikipedia\n${wiki}`;
    }
  }

  try {
    return await wikipediaSearch(q, max, fetchFn);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return `error: web_search failed — network or upstream unavailable (${msg})`;
  }
}

async function wikipediaSearch(
  query: string,
  max: number,
  fetchFn: typeof fetch
): Promise<string> {
  const url =
    "https://en.wikipedia.org/w/api.php?" +
    new URLSearchParams({
      action: "opensearch",
      search: query,
      limit: String(max),
      namespace: "0",
      format: "json",
    }).toString();

  const res = await fetchFn(url, {
    headers: { "User-Agent": "AgentMu/0.1 (local agent harness)" },
  });
  if (!res.ok) {
    return `error: Wikipedia HTTP ${res.status} ${res.statusText}`;
  }
  const data = (await res.json()) as unknown;
  if (!Array.isArray(data) || data.length < 4) {
    return `error: unexpected Wikipedia response shape`;
  }
  const titles = data[1] as string[];
  const descs = data[2] as string[];
  const links = data[3] as string[];
  if (!titles?.length) {
    return `web_search (wikipedia): no results for "${query}"`;
  }
  const lines = titles.map((t, i) => {
    const snip = descs?.[i] ? ` — ${descs[i]}` : "";
    return `${i + 1}. ${t}${snip}\n   ${links?.[i] ?? ""}`;
  });
  return `web_search (wikipedia) for "${query}":\n${lines.join("\n")}`;
}

async function braveSearch(
  query: string,
  max: number,
  apiKey: string,
  fetchFn: typeof fetch
): Promise<string> {
  const url =
    "https://api.search.brave.com/res/v1/web/search?" +
    new URLSearchParams({ q: query, count: String(max) }).toString();
  const res = await fetchFn(url, {
    headers: {
      Accept: "application/json",
      "X-Subscription-Token": apiKey,
    },
  });
  if (!res.ok) {
    throw new Error(`Brave HTTP ${res.status}`);
  }
  const data = (await res.json()) as {
    web?: { results?: Array<{ title?: string; url?: string; description?: string }> };
  };
  const results = data.web?.results ?? [];
  if (!results.length) return `web_search (brave): no results for "${query}"`;
  const lines = results.slice(0, max).map((r, i) => {
    return `${i + 1}. ${r.title ?? "(no title)"}\n   ${r.url ?? ""}\n   ${r.description ?? ""}`;
  });
  return `web_search (brave) for "${query}":\n${lines.join("\n")}`;
}

async function tavilySearch(
  query: string,
  max: number,
  apiKey: string,
  fetchFn: typeof fetch
): Promise<string> {
  const res = await fetchFn("https://api.tavily.com/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      api_key: apiKey,
      query,
      max_results: max,
    }),
  });
  if (!res.ok) throw new Error(`Tavily HTTP ${res.status}`);
  const data = (await res.json()) as {
    results?: Array<{ title?: string; url?: string; content?: string }>;
  };
  const results = data.results ?? [];
  if (!results.length) return `web_search (tavily): no results for "${query}"`;
  const lines = results.slice(0, max).map((r, i) => {
    return `${i + 1}. ${r.title ?? "(no title)"}\n   ${r.url ?? ""}\n   ${r.content ?? ""}`;
  });
  return `web_search (tavily) for "${query}":\n${lines.join("\n")}`;
}
