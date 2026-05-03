export type PlanChangeType = "upgrade" | "downgrade";

export function resolvePlanChangeType(params: {
  currentPlanPrice: number;
  targetPlanPrice: number;
}): PlanChangeType {
  return params.targetPlanPrice > params.currentPlanPrice ? "upgrade" : "downgrade";
}

