const MB = 1024 * 1024;

type PlanLike = {
  name: string;
  size_max?: string | null;
};

function parseSizeMaxToBytes(sizeMax: unknown): number | null {
  if (typeof sizeMax !== "string") return null;
  const trimmed = sizeMax.trim().toLowerCase();
  const match = trimmed.match(/^(\d+(?:\.\d+)?)\s*(mb|m)$/i);
  if (!match) return null;
  const value = Number(match[1]);
  if (!Number.isFinite(value) || value <= 0) return null;
  return Math.round(value * MB);
}

function bytesToRoundedMb(bytes: number): number {
  if (!Number.isFinite(bytes) || bytes <= 0) return 0;
  return Math.round(bytes / MB);
}

export function getMaxUploadForUser(params: {
  plans: PlanLike[];
  isAuthenticated: boolean;
  planCode?: string | null;
}): { maxBytes: number; maxMb: number; planName: string } {
  const planName = params.isAuthenticated
    ? String(params.planCode || "free").trim().toLowerCase() || "free"
    : "visitor";

  const cfg = Array.isArray(params.plans)
    ? params.plans.find((p) => p && typeof p.name === "string" && p.name === planName)
    : undefined;

  const parsed = parseSizeMaxToBytes(cfg?.size_max);
  if (parsed && parsed > 0) {
    return { maxBytes: parsed, maxMb: bytesToRoundedMb(parsed), planName };
  }

  // Defensive fallback (keeps UX consistent even if API/cache is stale).
  if (planName === "hobby" || planName === "pro") {
    const maxBytes = 10 * MB;
    return { maxBytes, maxMb: bytesToRoundedMb(maxBytes), planName };
  }
  const maxBytes = 5 * MB;
  return { maxBytes, maxMb: bytesToRoundedMb(maxBytes), planName };
}

