import { z } from "zod";

import type { ToolContext } from "./shared.js";
import { toolResult, toolError } from "./shared.js";

export const completeCardTool = {
  name: "complete_card" as const,
  description: "Mark a card as done by moving it to the DONE list. Does not archive.",
  inputSchema: { card_id: z.string().min(1) },
  annotations: { readOnlyHint: false, idempotentHint: false, destructiveHint: false },
  async handler(ctx: ToolContext, input: { card_id: string }) {
    try {
      const doneListId = ctx.resolver.resolveDoneListId();
      await ctx.client.moveCard(input.card_id, doneListId);

      const now = new Date();
      return toolResult({
        card_id: input.card_id,
        moved_to: "DONE",
        completed_at: now.toISOString(),
        note: "Card is now in DONE. Use archive_card when ready to archive.",
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      ctx.logger.error("complete_card failed", { error: msg });
      return toolError(msg);
    }
  },
};
