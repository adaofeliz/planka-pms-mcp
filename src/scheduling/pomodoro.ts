export type PomodoroPhase = "work" | "rest";

export interface PomodoroSession {
  cardId: string;
  phase: PomodoroPhase;
  startedAt: Date;
  intervalMinutes: number;
  sessionsToday: number;
  sessionDate: string;
}

export class PomodoroTracker {
  private sessions = new Map<string, PomodoroSession>();

  startWork(cardId: string, workMinutes: number, now = new Date()): PomodoroSession {
    const today = now.toISOString().split("T")[0];
    const existing = this.sessions.get(cardId);
    const sessionsToday = (existing?.sessionDate === today ? existing.sessionsToday : 0) + 1;

    const session: PomodoroSession = {
      cardId,
      phase: "work",
      startedAt: now,
      intervalMinutes: workMinutes,
      sessionsToday,
      sessionDate: today,
    };
    this.sessions.set(cardId, session);
    return session;
  }

  startRest(cardId: string, restMinutes: number, now = new Date()): PomodoroSession {
    const today = now.toISOString().split("T")[0];
    const existing = this.sessions.get(cardId);
    const sessionsToday = existing?.sessionDate === today ? existing.sessionsToday : 0;

    const session: PomodoroSession = {
      cardId,
      phase: "rest",
      startedAt: now,
      intervalMinutes: restMinutes,
      sessionsToday,
      sessionDate: today,
    };
    this.sessions.set(cardId, session);
    return session;
  }

  getStatus(cardId: string, now = new Date()): PomodoroSession | null {
    const session = this.sessions.get(cardId);
    if (!session) return null;

    const today = now.toISOString().split("T")[0];
    if (session.sessionDate !== today) {
      return { ...session, sessionsToday: 0, sessionDate: today };
    }

    return session;
  }

  stop(cardId: string): void {
    this.sessions.delete(cardId);
  }

  computeRemaining(session: PomodoroSession, now = new Date()): { elapsed: number; remaining: number } {
    const elapsedSec = Math.floor((now.getTime() - session.startedAt.getTime()) / 1000);
    const totalSec = session.intervalMinutes * 60;
    const remaining = Math.max(0, totalSec - elapsedSec);
    return { elapsed: elapsedSec, remaining };
  }
}
