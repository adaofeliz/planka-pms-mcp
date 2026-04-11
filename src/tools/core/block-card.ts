import { z } from "zod";

import type { ToolContext } from "./shared.js";
import { toolResult, toolError } from "./shared.js";

export const blockCardTool = {
  name: "block_card" as const,
  description: "Move a card to BLOCKED and add a reason comment explaining the blocker.",
  inputSchema: {
    card_id: z.string().min(1),
    reason: z.string().min(1).describe("Why the card is blocked"),
  },
  annotations: { readOnlyHint: false, idempotentHint: false, destructiveHint: false },
  async handler(ctx: ToolContext, input: { card_id: string; reason: string }) {
    try {
      const blockedListId = ctx.resolver.resolveBlockedListId();
      await ctx.client.moveCard(input.card_id, blockedListId);
      await ctx.client.createComment(input.card_id, `🚫 BLOCKED: ${input.reason}`);

      return toolResult({
        card_id: input.card_id,
        status: "blocked",
        reason: input.reason,
        blocked_at: new Date().toISOString(),
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      ctx.logger.error("block_card failed", { error: msg });
      return toolError(msg);
    }
  },
};
