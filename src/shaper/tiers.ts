import type { PlankaConfig } from "../config/types.js";
import type { ResponseTierConfig } from "../config/types.js";

export type Tier = "summary" | "detail" | "deep";
export type ResponseLevel = Tier;

export interface TierFieldSets {
  tier1: string[];
  tier2: string[];
  tier3: string[];
}

export function buildTierFields(config: PlankaConfig): TierFieldSets {
  const tier1 = config.response.tier1;
  const tier2 = [...tier1, ...config.response.tier2_additions];
  const tier3 = [...tier2, ...config.response.tier3_additions];
  return { tier1, tier2, tier3 };
}

export function getFieldsForTier(tiers: TierFieldSets, tier: Tier): string[] {
  if (tier === "summary") return tiers.tier1;
  if (tier === "detail") return tiers.tier2;
  return tiers.tier3;
}

export function getTierFields(config: ResponseTierConfig, level: ResponseLevel): string[] {
  const tier1 = [...config.tier1];
  const tier2 = [...tier1, ...config.tier2_additions];
  const tier3 = [...tier2, ...config.tier3_additions];

  if (level === "summary") {
    return tier1;
  }
  if (level === "detail") {
    return tier2;
  }
  return tier3;
}

export function pickFields<T extends Record<string, unknown>>(data: T, fields: string[]): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const field of fields) {
    if (field in data) {
      result[field] = data[field];
    }
  }
  return result;
}
