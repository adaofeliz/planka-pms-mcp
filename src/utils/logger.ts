export type LogLevel = "DEBUG" | "INFO" | "WARN" | "ERROR";

type LogMethod = (message: string, metadata?: unknown) => void;

export interface Logger {
  debug: LogMethod;
  info: LogMethod;
  warn: LogMethod;
  error: LogMethod;
}

function serializeMetadata(metadata: unknown): string {
  if (metadata === undefined) {
    return "";
  }

  try {
    return ` ${JSON.stringify(metadata)}`;
  } catch {
    return " [unserializable-metadata]";
  }
}

function writeLog(scope: string, level: LogLevel, message: string, metadata?: unknown): void {
  const line = `[${scope}] ${level}: ${message}${serializeMetadata(metadata)}\n`;
  process.stderr.write(line);
}

export function createLogger(scope: string): Logger {
  return {
    debug: (message: string, metadata?: unknown) => {
      writeLog(scope, "DEBUG", message, metadata);
    },
    info: (message: string, metadata?: unknown) => {
      writeLog(scope, "INFO", message, metadata);
    },
    warn: (message: string, metadata?: unknown) => {
      writeLog(scope, "WARN", message, metadata);
    },
    error: (message: string, metadata?: unknown) => {
      writeLog(scope, "ERROR", message, metadata);
    },
  };
}

export function redact(obj: Record<string, unknown>, fields: string[]): Record<string, unknown> {
  const redacted: Record<string, unknown> = { ...obj };

  for (const field of fields) {
    if (field in redacted) {
      redacted[field] = "[REDACTED]";
    }
  }

  return redacted;
}
