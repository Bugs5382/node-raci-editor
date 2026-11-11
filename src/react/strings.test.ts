import { describe, expect, it } from "vitest";
import { makeT } from "@/react/strings";

describe("makeT", () => {
  it("prefers the host string, then the default, then the key", () => {
    const t = makeT({ strings: { a: "host {n}" } }, { a: "default", b: "bee" });
    expect(t("a", { n: 2 })).toBe("host 2");
    expect(t("b")).toBe("bee");
    expect(t("zzz")).toBe("zzz");
    expect(t("a")).toBe("host {n}");
  });
});
