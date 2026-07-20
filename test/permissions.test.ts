import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  authorizeTool,
  parsePermissionMode,
} from "../src/permissions.js";

describe("permissions pipeline", () => {
  it("parsePermissionMode aliases", () => {
    assert.equal(parsePermissionMode("safe"), "safe");
    assert.equal(parsePermissionMode("strict"), "safe");
    assert.equal(parsePermissionMode("bypass"), "bypass");
    assert.equal(parsePermissionMode("yolo"), "bypass");
    assert.equal(parsePermissionMode("default"), "default");
    assert.equal(parsePermissionMode(undefined), "default");
  });

  it("default mode allows write, denies shell", () => {
    const cfg = { mode: "default" as const };
    assert.equal(
      authorizeTool("write_file", '{"path":"a","content":"b"}', cfg).allowed,
      true
    );
    assert.equal(
      authorizeTool("read_file", '{"path":"a"}', cfg).allowed,
      true
    );
    const shell = authorizeTool(
      "run_shell",
      JSON.stringify({ command: "echo hi" }),
      cfg
    );
    assert.equal(shell.allowed, false);
    assert.match(shell.reason, /run_shell denied/i);
  });

  it("allowTools can enable shell in default mode", () => {
    const cfg = { mode: "default" as const, allowTools: ["run_shell"] };
    const shell = authorizeTool(
      "run_shell",
      JSON.stringify({ command: "echo hi" }),
      cfg
    );
    assert.equal(shell.allowed, true);
  });

  it("safe mode denies write and shell", () => {
    const cfg = { mode: "safe" as const };
    assert.equal(
      authorizeTool("write_file", '{"path":"a","content":"b"}', cfg).allowed,
      false
    );
    assert.equal(
      authorizeTool("run_shell", '{"command":"ls"}', cfg).allowed,
      false
    );
    assert.equal(
      authorizeTool("read_file", '{"path":"a"}', cfg).allowed,
      true
    );
    assert.equal(
      authorizeTool("web_search", '{"query":"x"}', cfg).allowed,
      true
    );
  });

  it("bypass allows shell but still blocks dangerous patterns", () => {
    const cfg = { mode: "bypass" as const };
    assert.equal(
      authorizeTool("run_shell", '{"command":"echo ok"}', cfg).allowed,
      true
    );
    const bad = authorizeTool(
      "run_shell",
      JSON.stringify({ command: "rm -rf /" }),
      cfg
    );
    assert.equal(bad.allowed, false);
    assert.equal(bad.via, "dangerous");
  });

  it("denyTools wins over allow and bypass", () => {
    const cfg = {
      mode: "bypass" as const,
      allowTools: ["write_file"],
      denyTools: ["write_file"],
    };
    assert.equal(
      authorizeTool("write_file", '{"path":"a","content":"b"}', cfg).allowed,
      false
    );
  });
});
