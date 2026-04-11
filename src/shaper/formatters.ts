export function formatDate(dueDate: string | null | undefined): string | null {
  if (!dueDate) return null;
  return dueDate.split("T")[0];
}

export function formatSeconds(totalSeconds: number): string {
  if (totalSeconds < 60) return `${totalSeconds}s`;
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
  }

  return seconds > 0 ? `${minutes}m ${seconds}s` : `${minutes}m`;
}

export function isOverdue(dueDate: string | null | undefined, isDueCompleted: boolean, now: Date): boolean {
  if (!dueDate || isDueCompleted) return false;
  const due = new Date(dueDate);
  if (Number.isNaN(due.getTime())) return false;
  return due.getTime() < now.getTime();
}

export function stripEmojiPrefix(s: string): string {
  return s.replace(/^[\p{Emoji_Presentation}\p{Extended_Pictographic}\s]+/gu, "").trim();
}

export function compactDate(value: string | null | undefined): string | null {
  return formatDate(value);
}

export function formatLabelNames(labels: string[]): string[] {
  return [...labels].sort((a, b) => a.localeCompare(b));
}

export function formatTaskProgress(progress: { completed: number; total: number } | null): string | null {
  if (!progress) {
    return null;
  }

  return `${progress.completed}/${progress.total}`;
}

export function formatStopwatchDisplay(stopwatch: { total: number; startedAt: string | null }): {
  total_seconds: number;
  running: boolean;
} {
  return {
    total_seconds: stopwatch.total,
    running: stopwatch.startedAt !== null,
  };
}
