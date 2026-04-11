import { z } from "zod";
import type { ToolContext } from "./shared.js";
import { toolResult, toolError } from "./shared.js";
import { formatSeconds } from "../../shaper/formatters.js";

export const stopwatchTool = {
  name: "stopwatch" as const,
  description: "Start, stop, reset, or check status of a card's time tracker.",
  inputSchema: {
    card_id: z.string().min(1),
    action: z.enum(["start", "stop", "reset", "status"]),
  },
  annotations: { readOnlyHint: false, idempotentHint: false, destructiveHint: false },
  async handler(ctx: ToolContext, input: { card_id: string; action: "start" | "stop" | "reset" | "status" }) {
    try {
      if (!ctx.client.getStopwatchStatus) {
        return toolError("getStopwatchStatus not available");
      }

      const cardResponse = await ctx.client.getCard(input.card_id);
      const sw = cardResponse.item.stopwatch ?? { total: 0, startedAt: null };

      let updatedSw = sw;

      if (input.action === "start") {
        if (sw.startedAt) return toolError("Stopwatch is already running");
        if (!ctx.client.startStopwatch) return toolError("startStopwatch not available");
        const result = await ctx.client.startStopwatch(input.card_id, sw.total);
        updatedSw = result.item.stopwatch ?? { total: 0, startedAt: null };
      } else if (input.action === "stop") {
        if (!sw.startedAt) return toolError("Stopwatch is not running");
        if (!ctx.client.stopStopwatch) return toolError("stopStopwatch not available");
        const result = await ctx.client.stopStopwatch(input.card_id, sw.total, sw.startedAt);
        updatedSw = result.item.stopwatch ?? { total: 0, startedAt: null };
      } else if (input.action === "reset") {
        if (!ctx.client.resetStopwatch) return toolError("resetStopwatch not available");
        const result = await ctx.client.resetStopwatch(input.card_id);
        updatedSw = result.item.stopwatch ?? { total: 0, startedAt: null };
      }

      const status = ctx.client.getStopwatchStatus(updatedSw);
      return toolResult({
        card_id: input.card_id,
        card_name: cardResponse.item.name,
        stopwatch: {
          total_seconds: status.totalWithElapsed,
          total_formatted: formatSeconds(status.totalWithElapsed),
          running: status.running,
          started_at: status.startedAt,
          elapsed_since_start: status.running ? formatSeconds(status.elapsed) : null,
        },
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      ctx.logger.error("stopwatch failed", { error: msg });
      return toolError(msg);
    }
  }
};
