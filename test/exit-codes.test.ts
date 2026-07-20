import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  classifyRunExit,
  EXIT_ERROR,
  EXIT_OK,
  EXIT_PERMISSION,
} from "../src/exit-codes.js";

describe("classifyRunExit", () => {
  it("returns 0 on clean run", () => {
    assert.equal(
      classifyRunExit({ permissionDenies: 0, toolSuccesses: 2 }),
      EXIT_OK
    );
  });

  it("returns 0 when denials mixed with successes", () => {
    assert.equal(
      classifyRunExit({ permissionDenies: 1, toolSuccesses: 1 }),
      EXIT_OK
    );
  });

  it("returns 2 when only permission denials", () => {
    assert.equal(
      classifyRunExit({ permissionDenies: 2, toolSuccesses: 0 }),
      EXIT_PERMISSION
    );
  });

  it("returns 1 on fatal", () => {
    assert.equal(
      classifyRunExit({ permissionDenies: 0, toolSuccesses: 0, fatal: true }),
      EXIT_ERROR
    );
  });
});
