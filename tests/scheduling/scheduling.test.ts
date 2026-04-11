import { describe, expect, it } from "vitest";

import { classifyDueDate, groupCardsByDueDateWindow } from "../../src/scheduling/due-date-windows.js";
import { evaluateConfiguredWipLimits, getWipWarnings } from "../../src/scheduling/wip-limits.js";

describe("due-date windows", () => {
  const windows = {
    approaching: { min_hours: 24, max_hours: 72 },
    imminent: { max_hours: 24 },
  };

  it("classifies null due date as unscheduled", () => {
    const now = new Date("2026-01-10T00:00:00.000Z");
    const result = classifyDueDate(null, windows, now);
    expect(result.bucket).toBe("unscheduled");
  });

  it("classifies overdue, imminent, approaching and backlog-safe boundaries", () => {
    const now = new Date("2026-01-10T00:00:00.000Z");

    expect(classifyDueDate("2026-01-09T23:00:00.000Z", windows, now).bucket).toBe("overdue");
    expect(classifyDueDate("2026-01-10T12:00:00.000Z", windows, now).bucket).toBe("imminent");
    expect(classifyDueDate("2026-01-11T00:00:00.000Z", windows, now).bucket).toBe("imminent");
    expect(classifyDueDate("2026-01-11T12:00:00.000Z", windows, now).bucket).toBe("approaching");
    expect(classifyDueDate("2026-01-13T00:00:00.000Z", windows, now).bucket).toBe("approaching");
    expect(classifyDueDate("2026-01-15T00:00:00.000Z", windows, now).bucket).toBe("backlog_safe");
  });

  it("groups cards by window buckets", () => {
    const now = new Date("2026-01-10T00:00:00.000Z");
    const cards = [
      { id: "c1", dueDate: null },
      { id: "c2", dueDate: "2026-01-09T00:00:00.000Z" },
      { id: "c3", dueDate: "2026-01-10T06:00:00.000Z" },
      { id: "c4", dueDate: "2026-01-12T00:00:00.000Z" },
      { id: "c5", dueDate: "2026-01-18T00:00:00.000Z" },
    ];
    const grouped = groupCardsByDueDateWindow(cards, windows, now);

    expect(grouped.unscheduled).toHaveLength(1);
    expect(grouped.overdue).toHaveLength(1);
    expect(grouped.imminent).toHaveLength(1);
    expect(grouped.approaching).toHaveLength(1);
    expect(grouped.backlog_safe).toHaveLength(1);
  });
});

describe("wip limits", () => {
  it("returns structured statuses and over-capacity warnings", () => {
    const statuses = evaluateConfiguredWipLimits(
      {
        noise: 6,
        focus: 2,
      },
      {
        noise: 5,
        focus: 3,
      },
    );

    expect(statuses).toHaveLength(2);
    const warnings = getWipWarnings(statuses);
    expect(warnings).toEqual([{ list: "noise", warning: "NOISE exceeds WIP limit (6/5)" }]);
  });
});
