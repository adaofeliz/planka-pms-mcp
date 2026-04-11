import type { ForgivingSystemConfig } from "../config/types.js";

export type ForgivingSuggestionType = "deprioritize_today" | "split_duration" | "reassess_relevance";

export interface OverdueCardInput {
  card_id: string;
  name: string;
  due_date: string | null;
  days_overdue: number;
  priority: number | null;
  duration_min: number | null;
}

export interface ForgivingSuggestion {
  type: ForgivingSuggestionType;
  card_id: string;
  reason: string;
  note: string;
}

export interface ForgivingAnalysis {
  warnings: string[];
  suggestions: ForgivingSuggestion[];
}

const STALE_DAYS_WARNING = 14;
const VERY_STALE_DAYS = 30;

export function analyzeForgivingSuggestions(
  overdueCards: OverdueCardInput[],
  todayWorkloadCount: number,
  forgiving: ForgivingSystemConfig,
): ForgivingAnalysis {
  const warnings: string[] = [];
  const suggestions: ForgivingSuggestion[] = [];

  if (!forgiving.enabled) {
    return { warnings, suggestions };
  }

  if (overdueCards.length > 0) {
    warnings.push(`${overdueCards.length} overdue card(s) need attention.`);
  }

  for (const card of overdueCards) {
    if (card.days_overdue >= STALE_DAYS_WARNING) {
      warnings.push(`Card '${card.name}' is stale (${card.days_overdue} days overdue).`);
    }

    if (forgiving.rules.suggest_deprioritize_today && todayWorkloadCount >= 3 && (card.priority === null || card.priority >= 4)) {
      suggestions.push({
        type: "deprioritize_today",
        card_id: card.card_id,
        reason: `Today workload is high (${todayWorkloadCount}) and '${card.name}' is low priority.`,
        note: "Consider removing this item from TODAY and re-planning it.",
      });
    }

    if (forgiving.rules.suggest_split_duration && card.duration_min !== null && card.duration_min >= 90) {
      suggestions.push({
        type: "split_duration",
        card_id: card.card_id,
        reason: `'${card.name}' is estimated at ${card.duration_min} minutes while overdue.`,
        note: "Consider splitting this task into smaller subtasks.",
      });
    }

    if (card.days_overdue >= VERY_STALE_DAYS) {
      suggestions.push({
        type: "reassess_relevance",
        card_id: card.card_id,
        reason: `'${card.name}' is very stale (${card.days_overdue} days overdue).`,
        note: "Reassess if this task is still relevant or should be dropped.",
      });
    }
  }

  if (forgiving.rules.never_extend_other_due_dates) {
    warnings.push("Never extend other tasks' due dates automatically.");
  }

  return { warnings, suggestions };
}
