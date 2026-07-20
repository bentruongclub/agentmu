import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { runTool, TOOL_NAMES, toolDefinitions } from "../src/tools/index.js";
import { webSearch } from "../src/tools/web.js";
import { xSearch } from "../src/tools/x_search.js";
import { generateImage } from "../src/tools/image.js";

describe("shipped workspace tools (real disk)", () => {
  let workspace: string;

  before(() => {
    workspace = fs.mkdtempSync(path.join(os.tmpdir(), "agentmu-tools-"));
  });

  after(() => {
    fs.rmSync(workspace, { recursive: true, force: true });
  });

  it("write → read → list → shell → save_artifact with real side effects", async () => {
    const writeRes = await runTool(
      "write_file",
      JSON.stringify({ path: "notes/hello.txt", content: "hello-agentmu\n" }),
      { workspace }
    );
    assert.match(writeRes, /Wrote /);
    assert.equal(
      fs.readFileSync(path.join(workspace, "notes/hello.txt"), "utf8"),
      "hello-agentmu\n"
    );

    const readRes = await runTool(
      "read_file",
      JSON.stringify({ path: "notes/hello.txt" }),
      { workspace }
    );
    assert.match(readRes, /hello-agentmu/);

    const listRes = await runTool(
      "list_dir",
      JSON.stringify({ path: "notes" }),
      { workspace }
    );
    assert.match(listRes, /hello\.txt/);

    const shellRes = await runTool(
      "run_shell",
      JSON.stringify({ command: "echo agentmu-shell-ok" }),
      { workspace }
    );
    assert.match(shellRes, /agentmu-shell-ok/);

    const artRes = await runTool(
      "save_artifact",
      JSON.stringify({
        name: "proof",
        content: "real artifact body",
        label: "Artifact",
        extension: "md",
      }),
      { workspace }
    );
    assert.match(artRes, /Artifact saved:/);
    assert.match(artRes, /label: Artifact/);

    const artDir = path.join(workspace, "sessions", "artifacts");
    const files = fs.readdirSync(artDir);
    assert.ok(files.length >= 1, "artifact file on disk");
    const content = fs.readFileSync(path.join(artDir, files[0]!), "utf8");
    assert.match(content, /agentmu-artifact label="Artifact"/);
    assert.match(content, /real artifact body/);
  });

  it("exposes AgenC-like multi-tool definitions including web + code + x + image", () => {
    const names = new Set(TOOL_NAMES);
    for (const n of [
      "read_file",
      "write_file",
      "list_dir",
      "run_shell",
      "save_artifact",
      "web_search",
      "x_search",
      "generate_image",
    ]) {
      assert.ok(names.has(n), `missing tool definition: ${n}`);
    }
    assert.ok(toolDefinitions.length >= 8);
  });
});

describe("multi-capability tools", () => {
  it("web_search returns useful payload or explicit error (live Wikipedia when network allows)", async () => {
    const res = await webSearch("artificial intelligence", { maxResults: 2 });
    assert.ok(res.length > 0, "non-empty result");
    // Either wikipedia results or structured error
    const ok =
      res.includes("web_search") ||
      res.startsWith("error:") ||
      res.includes("wikipedia");
    assert.ok(ok, `unexpected shape: ${res.slice(0, 200)}`);
    if (!res.startsWith("error:")) {
      assert.match(res, /https?:\/\//);
    }
  });

  it("web_search via runTool ships through the same entry point", async () => {
    const workspace = fs.mkdtempSync(path.join(os.tmpdir(), "agentmu-web-"));
    try {
      const res = await runTool(
        "web_search",
        JSON.stringify({ query: "Agent", max_results: 2 }),
        { workspace }
      );
      assert.ok(res.length > 0);
      assert.ok(
        res.includes("web_search") || res.startsWith("error:"),
        res.slice(0, 300)
      );
    } finally {
      fs.rmSync(workspace, { recursive: true, force: true });
    }
  });

  it("x_search returns honest missing-credential error without bearer token", async () => {
    const prev = process.env.X_BEARER_TOKEN;
    const prev2 = process.env.TWITTER_BEARER_TOKEN;
    delete process.env.X_BEARER_TOKEN;
    delete process.env.TWITTER_BEARER_TOKEN;
    try {
      const res = await xSearch("from:tetsuoai AgenC");
      assert.match(res, /^error:/);
      assert.match(res, /X_BEARER_TOKEN/);
    } finally {
      if (prev !== undefined) process.env.X_BEARER_TOKEN = prev;
      if (prev2 !== undefined) process.env.TWITTER_BEARER_TOKEN = prev2;
    }
  });

  it("x_search via runTool same honest error", async () => {
    const prev = process.env.X_BEARER_TOKEN;
    const prev2 = process.env.TWITTER_BEARER_TOKEN;
    delete process.env.X_BEARER_TOKEN;
    delete process.env.TWITTER_BEARER_TOKEN;
    const workspace = fs.mkdtempSync(path.join(os.tmpdir(), "agentmu-x-"));
    try {
      const res = await runTool(
        "x_search",
        JSON.stringify({ query: "AgentMu" }),
        { workspace }
      );
      assert.match(res, /^error:/);
      assert.match(res, /X_BEARER_TOKEN|credential/i);
    } finally {
      fs.rmSync(workspace, { recursive: true, force: true });
      if (prev !== undefined) process.env.X_BEARER_TOKEN = prev;
      if (prev2 !== undefined) process.env.TWITTER_BEARER_TOKEN = prev2;
    }
  });

  it("generate_image returns honest missing-key error without credentials", async () => {
    const prev = process.env.XAI_API_KEY;
    const prev2 = process.env.GROK_API_KEY;
    const prevAuth = process.env.AGENTMU_AUTH_PATH;
    const emptyAuth = path.join(
      fs.mkdtempSync(path.join(os.tmpdir(), "agentmu-noauth-")),
      "auth.json"
    );
    delete process.env.XAI_API_KEY;
    delete process.env.GROK_API_KEY;
    process.env.AGENTMU_AUTH_PATH = emptyAuth;
    try {
      const res = await generateImage("a blue cube");
      assert.match(res, /^error:/);
      assert.match(res, /login|XAI_API_KEY/i);
    } finally {
      if (prev !== undefined) process.env.XAI_API_KEY = prev;
      else delete process.env.XAI_API_KEY;
      if (prev2 !== undefined) process.env.GROK_API_KEY = prev2;
      else delete process.env.GROK_API_KEY;
      if (prevAuth !== undefined) process.env.AGENTMU_AUTH_PATH = prevAuth;
      else delete process.env.AGENTMU_AUTH_PATH;
    }
  });

  it("generate_image via runTool same honest error", async () => {
    const prev = process.env.XAI_API_KEY;
    const prev2 = process.env.GROK_API_KEY;
    const prevAuth = process.env.AGENTMU_AUTH_PATH;
    const emptyAuth = path.join(
      fs.mkdtempSync(path.join(os.tmpdir(), "agentmu-noauth2-")),
      "auth.json"
    );
    delete process.env.XAI_API_KEY;
    delete process.env.GROK_API_KEY;
    process.env.AGENTMU_AUTH_PATH = emptyAuth;
    const workspace = fs.mkdtempSync(path.join(os.tmpdir(), "agentmu-img-"));
    try {
      const res = await runTool(
        "generate_image",
        JSON.stringify({ prompt: "a red circle" }),
        { workspace }
      );
      assert.match(res, /^error:/);
      assert.match(res, /login|XAI_API_KEY/i);
    } finally {
      fs.rmSync(workspace, { recursive: true, force: true });
      if (prev !== undefined) process.env.XAI_API_KEY = prev;
      else delete process.env.XAI_API_KEY;
      if (prev2 !== undefined) process.env.GROK_API_KEY = prev2;
      else delete process.env.GROK_API_KEY;
      if (prevAuth !== undefined) process.env.AGENTMU_AUTH_PATH = prevAuth;
      else delete process.env.AGENTMU_AUTH_PATH;
    }
  });
});
