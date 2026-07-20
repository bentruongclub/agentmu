/**
 * Redact secrets from strings before they hit the journal or logs.
 * Patterns are intentionally broad; prefer false positives over leaks.
 */

const PATTERNS: Array<{ re: RegExp; label: string }> = [
  // xAI / common API keys
  { re: /\bxai-[A-Za-z0-9_\-]{20,}\b/g, label: "XAI_KEY" },
  { re: /\bsk-[A-Za-z0-9_\-]{20,}\b/g, label: "SK_KEY" },
  { re: /\bsk-proj-[A-Za-z0-9_\-]{20,}\b/g, label: "SK_PROJ" },
  // Bearer tokens in headers / JSON
  {
    re: /(Bearer\s+)[A-Za-z0-9\-._~+/]+=*/gi,
    label: "BEARER",
  },
  {
    re: /("access_token"\s*:\s*")[^"]+(")/gi,
    label: "ACCESS_TOKEN",
  },
  {
    re: /("refresh_token"\s*:\s*")[^"]+(")/gi,
    label: "REFRESH_TOKEN",
  },
  {
    re: /((?:XAI_API_KEY|GROK_API_KEY|OPENAI_API_KEY|X_BEARER_TOKEN|BRAVE_API_KEY|TAVILY_API_KEY)\s*[=:]\s*)\S+/gi,
    label: "ENV_SECRET",
  },
  // JWT-shaped
  {
    re: /\beyJ[A-Za-z0-9_\-]{10,}\.[A-Za-z0-9_\-]{10,}\.[A-Za-z0-9_\-]{10,}\b/g,
    label: "JWT",
  },
];

/**
 * Replace secret-like substrings with [REDACTED:LABEL].
 */
export function redactSecrets(input: string): string {
  if (!input) return input;
  let out = input;
  for (const { re, label } of PATTERNS) {
    re.lastIndex = 0;
    if (label === "BEARER") {
      out = out.replace(re, `$1[REDACTED:${label}]`);
    } else if (
      label === "ACCESS_TOKEN" ||
      label === "REFRESH_TOKEN"
    ) {
      out = out.replace(re, `$1[REDACTED:${label}]$2`);
    } else if (label === "ENV_SECRET") {
      out = out.replace(re, `$1[REDACTED:${label}]`);
    } else {
      out = out.replace(re, `[REDACTED:${label}]`);
    }
  }
  return out;
}

/** Deep-redact string fields on a shallow journal event object. */
export function redactJournalEvent<T extends Record<string, unknown>>(
  event: T
): T {
  const out: Record<string, unknown> = { ...event };
  for (const [k, v] of Object.entries(out)) {
    if (typeof v === "string") {
      out[k] = redactSecrets(v);
    }
  }
  return out as T;
}
