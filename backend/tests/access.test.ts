import assert from "node:assert/strict";
import { test } from "./run.js";
import { isPremiumAccessAllowed } from "../services/subscription/access.js";

test("access: active + future access_until => allowed", () => {
  const allowed = isPremiumAccessAllowed({
    subscriptionStatus: "active",
    planAccessUntil: new Date(Date.now() + 60_000),
    currentPeriodEnd: null,
    periodEnd: new Date(Date.now() + 60_000),
  });
  assert.equal(allowed, true);
});

test("access: canceling + future access_until => allowed", () => {
  const allowed = isPremiumAccessAllowed({
    subscriptionStatus: "canceling",
    planAccessUntil: new Date(Date.now() + 60_000),
    currentPeriodEnd: null,
    periodEnd: new Date(Date.now() + 60_000),
  });
  assert.equal(allowed, true);
});

test("access: past_due => denied", () => {
  const allowed = isPremiumAccessAllowed({
    subscriptionStatus: "past_due",
    planAccessUntil: new Date(Date.now() + 60_000),
    currentPeriodEnd: null,
    periodEnd: new Date(Date.now() + 60_000),
  });
  assert.equal(allowed, false);
});

test("access: access_until in the past => denied", () => {
  const allowed = isPremiumAccessAllowed({
    subscriptionStatus: "active",
    planAccessUntil: new Date(Date.now() - 1),
    currentPeriodEnd: null,
    periodEnd: new Date(Date.now() - 1),
  });
  assert.equal(allowed, false);
});

test("access: account deletion requested => denied", () => {
  const allowed = isPremiumAccessAllowed({
    subscriptionStatus: "active",
    accountDeletionRequested: true,
    planAccessUntil: new Date(Date.now() + 60_000),
    currentPeriodEnd: null,
    periodEnd: new Date(Date.now() + 60_000),
  });
  assert.equal(allowed, false);
});
