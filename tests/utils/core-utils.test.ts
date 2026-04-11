import { describe, expect, it, vi, afterEach } from "vitest";

import { createLogger, redact } from "../../src/utils/logger.js";
import {
  ApiError,
  ConfigError,
  NotFoundError,
  PlankaError,
  TransitionError,
} from "../../src/utils/errors.js";
import { findBestMatches, levenshteinDistance, stripEmoji } from "../../src/utils/levenshtein.js";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("logger", () => {
  it("createLogger returns debug/info/warn/error methods", () => {
    const logger = createLogger("test");

    expect(typeof logger.debug).toBe("function");
    expect(typeof logger.info).toBe("function");
    expect(typeof logger.warn).toBe("function");
    expect(typeof logger.error).toBe("function");
  });

  it("log methods do not throw", () => {
    const logger = createLogger("test");

    expect(() => logger.debug("debug message")).not.toThrow();
    expect(() => logger.info("info message", { ok: true })).not.toThrow();
    expect(() => logger.warn("warn message")).not.toThrow();
    expect(() => logger.error("error message", { id: 1 })).not.toThrow();
  });

  it("log methods do not write to stdout", () => {
    const logger = createLogger("test");
    const stdoutSpy = vi.spyOn(process.stdout, "write");

    logger.debug("debug");
    logger.info("info");
    logger.warn("warn");
    logger.error("error");

    expect(stdoutSpy).not.toHaveBeenCalled();
  });

  it("redact replaces selected fields", () => {
    const result = redact({ apiKey: "secret", name: "ok" }, ["apiKey"]);
    expect(result).toEqual({ apiKey: "[REDACTED]", name: "ok" });
  });
});

describe("errors", () => {
  it("PlankaError defaults suggestions to empty array", () => {
    const err = new PlankaError("msg", "CODE");
    expect(err.code).toBe("CODE");
    expect(err.message).toBe("msg");
    expect(err.suggestions).toEqual([]);
  });

  it("PlankaError accepts suggestions", () => {
    const err = new PlankaError("msg", "CODE", ["try this"]);
    expect(err.suggestions).toEqual(["try this"]);
  });

  it("PlankaError toJSON returns code, message, suggestions", () => {
    const err = new PlankaError("msg", "CODE", ["try this"]);
    expect(err.toJSON()).toEqual({ code: "CODE", message: "msg", suggestions: ["try this"] });
  });

  it("ConfigError is instance of ConfigError and PlankaError", () => {
    const err = new ConfigError("bad yaml");
    expect(err).toBeInstanceOf(ConfigError);
    expect(err).toBeInstanceOf(PlankaError);
  });

  it("NotFoundError exposes available options", () => {
    const err = new NotFoundError("List 'X' not found", ["INBOX", "BACKLOG"]);
    expect(err.available).toEqual(["INBOX", "BACKLOG"]);
  });

  it("TransitionError exposes transition fields", () => {
    const err = new TransitionError("bad move", "INBOX", "DONE", ["BACKLOG", "FOCUS"]);
    expect(err.from).toBe("INBOX");
    expect(err.to).toBe("DONE");
    expect(err.allowed).toEqual(["BACKLOG", "FOCUS"]);
  });

  it("ApiError exposes statusCode", () => {
    const err = new ApiError("404", 404);
    expect(err.statusCode).toBe(404);
  });
});

describe("levenshtein", () => {
  it("computes expected distances", () => {
    expect(levenshteinDistance("", "")).toBe(0);
    expect(levenshteinDistance("abc", "abc")).toBe(0);
    expect(levenshteinDistance("bakclog", "backlog")).toBe(2);
    expect(levenshteinDistance("cat", "cut")).toBe(1);
    expect(levenshteinDistance("kitten", "sitting")).toBe(3);
  });

  it("findBestMatches ranks closest candidate first", () => {
    const matches = findBestMatches("bakclog", ["INBOX", "BACKLOG", "FOCUS", "TODAY"]);
    expect(matches[0]).toBe("BACKLOG");
  });

  it("findBestMatches returns exact match as closest", () => {
    const matches = findBestMatches("INBOX", ["INBOX", "BACKLOG"]);
    expect(matches).toEqual(["INBOX"]);
  });

  it("stripEmoji removes emoji and trims", () => {
    expect(stripEmoji("📩 INBOX")).toBe("INBOX");
    expect(stripEmoji("🎯 FOCUS")).toBe("FOCUS");
    expect(stripEmoji("plain")).toBe("plain");
  });
});
