import { boardOverviewTool, boardOverviewHandler } from "./board-overview.js";
import { listCardsTool } from "./list-cards.js";
import { getCardTool } from "./get-card.js";
import { searchCardsTool } from "./search-cards.js";
import { dailySummaryTool } from "./daily-summary.js";
import { createCardTool } from "./create-card.js";
import { updateCardTool } from "./update-card.js";
import { moveCardTool } from "./move-card.js";
import { completeCardTool } from "./complete-card.js";
import { blockCardTool } from "./block-card.js";
import { archiveCardTool } from "./archive-card.js";
import { overdueCheckTool } from "./overdue-check.js";
import { manageChecklistTool } from "./manage-checklist.js";
import { addCommentTool } from "./add-comment.js";
import { searchArchiveTool } from "./search-archive.js";
import { stopwatchTool } from "./stopwatch.js";
import { sortListTool } from "./sort-list.js";
import { pomodoroTool } from "./pomodoro.js";
import type { ToolContext } from "./shared.js";
import type { CoreToolDefinition } from "../generator.js";

function adaptCoreTool<TInput>(tool: {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  annotations: CoreToolDefinition["annotations"];
  handler: (ctx: ToolContext, input: TInput) => Promise<{ content: Array<{ type: "text"; text: string }> }>;
}): CoreToolDefinition {
  return {
    name: tool.name,
    description: tool.description,
    inputSchema: tool.inputSchema,
    annotations: tool.annotations,
    handler: async (ctx: ToolContext, input: Record<string, unknown>) => tool.handler(ctx, input as TInput),
  };
}

export {
  boardOverviewTool,
  boardOverviewHandler,
  listCardsTool,
  getCardTool,
  searchCardsTool,
  dailySummaryTool,
  createCardTool,
  updateCardTool,
  moveCardTool,
  completeCardTool,
  blockCardTool,
  archiveCardTool,
  overdueCheckTool,
  manageChecklistTool,
  addCommentTool,
  searchArchiveTool,
  stopwatchTool,
  sortListTool,
  pomodoroTool,
};

export const CORE_TOOL_DEFINITIONS: CoreToolDefinition[] = [
  {
    ...boardOverviewTool,
    handler: async (context: ToolContext, input: Record<string, unknown>) =>
      boardOverviewHandler({ board_id: input.board_id as string | undefined }, context),
  },
  adaptCoreTool(listCardsTool),
  adaptCoreTool(getCardTool),
  adaptCoreTool(searchCardsTool),
  adaptCoreTool(dailySummaryTool),
  adaptCoreTool(createCardTool),
  adaptCoreTool(updateCardTool),
  adaptCoreTool(moveCardTool),
  adaptCoreTool(completeCardTool),
  adaptCoreTool(blockCardTool),
  adaptCoreTool(archiveCardTool),
  adaptCoreTool(overdueCheckTool),
  adaptCoreTool(manageChecklistTool),
  adaptCoreTool(addCommentTool),
  adaptCoreTool(searchArchiveTool),
  adaptCoreTool(stopwatchTool),
  adaptCoreTool(sortListTool),
  adaptCoreTool(pomodoroTool),
];

export const coreToolDefinitions = CORE_TOOL_DEFINITIONS;

export const CORE_TOOLS = CORE_TOOL_DEFINITIONS.map((tool) => tool.name) as readonly string[];
