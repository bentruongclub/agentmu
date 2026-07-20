/**
 * X (Twitter) post search for multi-capability sessions.
 * Requires X_BEARER_TOKEN (Twitter API v2). Honest structured error when missing.
 */

export async function xSearch(
  query: string,
  opts: { maxResults?: number; fetchImpl?: typeof fetch } = {}
): Promise<string> {
  const q = query.trim();
  if (!q) return "error: empty query";

  const token =
    process.env.X_BEARER_TOKEN?.trim() ||
    process.env.TWITTER_BEARER_TOKEN?.trim();

  if (!token) {
    return (
      "error: x_search unavailable — missing credential X_BEARER_TOKEN " +
      "(or TWITTER_BEARER_TOKEN). Obtain a Twitter API v2 bearer token and set it " +
      "in the environment or .env. Without it, web_search can still research topics."
    );
  }

  const fetchFn = opts.fetchImpl ?? globalThis.fetch;
  if (typeof fetchFn !== "function") {
    return "error: fetch unavailable in this runtime (no network primitive)";
  }

  const max = Math.min(20, Math.max(1, opts.maxResults ?? 5));
  const url =
    "https://api.twitter.com/2/tweets/search/recent?" +
    new URLSearchParams({
      query: q,
      max_results: String(Math.max(10, max)), // API min is 10 for recent search
      "tweet.fields": "created_at,public_metrics,author_id",
    }).toString();

  try {
    const res = await fetchFn(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        "User-Agent": "AgentMu/0.1",
      },
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return `error: x_search HTTP ${res.status} ${res.statusText}${
        body ? ` — ${body.slice(0, 400)}` : ""
      }`;
    }
    const data = (await res.json()) as {
      data?: Array<{
        id: string;
        text: string;
        created_at?: string;
        public_metrics?: { like_count?: number; retweet_count?: number };
      }>;
      meta?: { result_count?: number };
      errors?: unknown;
    };
    if (data.errors) {
      return `error: x_search API errors: ${JSON.stringify(data.errors).slice(0, 500)}`;
    }
    const tweets = data.data ?? [];
    if (!tweets.length) {
      return `x_search: no recent posts for "${q}"`;
    }
    const lines = tweets.slice(0, max).map((t, i) => {
      const metrics = t.public_metrics
        ? ` [♥${t.public_metrics.like_count ?? 0} ↻${t.public_metrics.retweet_count ?? 0}]`
        : "";
      const when = t.created_at ? ` (${t.created_at})` : "";
      return `${i + 1}. https://x.com/i/status/${t.id}${when}${metrics}\n   ${t.text}`;
    });
    return `x_search for "${q}":\n${lines.join("\n")}`;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return `error: x_search failed — network or upstream unavailable (${msg})`;
  }
}
