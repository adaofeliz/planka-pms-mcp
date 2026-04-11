export { boardOverviewTool, boardOverviewHandler, boardOverviewSchema } from "./board-overview.js";
export { listCardsTool } from "./list-cards.js";
export { getCardTool } from "./get-card.js";
export { searchCardsTool } from "./search-cards.js";
export { dailySummaryTool } from "./daily-summary.js";
export { createCardTool } from "./create-card.js";
export { updateCardTool } from "./update-card.js";
export { moveCardTool } from "./move-card.js";
export { completeCardTool } from "./complete-card.js";
export { blockCardTool } from "./block-card.js";
export { archiveCardTool } from "./archive-card.js";

export const CORE_TOOLS = [
  "board_overview",
  "list_cards",
  "get_card",
  "search_cards",
  "daily_summary",
  "create_card",
  "update_card",
  "move_card",
  "complete_card",
  "block_card",
  "archive_card",
] as const;

export type CoreToolName = (typeof CORE_TOOLS)[number];
