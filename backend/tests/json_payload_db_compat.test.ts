import assert from "node:assert/strict";
import { test } from "./run.ts";

// Copy of the internal logic in `backend/DB/queriesSQL/queriesSQL.ts`.
// Goal: ensure we always produce a JSON-valid string for MariaDB's
// LONGTEXT + CHECK(json_valid(...)) implementation.
function stringifyJsonForDb(value: unknown): string | null {
  if (value == null) return null;

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return JSON.stringify(value);
    try {
      JSON.parse(trimmed);
      return trimmed;
    } catch {
      return JSON.stringify(value);
    }
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return JSON.stringify(value);
  }

  const seen = new WeakSet<object>();
  const json = JSON.stringify(value, (_key, v) => {
    if (v && typeof v === "object") {
      const asObj = v as object;
      if (seen.has(asObj)) return "[Circular]";
      seen.add(asObj);
    }
    if (typeof v === "bigint") return v.toString();
    return v;
  });

  const MAX_CHARS = 1_000_000;
  if (json && json.length > MAX_CHARS) {
    return JSON.stringify({
      truncated: true,
      originalLength: json.length,
      preview: json.slice(0, 50_000),
    });
  }

  return json ?? null;
}

function assertJsonValid(maybeJson: string | null) {
  if (maybeJson == null) return;
  assert.doesNotThrow(() => JSON.parse(maybeJson));
}

test("db compat: replicate_payload always JSON-valid", () => {
  assert.equal(stringifyJsonForDb(null), null);
  assert.equal(stringifyJsonForDb(undefined), null);

  // Plain strings become JSON strings (valid).
  assertJsonValid(stringifyJsonForDb(""));
  assertJsonValid(stringifyJsonForDb("not json"));

  // JSON text stays JSON text.
  assert.equal(stringifyJsonForDb('{"a":1}'), '{"a":1}');
  assertJsonValid(stringifyJsonForDb('{"a":1}'));

  // Numbers/booleans.
  assert.equal(stringifyJsonForDb(1), "1");
  assert.equal(stringifyJsonForDb(true), "true");

  // Objects.
  assertJsonValid(stringifyJsonForDb({ a: 1, b: "x" }));

  // Circular structures should not throw.
  const circular: any = { a: 1 };
  circular.self = circular;
  assertJsonValid(stringifyJsonForDb(circular));
});
