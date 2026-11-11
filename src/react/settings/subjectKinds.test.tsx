import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { defaultSettings } from "@/core/types";
import type { RaciConfig } from "@/core/types";
import { SettingsPanel } from "@/react/settings/SettingsPanel";
import { normalizeSettings } from "@/react/settings/model";

const make = (...kinds: string[]): RaciConfig => ({
  actions: [{ id: "view", label: "View" }],
  subjectKinds: kinds.map((k) => ({ kind: k, label: `Label ${k}`, search: () => [] })),
  resources: [],
});

describe("settings with whatever kinds the host has", () => {
  it.each(["group", "team"])("shows no pointless kinds section for only %s", (k) => {
    const config = make(k);
    render(<SettingsPanel config={config} value={defaultSettings(config)} onChange={vi.fn()} />);
    expect(screen.queryByText("Subject kinds")).not.toBeInTheDocument();
    expect(screen.queryByRole("checkbox", { name: `Label ${k}` })).not.toBeInTheDocument();
    expect(screen.queryByText("At least one subject kind must stay enabled.")).toBeNull();
  });

  it("lists custom kinds by their own labels when there are several", () => {
    const config = make("team", "department");
    render(<SettingsPanel config={config} value={defaultSettings(config)} onChange={vi.fn()} />);
    expect(screen.getByRole("checkbox", { name: "Label team" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Label department" })).toBeChecked();
  });

  it("normalizes against the configured kinds only", () => {
    const config = make("team");
    expect(normalizeSettings(config).enabledSubjectKinds).toEqual(["team"]);
    expect(
      normalizeSettings(config, { enabledSubjectKinds: ["user"] }).enabledSubjectKinds,
    ).toEqual(["team"]);
  });
});
