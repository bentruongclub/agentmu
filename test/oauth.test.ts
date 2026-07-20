import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import {
  pkceCodeChallenge,
  pkceCodeVerifier,
  accessTokenIsExpiring,
  buildAuthorizeUrl,
  exchangeCodeForTokens,
  refreshOAuthTokens,
  saveOAuthStore,
  loadOAuthStore,
  clearOAuthStore,
  resolveXaiCredentials,
  XAI_OAUTH_CLIENT_ID,
} from "../src/oauth.js";

describe("oauth PKCE + store + resolve", () => {
  let authFile: string;
  let prevAuth: string | undefined;
  let prevKey: string | undefined;
  let prevGrok: string | undefined;

  before(() => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "agentmu-oauth-"));
    authFile = path.join(dir, "auth.json");
    prevAuth = process.env.AGENTMU_AUTH_PATH;
    prevKey = process.env.XAI_API_KEY;
    prevGrok = process.env.GROK_API_KEY;
    process.env.AGENTMU_AUTH_PATH = authFile;
    delete process.env.XAI_API_KEY;
    delete process.env.GROK_API_KEY;
  });

  after(() => {
    if (prevAuth !== undefined) process.env.AGENTMU_AUTH_PATH = prevAuth;
    else delete process.env.AGENTMU_AUTH_PATH;
    if (prevKey !== undefined) process.env.XAI_API_KEY = prevKey;
    else delete process.env.XAI_API_KEY;
    if (prevGrok !== undefined) process.env.GROK_API_KEY = prevGrok;
    else delete process.env.GROK_API_KEY;
    try {
      fs.rmSync(path.dirname(authFile), { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  });

  it("pkce verifier/challenge are S256-shaped", () => {
    const v = pkceCodeVerifier();
    assert.ok(v.length >= 32);
    const c = pkceCodeChallenge(v);
    assert.equal(c.length, 43); // base64url sha256
    assert.notEqual(v, c);
  });

  it("buildAuthorizeUrl includes client_id, PKCE, plan=generic", () => {
    const url = buildAuthorizeUrl({
      authorizationEndpoint: "https://auth.x.ai/oauth2/authorize",
      redirectUri: "http://127.0.0.1:56121/callback",
      codeChallenge: "abc",
      state: "st",
      nonce: "nn",
    });
    assert.match(url, new RegExp(XAI_OAUTH_CLIENT_ID));
    assert.match(url, /code_challenge=abc/);
    assert.match(url, /plan=generic/);
    assert.match(url, /referrer=agentmu/);
  });

  it("accessTokenIsExpiring reads JWT exp", () => {
    const exp = Math.floor(Date.now() / 1000) + 3600;
    const payload = Buffer.from(JSON.stringify({ exp })).toString("base64url");
    const token = `hdr.${payload}.sig`;
    assert.equal(accessTokenIsExpiring(token, 60), false);

    const expPast = Math.floor(Date.now() / 1000) - 10;
    const payload2 = Buffer.from(JSON.stringify({ exp: expPast })).toString(
      "base64url"
    );
    assert.equal(accessTokenIsExpiring(`hdr.${payload2}.sig`, 0), true);
  });

  it("exchangeCodeForTokens posts PKCE fields (mocked fetch)", async () => {
    let sawBody = "";
    const fetchImpl: typeof fetch = async (_url, init) => {
      sawBody = String(init?.body ?? "");
      return new Response(
        JSON.stringify({
          access_token: "at-1",
          refresh_token: "rt-1",
          token_type: "Bearer",
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    };
    const tokens = await exchangeCodeForTokens({
      tokenEndpoint: "https://auth.x.ai/oauth2/token",
      code: "the-code",
      redirectUri: "http://127.0.0.1:56121/callback",
      codeVerifier: "verifier",
      codeChallenge: "challenge",
      fetchImpl,
    });
    assert.equal(tokens.access_token, "at-1");
    assert.equal(tokens.refresh_token, "rt-1");
    assert.match(sawBody, /grant_type=authorization_code/);
    assert.match(sawBody, /code_verifier=verifier/);
    assert.match(sawBody, /code_challenge=challenge/);
    assert.match(sawBody, new RegExp(XAI_OAUTH_CLIENT_ID));
  });

  it("refreshOAuthTokens updates access token (mocked)", async () => {
    const fetchImpl: typeof fetch = async () =>
      new Response(
        JSON.stringify({
          access_token: "at-new",
          refresh_token: "rt-new",
        }),
        { status: 200 }
      );
    const tokens = await refreshOAuthTokens({
      refreshToken: "rt-old",
      tokenEndpoint: "https://auth.x.ai/oauth2/token",
      fetchImpl,
    });
    assert.equal(tokens.access_token, "at-new");
    assert.equal(tokens.refresh_token, "rt-new");
  });

  it("save/load/clear OAuth store + resolve prefers oauth", async () => {
    clearOAuthStore(authFile);
    const exp = Math.floor(Date.now() / 1000) + 7200;
    const payload = Buffer.from(JSON.stringify({ exp })).toString("base64url");
    const access = `hdr.${payload}.sig`;
    saveOAuthStore(
      {
        provider: "xai-oauth",
        auth_mode: "oauth_pkce",
        tokens: {
          access_token: access,
          refresh_token: "rt-keep",
        },
        discovery: {
          authorization_endpoint: "https://auth.x.ai/oauth2/authorize",
          token_endpoint: "https://auth.x.ai/oauth2/token",
        },
      },
      authFile
    );
    const loaded = loadOAuthStore(authFile);
    assert.ok(loaded);
    assert.equal(loaded!.tokens.refresh_token, "rt-keep");

    const creds = await resolveXaiCredentials({
      fetchImpl: async () => {
        throw new Error("should not refresh non-expiring token");
      },
    });
    assert.ok(creds);
    assert.equal(creds!.source, "oauth");
    assert.equal(creds!.apiKey, access);

    clearOAuthStore(authFile);
    assert.equal(loadOAuthStore(authFile), null);

    process.env.XAI_API_KEY = "xai-test-key";
    const keyCreds = await resolveXaiCredentials();
    assert.ok(keyCreds);
    assert.equal(keyCreds!.source, "api_key");
    assert.equal(keyCreds!.apiKey, "xai-test-key");
    delete process.env.XAI_API_KEY;
  });
});
