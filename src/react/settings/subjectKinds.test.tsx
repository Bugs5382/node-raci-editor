/*
MIT License

Copyright (c) 2026 Shane

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.
*/
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
