import type { WipLimitsConfig } from "../config/types.js";

export interface WipLimitStatus {
  listRole: string;
  limit: number;
  current: number;
  exceeds: boolean;
  remaining: number;
}

export function evaluateWipLimit(listRole: string, current: number, limit: number | undefined): WipLimitStatus | null {
  if (limit === undefined) {
    return null;
  }

  const remaining = limit - current;
  return {
    listRole,
    limit,
    current,
    exceeds: current > limit,
    remaining,
  };
}

export function evaluateConfiguredWipLimits(
  countsByRole: Partial<Record<string, number>>,
  limits: WipLimitsConfig,
): WipLimitStatus[] {
  const statuses: WipLimitStatus[] = [];

  for (const [role, limit] of Object.entries(limits)) {
    const status = evaluateWipLimit(role, countsByRole[role] ?? 0, limit);
    if (status) {
      statuses.push(status);
    }
  }

  return statuses;
}

export function getWipWarnings(statuses: WipLimitStatus[]): Array<{ list: string; warning: string }> {
  return statuses
    .filter((status) => status.exceeds)
    .map((status) => ({
      list: status.listRole,
      warning: `${status.listRole.toUpperCase()} exceeds WIP limit (${status.current}/${status.limit})`,
    }));
}
