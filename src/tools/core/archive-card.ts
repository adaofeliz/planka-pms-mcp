import { z } from "zod";

import type { ToolContext } from "./shared.js";
import { toolResult, toolError } from "./shared.js";
import { normalizeBoardSkeleton } from "../../client/cache.js";
import { ValidationError } from "../../utils/errors.js";

export const archiveCardTool = {
  name: "archive_card" as const,
  description: "Move a completed card from DONE to the archive for long-term storage.",
  inputSchema: { card_id: z.string().min(1).describe("Card ID. Must be in the DONE list.") },
  annotations: { readOnlyHint: false, idempotentHint: false, destructiveHint: false },
  async handler(ctx: ToolContext, input: { card_id: string }) {
    try {
      const boardId = ctx.config.connection.board_id;
      const skeleton = ctx.cache.get(boardId) ?? normalizeBoardSkeleton(await ctx.client.getBoard(boardId));
      ctx.cache.set(boardId, skeleton);

      const cardResponse = await ctx.client.getCard(input.card_id);
      const card = cardResponse.item;
      const doneListId = ctx.resolver.resolveDoneListId();

      if (card.listId !== doneListId) {
        const currentList = skeleton.lists.find((l) => l.id === card.listId);
        throw new ValidationError(
          `Card must be in DONE to archive. Current list: ${currentList?.name ?? card.listId}`,
          ["Move the card to DONE first using complete_card"],
        );
      }

      const archiveListId = ctx.resolver.resolveArchiveListId();
      await ctx.client.archiveCard(input.card_id, archiveListId);

      return toolResult({
        card_id: input.card_id,
        card_name: card.name,
        archived_at: new Date().toISOString(),
        note: "Card archived. Find it with search_archive.",
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const suggestions = err instanceof ValidationError ? err.suggestions : undefined;
      ctx.logger.error("archive_card failed", { error: msg });
      return toolError(msg, suggestions);
    }
  },
};
