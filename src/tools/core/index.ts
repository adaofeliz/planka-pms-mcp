export { boardOverviewTool, boardOverviewHandler, boardOverviewSchema } from "./board-overview.js";
export { listCardsTool } from "./list-cards.js";
export { getCardTool } from "./get-card.js";

export const CORE_TOOLS = ["board_overview", "list_cards", "get_card"] as const;

export type CoreToolName = (typeof CORE_TOOLS)[number];
