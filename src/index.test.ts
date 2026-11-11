import { describe, expect, it } from "vitest";
import { hello } from "./index.js";

describe("hello", () => {
  it("greets a name", () => {
    expect(hello("world")).toBe("Hello, world!");
  });
});
