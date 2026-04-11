import { z } from "zod";
import type { ToolContext } from "./shared.js";
import { toolResult, toolError } from "./shared.js";

export const addCommentTool = {
  name: "add_comment" as const,
  description: "Add a comment to a card. Supports markdown.",
  inputSchema: {
    card_id: z.string().min(1),
    text: z.string().min(1).describe("Comment text (markdown supported)"),
  },
  annotations: { readOnlyHint: false, idempotentHint: false, destructiveHint: false },
  async handler(ctx: ToolContext, input: { card_id: string; text: string }) {
    try {
      const result = await ctx.client.createComment(input.card_id, input.text);
      return toolResult({
        comment_id: result.item.id,
        card_id: input.card_id,
        created_at: result.item.createdAt,
        text_preview: input.text.length > 100 ? `${input.text.slice(0, 100)}...` : input.text,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      ctx.logger.error("add_comment failed", { error: msg });
      return toolError(msg);
    }
  }
};
