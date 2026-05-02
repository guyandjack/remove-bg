import type { SubscriptionStatus } from "../../DB/queriesSQL/queriesSQL.ts";

export function isPremiumAccessAllowed(input: {
  subscriptionStatus: SubscriptionStatus;
  accountDeletionRequested?: boolean;
  planAccessUntil: Date | null;
  currentPeriodEnd: Date | null;
  periodEnd: Date;
  now?: Date;
}): boolean {
  const now = input.now ?? new Date();
  if (input.accountDeletionRequested) return false;
  const statusAllowed =
    input.subscriptionStatus === "active" || input.subscriptionStatus === "canceling";
  if (!statusAllowed) return false;

  const accessUntil =
    input.planAccessUntil ?? input.currentPeriodEnd ?? input.periodEnd;
  if (!accessUntil) return false;
  return new Date(accessUntil).getTime() > now.getTime();
}
