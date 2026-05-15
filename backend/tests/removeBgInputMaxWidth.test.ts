import assert from "node:assert/strict";
import { test } from "./run.ts";
import {
  pickRemoveBgInputMaxWidth,
  REMOVE_BG_MAX_WIDTH_DEFAULT,
  REMOVE_BG_MAX_WIDTH_VISITOR_OR_FREE,
} from "../services/removeBg/removeBgInputMaxWidth.ts";

test("remove-bg input maxWidth: visitor => 512", () => {
  const width = pickRemoveBgInputMaxWidth({ isAuthenticated: false, planCode: null });
  assert.equal(width, REMOVE_BG_MAX_WIDTH_VISITOR_OR_FREE);
});

test("remove-bg input maxWidth: authenticated free => 512", () => {
  const width = pickRemoveBgInputMaxWidth({ isAuthenticated: true, planCode: "free" });
  assert.equal(width, REMOVE_BG_MAX_WIDTH_VISITOR_OR_FREE);
});

test("remove-bg input maxWidth: authenticated paid => 1080", () => {
  const width = pickRemoveBgInputMaxWidth({ isAuthenticated: true, planCode: "hobby" });
  assert.equal(width, REMOVE_BG_MAX_WIDTH_DEFAULT);
});
