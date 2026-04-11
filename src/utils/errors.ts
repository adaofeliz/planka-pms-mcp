export class PlankaError extends Error {
  public readonly code: string;
  public readonly suggestions: string[];

  constructor(message: string, code: string, suggestions: string[] = []) {
    super(message);
    this.name = new.target.name;
    this.code = code;
    this.suggestions = suggestions;
  }

  toJSON(): { code: string; message: string; suggestions: string[] } {
    return {
      code: this.code,
      message: this.message,
      suggestions: this.suggestions,
    };
  }
}

export class ConfigError extends PlankaError {
  constructor(message: string, suggestions: string[] = []) {
    super(message, "CONFIG_ERROR", suggestions);
  }
}

export class ValidationError extends PlankaError {
  constructor(message: string, suggestions: string[] = []) {
    super(message, "VALIDATION_ERROR", suggestions);
  }
}

export class AmbiguousMatchError extends PlankaError {
  public readonly matches: string[];

  constructor(message: string, matches: string[], suggestions: string[] = []) {
    super(message, "AMBIGUOUS_MATCH", suggestions);
    this.matches = matches;
  }

  override toJSON(): { code: string; message: string; suggestions: string[]; matches: string[] } {
    return {
      ...super.toJSON(),
      matches: this.matches,
    };
  }
}

export class NotFoundError extends PlankaError {
  public readonly available: string[];

  constructor(message: string, available: string[], suggestions: string[] = []) {
    super(message, "NOT_FOUND", suggestions);
    this.available = available;
  }

  override toJSON(): { code: string; message: string; suggestions: string[]; available: string[] } {
    return {
      ...super.toJSON(),
      available: this.available,
    };
  }
}

export class TransitionError extends PlankaError {
  public readonly from: string;
  public readonly to: string;
  public readonly allowed: string[];

  constructor(
    message: string,
    from: string,
    to: string,
    allowed: string[],
    suggestions: string[] = [],
  ) {
    super(message, "TRANSITION_ERROR", suggestions);
    this.from = from;
    this.to = to;
    this.allowed = allowed;
  }

  override toJSON(): {
    code: string;
    message: string;
    suggestions: string[];
    from: string;
    to: string;
    allowed: string[];
  } {
    return {
      ...super.toJSON(),
      from: this.from,
      to: this.to,
      allowed: this.allowed,
    };
  }
}

export class ApiError extends PlankaError {
  public readonly statusCode: number;

  constructor(message: string, statusCode: number, suggestions: string[] = []) {
    super(message, "API_ERROR", suggestions);
    this.statusCode = statusCode;
  }

  override toJSON(): { code: string; message: string; suggestions: string[]; statusCode: number } {
    return {
      ...super.toJSON(),
      statusCode: this.statusCode,
    };
  }
}
