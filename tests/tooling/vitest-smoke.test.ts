import { describe, expect, it } from "vitest";
import { z } from "zod";

describe("vitest tooling smoke", () => {
  it("runs basic arithmetic assertion", () => {
    expect(1 + 1).toBe(2);
  });

  it("supports ESM TypeScript imports", () => {
    expect(typeof z).toBe("object");
  });
});
