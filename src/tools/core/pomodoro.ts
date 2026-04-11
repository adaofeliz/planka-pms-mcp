import { z } from "zod";
import type { ToolContext } from "./shared.js";
import { toolResult, toolError } from "./shared.js";
import { PomodoroTracker } from "../../scheduling/pomodoro.js";
import { formatSeconds } from "../../shaper/formatters.js";

const tracker = new PomodoroTracker();

export const pomodoroTool = {
  name: "pomodoro" as const,
  description: "Manage Pomodoro work/rest cycles on a card using the native stopwatch.",
  inputSchema: {
    card_id: z.string().min(1),
    action: z.enum(["start_work", "start_rest", "status", "stop"]),
    work_minutes: z.number().int().positive().optional().describe("Override work interval (default from config)"),
    rest_minutes: z.number().int().positive().optional().describe("Override rest interval (default from config)"),
  },
  annotations: { readOnlyHint: false, idempotentHint: false, destructiveHint: false },
  async handler(ctx: ToolContext, input: {
    card_id: string;
    action: "start_work" | "start_rest" | "status" | "stop";
    work_minutes?: number;
    rest_minutes?: number;
  }) {
    try {
      const workMin = input.work_minutes ?? ctx.config.pomodoro.work_interval_minutes;
      const restMin = input.rest_minutes ?? ctx.config.pomodoro.rest_interval_minutes;
      const now = new Date();

      if (input.action === "start_work") {
        const card = await ctx.client.getCard(input.card_id);
        if (!ctx.client.startStopwatch) return toolError("startStopwatch not available");
        await ctx.client.startStopwatch(input.card_id, card.item.stopwatch?.total ?? 0);
        const session = tracker.startWork(input.card_id, workMin, now);
        const { elapsed, remaining } = tracker.computeRemaining(session, now);
        return toolResult({
          card_id: input.card_id,
          card_name: card.item.name,
          pomodoro: {
            phase: "work",
            elapsed: formatSeconds(elapsed),
            remaining: formatSeconds(remaining),
            interval: `${workMin}m`,
            sessions_today: session.sessionsToday,
          },
        });
      }

      if (input.action === "start_rest") {
        const card = await ctx.client.getCard(input.card_id);
        const sw = card.item.stopwatch ?? { total: 0, startedAt: null };
        if (sw.startedAt) {
          if (!ctx.client.stopStopwatch) return toolError("stopStopwatch not available");
          await ctx.client.stopStopwatch(input.card_id, sw.total, sw.startedAt);
        }
        const session = tracker.startRest(input.card_id, restMin, now);
        const { elapsed, remaining } = tracker.computeRemaining(session, now);
        return toolResult({
          card_id: input.card_id,
          card_name: card.item.name,
          pomodoro: {
            phase: "rest",
            elapsed: formatSeconds(elapsed),
            remaining: formatSeconds(remaining),
            interval: `${restMin}m`,
            sessions_today: session.sessionsToday,
          },
        });
      }

      if (input.action === "stop") {
        const card = await ctx.client.getCard(input.card_id);
        const sw = card.item.stopwatch ?? { total: 0, startedAt: null };
        if (sw.startedAt) {
          if (!ctx.client.stopStopwatch) return toolError("stopStopwatch not available");
          await ctx.client.stopStopwatch(input.card_id, sw.total, sw.startedAt);
        }
        tracker.stop(input.card_id);
        return toolResult({ card_id: input.card_id, status: "stopped" });
      }

      const session = tracker.getStatus(input.card_id, now);
      if (!session) {
        return toolResult({ card_id: input.card_id, pomodoro: null, note: "No active pomodoro session" });
      }
      const card = await ctx.client.getCard(input.card_id);
      const { elapsed, remaining } = tracker.computeRemaining(session, now);
      return toolResult({
        card_id: input.card_id,
        card_name: card.item.name,
        pomodoro: {
          phase: session.phase,
          elapsed: formatSeconds(elapsed),
          remaining: formatSeconds(remaining),
          interval: `${session.intervalMinutes}m`,
          sessions_today: session.sessionsToday,
        },
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      ctx.logger.error("pomodoro failed", { error: msg });
      return toolError(msg);
    }
  }
};
