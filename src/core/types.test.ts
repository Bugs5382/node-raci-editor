import { describe, expect, it } from "vitest";
import { defaultSettings } from "./types.js";

describe("defaultSettings", () => {
  it("shows every action and enables every subject kind", () => {
    const settings = defaultSettings({
      actions: [{ id: "read" }, { id: "author" }],
      subjectKinds: [{ kind: "user" }, { kind: "group" }],
    } as never);
    expect(settings).toEqual({
      visibleActions: ["read", "author"],
      enabledSubjectKinds: ["user", "group"],
      showInherited: true,
      confirmDeny: false,
      density: "comfortable",
    });
  });
});
