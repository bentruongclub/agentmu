import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import {
  defaultConfig,
  displayName,
  loadConfig,
  saveConfig,
} from "../src/config.js";
import { banner, buildSystemPrompt, promptPrefix } from "../src/identity.js";

describe("config + Artifact label", () => {
  it("defaultConfig can be labeled Artifact and displayName includes both", () => {
    const cfg = defaultConfig({
      label: "Artifact",
      workspace: "/tmp/agentmu-test-ws",
    });
    assert.equal(cfg.product, "AgentMu");
    assert.equal(cfg.label, "Artifact");
    assert.equal(displayName(cfg), "AgentMu · Artifact");
    assert.equal(promptPrefix(cfg), "[Artifact]");
    const b = banner(cfg);
    assert.match(b, /AgentMu/);
    assert.match(b, /Artifact/);
    const sys = buildSystemPrompt(cfg);
    assert.match(sys, /Artifact/);
    assert.match(sys, /web_search/);
  });

  it("saveConfig + loadConfig persists label Artifact across reloads", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "agentmu-cfg-"));
    try {
      const cfg = defaultConfig({
        label: "Artifact",
        workspace: dir,
        model: "grok-4.5",
      });
      const file = saveConfig(cfg, "local");
      assert.ok(fs.existsSync(file));
      const raw = JSON.parse(fs.readFileSync(file, "utf8")) as {
        label: string;
        product: string;
      };
      assert.equal(raw.label, "Artifact");
      assert.equal(raw.product, "AgentMu");

      const loaded = loadConfig(dir);
      assert.equal(loaded.label, "Artifact");
      assert.equal(loaded.product, "AgentMu");
      assert.equal(displayName(loaded), "AgentMu · Artifact");

      // second load still Artifact
      const loaded2 = loadConfig(dir);
      assert.equal(loaded2.label, "Artifact");
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});
