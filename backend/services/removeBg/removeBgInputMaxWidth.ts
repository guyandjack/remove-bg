export const REMOVE_BG_MAX_WIDTH_VISITOR_OR_FREE = 512;
export const REMOVE_BG_MAX_WIDTH_DEFAULT = 1080;

function normalizePlanCode(candidate: unknown): string | null {
  if (typeof candidate !== "string") return null;
  const v = candidate.trim().toLowerCase();
  return v ? v : null;
}

export function pickRemoveBgInputMaxWidth(params: {
  isAuthenticated: boolean;
  planCode: string | null;
}): number {
  if (!params.isAuthenticated) return REMOVE_BG_MAX_WIDTH_VISITOR_OR_FREE;
  const plan = normalizePlanCode(params.planCode) ?? "free";
  if (plan === "free") return REMOVE_BG_MAX_WIDTH_VISITOR_OR_FREE;
  return REMOVE_BG_MAX_WIDTH_DEFAULT;
}

