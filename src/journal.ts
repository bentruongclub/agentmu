/**
 * Append-only session event journal (JSONL).
 * Source of truth for audit / replay — separate from chat messages blob.
 */

import fs from "node:fs";
import path from "node:path";
import { redactJournalEvent } from "./redact.js";

export type JournalEvent =
  | { type: "session_start"; sessionId: string; label: string; model: string }
  | { type: "user_message"; text: string }
  | { type: "assistant_text"; text: string }
  | { type: "tool_call"; name: string; args: string }
  | {
      type: "permission";
      name: string;
      allowed: boolean;
      reason: string;
      via: string;
    }
  | { type: "tool_result"; name: string; result_preview: string }
  | { type: "done"; text: string }
  | { type: "error"; message: string };

export type JournalRecord = JournalEvent & {
  ts: string;
  sessionId: string;
};

export function journalPath(workspace: string, sessionId: string): string {
  return path.join(workspace, "sessions", `${sessionId}.events.jsonl`);
}

export function appendJournal(
  workspace: string,
  sessionId: string,
  event: JournalEvent
): string {
  const dir = path.join(workspace, "sessions");
  fs.mkdirSync(dir, { recursive: true });
  const file = journalPath(workspace, sessionId);
  const redacted = redactJournalEvent({
    ts: new Date().toISOString(),
    sessionId,
    ...event,
  } as Record<string, unknown>);
  const record = redacted as JournalRecord;
  fs.appendFileSync(file, JSON.stringify(record) + "\n", "utf8");
  return file;
}

export function readJournal(
  workspace: string,
  sessionId: string
): JournalRecord[] {
  const file = journalPath(workspace, sessionId);
  if (!fs.existsSync(file)) return [];
  const lines = fs.readFileSync(file, "utf8").split("\n").filter(Boolean);
  const out: JournalRecord[] = [];
  for (const line of lines) {
    try {
      out.push(JSON.parse(line) as JournalRecord);
    } catch {
      /* skip bad lines */
    }
  }
  return out;
}
