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
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { defaultSettings } from "@/core/types";
import type { RaciConfig, RaciSettings } from "@/core/types";
import { SettingsPanel } from "@/react/settings/SettingsPanel";

const config: RaciConfig = {
  actions: [
    { id: "view", label: "View", description: "See things" },
    { id: "edit", label: "Edit", implies: ["view"] },
    { id: "admin", implies: ["edit", "ghost"] },
  ],
  subjectKinds: [
    { kind: "user", label: "Users", search: () => [] },
    { kind: "group", label: "Groups", search: () => [] },
  ],
  resources: [],
  strings: { "settings.reset": "Start over" },
};

const setup = (value: RaciSettings = defaultSettings(config)) => {
  const onChange = vi.fn();
  const utils = render(
    <SettingsPanel config={config} value={value} onChange={onChange} className="host" />,
  );
  return { onChange, ...utils };
};

describe("SettingsPanel", () => {
  it("renders root classes, groups and labelled controls", () => {
    const { container } = setup();
    expect(container.firstElementChild).toHaveClass("raci-root", "raci-settings", "host");
    expect(screen.getAllByRole("group").length).toBeGreaterThanOrEqual(4);
    expect(screen.getByRole("checkbox", { name: "View" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Users" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Show inherited entries" })).toBeChecked();
    expect(screen.getByRole("radio", { name: "Comfortable" })).toBeChecked();
    expect(screen.getByRole("button", { name: "Start over" })).toBeInTheDocument();
  });

  it("shows the Up and Down captions and lets config.strings override them", () => {
    const view = setup();
    const up = screen.getByRole("button", { name: "Move Edit up" });
    expect(up).toHaveTextContent("Up");
    expect(screen.getByRole("button", { name: "Move Edit down" })).toHaveTextContent("Down");
    view.unmount();
    render(
      <SettingsPanel
        config={{
          ...config,
          strings: { "settings.moveUp": "Hoch", "settings.moveDown": "Runter" },
        }}
        value={defaultSettings(config)}
        onChange={() => {}}
      />,
    );
    expect(screen.getByRole("button", { name: "Move Edit up" })).toHaveTextContent("Hoch");
    expect(screen.getByRole("button", { name: "Move Edit down" })).toHaveTextContent("Runter");
  });

  it("works without a className", () => {
    const { container } = render(
      <SettingsPanel config={config} value={defaultSettings(config)} onChange={() => {}} />,
    );
    expect(container.firstElementChild?.className).toBe("raci-root raci-settings");
  });

  it("shows descriptions and read-only implications, falling back to ids", () => {
    setup();
    expect(screen.getByText("See things")).toBeInTheDocument();
    expect(screen.getByText("Implies: View")).toBeInTheDocument();
    expect(screen.getByText("Implies: Edit, ghost")).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "admin" })).toBeInTheDocument();
    expect(screen.getAllByText("Implies no other action")).toHaveLength(1);
  });

  it("lists hidden actions after visible ones, unchecked, without move buttons", () => {
    setup({ ...defaultSettings(config), visibleActions: ["edit"] });
    const boxes = screen.getAllByRole("checkbox").slice(0, 3);
    expect(boxes.map((b) => (b as HTMLInputElement).checked)).toEqual([true, false, false]);
    expect(screen.queryByRole("button", { name: "Move View up" })).not.toBeInTheDocument();
  });

  it("reorders with buttons and disables edges", () => {
    const { onChange } = setup();
    expect(screen.getByRole("button", { name: "Move View up" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Move admin down" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Move View down" }));
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ visibleActions: ["edit", "view", "admin"] }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Move admin up" }));
    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ visibleActions: ["view", "admin", "edit"] }),
    );
  });

  it("toggles an action and does not mutate the value", () => {
    const value = Object.freeze(defaultSettings(config));
    const { onChange } = setup(value);
    fireEvent.click(screen.getByRole("checkbox", { name: "Edit" }));
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ visibleActions: ["view", "admin"] }),
    );
    expect(value.visibleActions).toEqual(["view", "edit", "admin"]);
  });

  it("guards the last visible action", () => {
    const { onChange } = setup({ ...defaultSettings(config), visibleActions: ["view"] });
    const box = screen.getByRole("checkbox", { name: "View" });
    expect(box).toBeDisabled();
    expect(box).toHaveAccessibleDescription(/At least one action must stay visible/);
    fireEvent.click(box);
    expect(onChange).not.toHaveBeenCalled();
  });

  it("toggles subject kinds and guards the last one", () => {
    const { onChange, rerender } = setup();
    fireEvent.click(screen.getByRole("checkbox", { name: "Users" }));
    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ enabledSubjectKinds: ["group"] }),
    );
    rerender(
      <SettingsPanel
        config={config}
        value={{ ...defaultSettings(config), enabledSubjectKinds: ["group"] }}
        onChange={onChange}
      />,
    );
    const last = screen.getByRole("checkbox", { name: "Groups" });
    expect(last).toBeDisabled();
    expect(last).toHaveAccessibleDescription(/At least one subject kind must stay enabled/);
  });

  it("emits scalar settings", () => {
    const { onChange } = setup();
    fireEvent.click(screen.getByRole("checkbox", { name: "Show inherited entries" }));
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ showInherited: false }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Confirm before saving a Deny" }));
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ confirmDeny: true }));
    expect(screen.queryByRole("checkbox", { name: /Stop inheriting/ })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("radio", { name: "Compact" }));
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ density: "compact" }));
  });

  it("resets to defaults", () => {
    const { onChange } = setup({
      ...defaultSettings(config),
      density: "compact",
      confirmDeny: true,
    });
    fireEvent.click(screen.getByRole("button", { name: "Start over" }));
    expect(onChange).toHaveBeenCalledWith(defaultSettings(config));
  });

  it("groups controls in fieldsets with legends", () => {
    setup();
    const g = screen.getByRole("group", { name: "Density" });
    expect(within(g).getAllByRole("radio")).toHaveLength(2);
  });
});
