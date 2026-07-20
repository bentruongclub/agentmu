/**
 * xAI Grok OAuth (SuperGrok / X Premium+) — Hermes-style PKCE loopback.
 * Each user signs in with their own subscription; no shared API key required.
 *
 * Uses the public Grok CLI OIDC client (same client_id Hermes/AgenC ecosystem).
 */
import crypto from "node:crypto";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import os from "node:os";
import { URL } from "node:url";
import { spawn } from "node:child_process";

export const XAI_OAUTH_ISSUER = "https://auth.x.ai";
export const XAI_OAUTH_DISCOVERY_URL = `${XAI_OAUTH_ISSUER}/.well-known/openid-configuration`;
/** Public Grok CLI / Hermes client id (installed-app, no secret). */
export const XAI_OAUTH_CLIENT_ID = "b1a00492-073a-47ea-816f-4c329264a828";
export const XAI_OAUTH_SCOPE =
  "openid profile email offline_access grok-cli:access api:access";
export const XAI_OAUTH_REDIRECT_HOST = "127.0.0.1";
export const XAI_OAUTH_REDIRECT_PORT = 56121;
export const XAI_OAUTH_REDIRECT_PATH = "/callback";
export const DEFAULT_XAI_BASE_URL = "https://api.x.ai/v1";
export const ACCESS_TOKEN_REFRESH_SKEW_SECONDS = 120;

export type OidcDiscovery = {
  authorization_endpoint: string;
  token_endpoint: string;
};

export type OAuthTokens = {
  access_token: string;
  refresh_token: string;
  id_token?: string;
  expires_in?: number | string;
  token_type?: string;
};

export type OAuthStore = {
  provider: "xai-oauth";
  auth_mode: "oauth_pkce";
  tokens: OAuthTokens;
  discovery?: OidcDiscovery;
  redirect_uri?: string;
  last_refresh?: string;
  updated_at?: string;
};

export function authStorePath(): string {
  if (process.env.AGENTMU_AUTH_PATH?.trim()) {
    return process.env.AGENTMU_AUTH_PATH.trim();
  }
  return path.join(os.homedir(), ".agentmu", "auth.json");
}

export function homeAgentMuDir(): string {
  return path.join(os.homedir(), ".agentmu");
}

export function pkceCodeVerifier(): string {
  return crypto.randomBytes(32).toString("base64url");
}

export function pkceCodeChallenge(verifier: string): string {
  return crypto.createHash("sha256").update(verifier).digest("base64url");
}

export function accessTokenIsExpiring(
  accessToken: string,
  skewSeconds = ACCESS_TOKEN_REFRESH_SKEW_SECONDS
): boolean {
  if (!accessToken || !accessToken.includes(".")) return false;
  try {
    const parts = accessToken.split(".");
    const payloadB64 = parts[1]!;
    const padded = payloadB64 + "=".repeat((4 - (payloadB64.length % 4)) % 4);
    const payload = JSON.parse(
      Buffer.from(padded, "base64url").toString("utf8")
    ) as { exp?: number };
    if (typeof payload.exp !== "number") return false;
    return payload.exp <= Date.now() / 1000 + Math.max(0, skewSeconds);
  } catch {
    return false;
  }
}

export async function discoverOidc(
  fetchImpl: typeof fetch = globalThis.fetch,
  timeoutMs = 15_000
): Promise<OidcDiscovery> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetchImpl(XAI_OAUTH_DISCOVERY_URL, {
      headers: { Accept: "application/json" },
      signal: ctrl.signal,
    });
    if (!res.ok) {
      throw new Error(`OIDC discovery HTTP ${res.status}`);
    }
    const data = (await res.json()) as Record<string, unknown>;
    const authorization_endpoint = String(
      data.authorization_endpoint ?? ""
    ).trim();
    const token_endpoint = String(data.token_endpoint ?? "").trim();
    if (!authorization_endpoint || !token_endpoint) {
      throw new Error("OIDC discovery missing endpoints");
    }
    validateXaiEndpoint(authorization_endpoint, "authorization_endpoint");
    validateXaiEndpoint(token_endpoint, "token_endpoint");
    return { authorization_endpoint, token_endpoint };
  } finally {
    clearTimeout(t);
  }
}

export function validateXaiEndpoint(url: string, field: string): void {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    throw new Error(`Invalid ${field}: ${url}`);
  }
  if (u.protocol !== "https:") {
    throw new Error(`${field} must be https`);
  }
  if (u.hostname !== "auth.x.ai" && !u.hostname.endsWith(".x.ai")) {
    throw new Error(`${field} host not allowed: ${u.hostname}`);
  }
}

export function buildAuthorizeUrl(opts: {
  authorizationEndpoint: string;
  redirectUri: string;
  codeChallenge: string;
  state: string;
  nonce: string;
  referrer?: string;
}): string {
  const params = new URLSearchParams({
    response_type: "code",
    client_id: XAI_OAUTH_CLIENT_ID,
    redirect_uri: opts.redirectUri,
    scope: XAI_OAUTH_SCOPE,
    code_challenge: opts.codeChallenge,
    code_challenge_method: "S256",
    state: opts.state,
    nonce: opts.nonce,
    plan: "generic",
    referrer: opts.referrer ?? "agentmu",
  });
  return `${opts.authorizationEndpoint}?${params.toString()}`;
}

export async function exchangeCodeForTokens(opts: {
  tokenEndpoint: string;
  code: string;
  redirectUri: string;
  codeVerifier: string;
  codeChallenge: string;
  fetchImpl?: typeof fetch;
}): Promise<OAuthTokens> {
  const fetchFn = opts.fetchImpl ?? globalThis.fetch;
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code: opts.code,
    redirect_uri: opts.redirectUri,
    client_id: XAI_OAUTH_CLIENT_ID,
    code_verifier: opts.codeVerifier,
    code_challenge: opts.codeChallenge,
    code_challenge_method: "S256",
  });
  const res = await fetchFn(opts.tokenEndpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: body.toString(),
  });
  const text = await res.text();
  if (!res.ok) {
    if (res.status === 403) {
      throw new Error(
        `xAI OAuth token exchange HTTP 403 — this account may not be entitled for API/OAuth access despite SuperGrok. ` +
          `Try XAI_API_KEY instead, or upgrade at https://x.ai/grok. Body: ${text.slice(0, 300)}`
      );
    }
    throw new Error(
      `xAI token exchange failed HTTP ${res.status}: ${text.slice(0, 400)}`
    );
  }
  const payload = JSON.parse(text) as Record<string, unknown>;
  const access_token = String(payload.access_token ?? "").trim();
  const refresh_token = String(payload.refresh_token ?? "").trim();
  if (!access_token || !refresh_token) {
    throw new Error("Token exchange missing access_token or refresh_token");
  }
  return {
    access_token,
    refresh_token,
    id_token: payload.id_token ? String(payload.id_token) : undefined,
    expires_in: payload.expires_in as number | string | undefined,
    token_type: payload.token_type
      ? String(payload.token_type)
      : "Bearer",
  };
}

export async function refreshOAuthTokens(opts: {
  refreshToken: string;
  tokenEndpoint?: string;
  fetchImpl?: typeof fetch;
}): Promise<OAuthTokens> {
  const fetchFn = opts.fetchImpl ?? globalThis.fetch;
  let endpoint = opts.tokenEndpoint?.trim() ?? "";
  if (!endpoint) {
    const d = await discoverOidc(fetchFn);
    endpoint = d.token_endpoint;
  } else {
    validateXaiEndpoint(endpoint, "token_endpoint");
  }
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    client_id: XAI_OAUTH_CLIENT_ID,
    refresh_token: opts.refreshToken,
  });
  const res = await fetchFn(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: body.toString(),
  });
  const text = await res.text();
  if (!res.ok) {
    if (res.status === 403) {
      throw new Error(
        `xAI OAuth refresh HTTP 403 — tier/entitlement gate. Use XAI_API_KEY or upgrade SuperGrok. ${text.slice(0, 200)}`
      );
    }
    const relogin = res.status === 400 || res.status === 401;
    throw new Error(
      `xAI token refresh failed HTTP ${res.status}${relogin ? " (re-login required)" : ""}: ${text.slice(0, 300)}`
    );
  }
  const payload = JSON.parse(text) as Record<string, unknown>;
  const access_token = String(payload.access_token ?? "").trim();
  const refresh_token =
    String(payload.refresh_token ?? "").trim() || opts.refreshToken;
  if (!access_token) {
    throw new Error("Refresh response missing access_token");
  }
  return {
    access_token,
    refresh_token,
    id_token: payload.id_token ? String(payload.id_token) : undefined,
    expires_in: payload.expires_in as number | string | undefined,
    token_type: payload.token_type
      ? String(payload.token_type)
      : "Bearer",
  };
}

export function loadOAuthStore(file = authStorePath()): OAuthStore | null {
  if (!fs.existsSync(file)) return null;
  try {
    const raw = JSON.parse(fs.readFileSync(file, "utf8")) as OAuthStore;
    if (raw?.provider !== "xai-oauth" || !raw.tokens?.access_token) return null;
    return raw;
  } catch {
    return null;
  }
}

export function saveOAuthStore(
  store: OAuthStore,
  file = authStorePath()
): string {
  const dir = path.dirname(file);
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  const next: OAuthStore = {
    ...store,
    provider: "xai-oauth",
    auth_mode: "oauth_pkce",
    updated_at: new Date().toISOString(),
  };
  fs.writeFileSync(file, JSON.stringify(next, null, 2) + "\n", {
    encoding: "utf8",
    mode: 0o600,
  });
  return file;
}

export function clearOAuthStore(file = authStorePath()): boolean {
  if (!fs.existsSync(file)) return false;
  fs.unlinkSync(file);
  return true;
}

export type ResolveCredsResult = {
  apiKey: string;
  source: "oauth" | "api_key";
  baseUrl: string;
};

/**
 * Resolve a bearer token for xAI: prefer SuperGrok OAuth (with refresh), else API key.
 */
export async function resolveXaiCredentials(opts?: {
  fetchImpl?: typeof fetch;
  forceRefresh?: boolean;
}): Promise<ResolveCredsResult | null> {
  const fetchFn = opts?.fetchImpl ?? globalThis.fetch;
  const store = loadOAuthStore();
  if (store?.tokens?.access_token && store.tokens.refresh_token) {
    let access = store.tokens.access_token;
    let tokens = store.tokens;
    if (
      opts?.forceRefresh ||
      accessTokenIsExpiring(access, ACCESS_TOKEN_REFRESH_SKEW_SECONDS)
    ) {
      try {
        tokens = await refreshOAuthTokens({
          refreshToken: store.tokens.refresh_token,
          tokenEndpoint: store.discovery?.token_endpoint,
          fetchImpl: fetchFn,
        });
        access = tokens.access_token;
        saveOAuthStore({
          ...store,
          tokens,
          last_refresh: new Date().toISOString(),
        });
      } catch (err) {
        // Fall through to API key if refresh fails and key exists
        const key = process.env.XAI_API_KEY || process.env.GROK_API_KEY;
        if (key) {
          return {
            apiKey: key,
            source: "api_key",
            baseUrl:
              process.env.AGENTMU_BASE_URL ||
              process.env.XAI_BASE_URL ||
              DEFAULT_XAI_BASE_URL,
          };
        }
        throw err;
      }
    }
    return {
      apiKey: access,
      source: "oauth",
      baseUrl:
        process.env.AGENTMU_BASE_URL ||
        process.env.XAI_BASE_URL ||
        DEFAULT_XAI_BASE_URL,
    };
  }

  const key = process.env.XAI_API_KEY || process.env.GROK_API_KEY;
  if (key) {
    return {
      apiKey: key,
      source: "api_key",
      baseUrl:
        process.env.AGENTMU_BASE_URL ||
        process.env.XAI_BASE_URL ||
        DEFAULT_XAI_BASE_URL,
    };
  }
  return null;
}

function openBrowser(url: string): void {
  const platform = process.platform;
  try {
    if (platform === "darwin") spawn("open", [url], { detached: true, stdio: "ignore" });
    else if (platform === "win32")
      spawn("cmd", ["/c", "start", "", url], { detached: true, stdio: "ignore" });
    else spawn("xdg-open", [url], { detached: true, stdio: "ignore" });
  } catch {
    // ignore
  }
}

export type LoginOptions = {
  openBrowser?: boolean;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
  onMessage?: (msg: string) => void;
};

/**
 * Interactive SuperGrok / X Premium+ login (PKCE + loopback on 127.0.0.1:56121).
 */
export async function loginWithBrowser(
  opts: LoginOptions = {}
): Promise<OAuthStore> {
  const log = opts.onMessage ?? ((m: string) => console.log(m));
  const fetchFn = opts.fetchImpl ?? globalThis.fetch;
  const timeoutMs = opts.timeoutMs ?? 180_000;
  const discovery = await discoverOidc(fetchFn);
  const redirectUri = `http://${XAI_OAUTH_REDIRECT_HOST}:${XAI_OAUTH_REDIRECT_PORT}${XAI_OAUTH_REDIRECT_PATH}`;
  const codeVerifier = pkceCodeVerifier();
  const codeChallenge = pkceCodeChallenge(codeVerifier);
  const state = crypto.randomBytes(16).toString("hex");
  const nonce = crypto.randomBytes(16).toString("hex");
  const authorizeUrl = buildAuthorizeUrl({
    authorizationEndpoint: discovery.authorization_endpoint,
    redirectUri,
    codeChallenge,
    state,
    nonce,
  });

  const { code } = await waitForLoopbackCode({
    redirectUri,
    expectedState: state,
    timeoutMs,
    authorizeUrl,
    openBrowser: opts.openBrowser !== false,
    log,
  });

  const tokens = await exchangeCodeForTokens({
    tokenEndpoint: discovery.token_endpoint,
    code,
    redirectUri,
    codeVerifier,
    codeChallenge,
    fetchImpl: fetchFn,
  });

  const store: OAuthStore = {
    provider: "xai-oauth",
    auth_mode: "oauth_pkce",
    tokens,
    discovery,
    redirect_uri: redirectUri,
    last_refresh: new Date().toISOString(),
  };
  const file = saveOAuthStore(store);
  log(`Saved OAuth credentials → ${file}`);
  return store;
}

async function waitForLoopbackCode(opts: {
  redirectUri: string;
  expectedState: string;
  timeoutMs: number;
  authorizeUrl: string;
  openBrowser: boolean;
  log: (m: string) => void;
}): Promise<{ code: string }> {
  return new Promise((resolve, reject) => {
    const u = new URL(opts.redirectUri);
    const server = http.createServer((req, res) => {
      try {
        const reqUrl = new URL(req.url || "/", `http://${u.host}`);
        if (reqUrl.pathname !== u.pathname) {
          res.writeHead(404);
          res.end("Not found");
          return;
        }
        const err = reqUrl.searchParams.get("error");
        if (err) {
          const desc = reqUrl.searchParams.get("error_description") || err;
          res.writeHead(400, { "Content-Type": "text/html; charset=utf-8" });
          res.end(
            `<html><body><h1>AgentMu login failed</h1><p>${escapeHtml(desc)}</p></body></html>`
          );
          cleanup();
          reject(new Error(`Authorization failed: ${desc}`));
          return;
        }
        const code = reqUrl.searchParams.get("code");
        const st = reqUrl.searchParams.get("state");
        if (!code || st !== opts.expectedState) {
          res.writeHead(400, { "Content-Type": "text/html; charset=utf-8" });
          res.end(
            `<html><body><h1>Invalid callback</h1><p>Missing code or state mismatch.</p></body></html>`
          );
          cleanup();
          reject(new Error("Invalid OAuth callback (code/state)"));
          return;
        }
        res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
        res.end(
          `<html><body style="font-family:system-ui;padding:2rem">` +
            `<h1>AgentMu · Artifact</h1>` +
            `<p>Login successful. You can close this tab and return to the terminal.</p>` +
            `</body></html>`
        );
        cleanup();
        resolve({ code });
      } catch (e) {
        cleanup();
        reject(e);
      }
    });

    const timer = setTimeout(() => {
      cleanup();
      reject(
        new Error(
          `OAuth timed out after ${opts.timeoutMs}ms. Re-run: agentmu login`
        )
      );
    }, opts.timeoutMs);

    function cleanup() {
      clearTimeout(timer);
      try {
        server.close();
      } catch {
        /* ignore */
      }
    }

    server.on("error", (e) => {
      cleanup();
      reject(
        new Error(
          `Could not bind ${opts.redirectUri}: ${e instanceof Error ? e.message : e}. ` +
            `Is another agent (Hermes/AgentMu) already listening on port ${XAI_OAUTH_REDIRECT_PORT}?`
        )
      );
    });

    server.listen(Number(u.port), u.hostname, () => {
      opts.log("Sign in with SuperGrok or X Premium+ (your own subscription).");
      opts.log("");
      opts.log("Open this URL to authorize AgentMu with xAI:");
      opts.log(opts.authorizeUrl);
      opts.log("");
      opts.log(`Waiting for callback on ${opts.redirectUri}`);
      if (opts.openBrowser) openBrowser(opts.authorizeUrl);
    });
  });
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function oauthStatusSummary(): string {
  const store = loadOAuthStore();
  if (!store) return "oauth: not logged in";
  const exp = accessTokenIsExpiring(store.tokens.access_token, 0)
    ? "expired/expiring"
    : "valid";
  const when = store.updated_at || store.last_refresh || "?";
  return `oauth: logged in (${exp}, updated ${when})`;
}
