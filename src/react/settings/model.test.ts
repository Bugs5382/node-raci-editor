import { describe, expect, it } from "vitest";
import { defaultSettings } from "@/core/types";
import type { RaciSettings } from "@/core/types";
import { moveAction, normalizeSettings, toggleAction, toggleKind } from "@/react/settings/model";

const config = {
  actions: [{ id: "view" }, { id: "edit" }, { id: "admin" }],
  subjectKinds: [
    { kind: "user", label: "User", search: () => [] },
    { kind: "group", label: "Group", search: () => [] },
  ],
};
const base = defaultSettings(config);

describe("moveAction", () => {
  it("moves an action down and up without mutating", () => {
    const frozen = Object.freeze({
      ...base,
      visibleActions: Object.freeze([...base.visibleActions]) as string[],
    });
    const down = moveAction(frozen, "view", 1);
    expect(down.visibleActions).toEqual(["edit", "view", "admin"]);
    expect(frozen.visibleActions).toEqual(["view", "edit", "admin"]);
    expect(moveAction(down, "view", -1).visibleActions).toEqual(["view", "edit", "admin"]);
  });
  it("returns the same object at the edges or for unknown ids", () => {
    expect(moveAction(base, "view", -1)).toBe(base);
    expect(moveAction(base, "admin", 1)).toBe(base);
    expect(moveAction(base, "nope", 1)).toBe(base);
  });
});

describe("toggleAction", () => {
  it("hides and shows an action, appending when shown", () => {
    const hidden = toggleAction(base, "view");
    expect(hidden.visibleActions).toEqual(["edit", "admin"]);
    expect(toggleAction(hidden, "view").visibleActions).toEqual(["edit", "admin", "view"]);
    expect(base.visibleActions).toEqual(["view", "edit", "admin"]);
  });
  it("refuses to hide the last visible action", () => {
    const one: RaciSettings = { ...base, visibleActions: ["edit"] };
    expect(toggleAction(one, "edit")).toBe(one);
  });
});

describe("toggleKind", () => {
  it("toggles a kind and guards the last one", () => {
    const off = toggleKind(base, "user");
    expect(off.enabledSubjectKinds).toEqual(["group"]);
    expect(toggleKind(off, "group")).toBe(off);
    expect(toggleKind(off, "user").enabledSubjectKinds).toEqual(["group", "user"]);
    expect(base.enabledSubjectKinds).toEqual(["user", "group"]);
  });
});

describe("normalizeSettings", () => {
  it("returns defaults for undefined or empty input", () => {
    expect(normalizeSettings(config, undefined)).toEqual(base);
    expect(normalizeSettings(config, {})).toEqual(base);
  });
  it("drops unknown ids and duplicates, keeps order", () => {
    const out = normalizeSettings(config, {
      visibleActions: ["admin", "ghost", "view", "admin"],
      enabledSubjectKinds: ["group", "alien"],
    });
    expect(out.visibleActions).toEqual(["admin", "view"]);
    expect(out.enabledSubjectKinds).toEqual(["group"]);
  });
  it("falls back to defaults when nothing valid remains", () => {
    const out = normalizeSettings(config, { visibleActions: ["x"], enabledSubjectKinds: [] });
    expect(out.visibleActions).toEqual(base.visibleActions);
    expect(out.enabledSubjectKinds).toEqual(base.enabledSubjectKinds);
  });
  it("keeps valid scalar fields and ignores invalid density", () => {
    const out = normalizeSettings(config, {
      showInherited: false,
      confirmDeny: true,
      defaultStopInheriting: true,
      density: "compact",
    });
    expect(out).toMatchObject({
      showInherited: false,
      confirmDeny: true,
      defaultStopInheriting: true,
      density: "compact",
    });
    expect(normalizeSettings(config, { density: "huge" as never }).density).toBe("comfortable");
    expect(normalizeSettings(config, { density: "comfortable" }).density).toBe("comfortable");
  });
});
