import assert from "node:assert/strict";
import { test } from "./run.ts";
import { resolvePlanChangeType } from "../services/subscription/planChange.ts";

test("plan change: upgrade when target price is higher", () => {
  assert.equal(
    resolvePlanChangeType({ currentPlanPrice: 500, targetPlanPrice: 1500 }),
    "upgrade"
  );
});

test("plan change: downgrade when target price is lower", () => {
  assert.equal(
    resolvePlanChangeType({ currentPlanPrice: 1500, targetPlanPrice: 500 }),
    "downgrade"
  );
});

test("plan change: downgrade when price is equal (no-op handled elsewhere)", () => {
  assert.equal(
    resolvePlanChangeType({ currentPlanPrice: 500, targetPlanPrice: 500 }),
    "downgrade"
  );
});

