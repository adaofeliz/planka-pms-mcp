import { z } from "zod";
import type { ToolContext } from "./shared.js";
import { toolResult, toolError } from "./shared.js";

const actionSchema = z.enum(["add_list", "add_task", "toggle_task", "delete_task", "delete_list"]);

export const manageChecklistTool = {
  name: "manage_checklist" as const,
  description: "Create, update, or toggle checklist items on a card.",
  inputSchema: {
    card_id: z.string().min(1),
    action: actionSchema,
    list_name: z.string().optional().describe("For add_list"),
    task_list_id: z.string().optional().describe("For add_task, delete_list"),
    task_name: z.string().optional().describe("For add_task"),
    task_id: z.string().optional().describe("For toggle_task, delete_task"),
  },
  annotations: { readOnlyHint: false, idempotentHint: false, destructiveHint: false },
  async handler(
    ctx: ToolContext,
    input: {
      card_id: string;
      action: "add_list" | "add_task" | "toggle_task" | "delete_task" | "delete_list";
      list_name?: string;
      task_list_id?: string;
      task_name?: string;
      task_id?: string;
    },
  ) {
    try {
      switch (input.action) {
        case "add_list": {
          if (!input.list_name) return toolError("list_name required for add_list");
          if (!ctx.client.createTaskList) return toolError("createTaskList not available");
          const result = await ctx.client.createTaskList(input.card_id, {
            name: input.list_name,
            position: 65536,
          });
          return toolResult({ action: "add_list", task_list: result.item });
        }
        case "add_task": {
          if (!input.task_list_id || !input.task_name) return toolError("task_list_id and task_name required for add_task");
          if (!ctx.client.createTask) return toolError("createTask not available");
          const result = await ctx.client.createTask(input.task_list_id, {
            name: input.task_name,
            position: 65536,
          });
          return toolResult({ action: "add_task", task: result.item });
        }
        case "toggle_task": {
          if (!input.task_id) return toolError("task_id required for toggle_task");
          if (!ctx.client.updateTask) return toolError("updateTask not available");
          const card = await ctx.client.getCard(input.card_id);
          const task = card.included.tasks?.find((t) => t.id === input.task_id);
          if (!task) return toolError(`Task ${input.task_id} not found`);
          const result = await ctx.client.updateTask(input.task_id, { isCompleted: !task.isCompleted });
          return toolResult({ action: "toggle_task", task: result.item });
        }
        case "delete_task": {
          if (!input.task_id) return toolError("task_id required for delete_task");
          if (!ctx.client.deleteTask) return toolError("deleteTask not available");
          await ctx.client.deleteTask(input.task_id);
          return toolResult({ action: "delete_task", task_id: input.task_id });
        }
        case "delete_list": {
          if (!input.task_list_id) return toolError("task_list_id required for delete_list");
          if (!ctx.client.deleteTaskList) return toolError("deleteTaskList not available");
          await ctx.client.deleteTaskList(input.task_list_id);
          return toolResult({ action: "delete_list", task_list_id: input.task_list_id });
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      ctx.logger.error("manage_checklist failed", { error: msg });
      return toolError(msg);
    }
  }
};
