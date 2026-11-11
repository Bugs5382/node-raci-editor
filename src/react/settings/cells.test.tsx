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
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { defaultSettings } from "@/core/types";
import type { RaciConfig, RaciSettings } from "@/core/types";
import { normalizeSettings } from "@/react/settings/model";
import { SettingsPanel } from "@/react/settings/SettingsPanel";

afterEach(cleanup);

const config: RaciConfig = {
  actions: [{ id: "view", label: "View" }],
  subjectKinds: [],
  resources: [],
  cellStates: { allow: { glyph: "Y", text: "Yes" } },
};

const section = () => screen.getByRole("group", { name: "Cells" });

describe("the Cells section", () => {
  it("previews the states with the same cell the editor draws", () => {
    render(<SettingsPanel config={config} value={defaultSettings(config)} onChange={() => {}} />);
    const preview = within(section()).getByTestId("cells-preview");
    const cells = preview.querySelectorAll(".raci-cell");
    expect(cells).toHaveLength(6);
    const allow = preview.querySelector(".raci-cell--allow") as HTMLElement;
    expect(allow.querySelector(".raci-cell__glyph")).toHaveTextContent("Y");
    expect(allow.querySelector(".raci-cell__text")).toHaveTextContent("Yes");
    expect(within(section()).getAllByText("Not set").length).toBeGreaterThan(0);
  });

  it("emits a glyph typed for a state, with the rest of the settings unchanged", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    const start = { ...defaultSettings(config), density: "compact" as const };
    render(<SettingsPanel config={config} value={start} onChange={onChange} />);
    const input = within(section()).getByRole("textbox", { name: "Deny glyph" });
    await user.type(input, "N");
    const next = onChange.mock.calls.at(-1)![0] as RaciSettings;
    expect(next.cells?.states?.deny?.glyph).toBe("N");
    expect(next.density).toBe("compact");
    expect(next.visibleActions).toEqual(start.visibleActions);
  });

  it("emits a colour chosen with a colour input", () => {
    const onChange = vi.fn();
    render(<SettingsPanel config={config} value={defaultSettings(config)} onChange={onChange} />);
    const input = within(section()).getByLabelText("Allow text colour");
    fireEvent.change(input, { target: { value: "#ff0000" } });
    const next = onChange.mock.calls.at(-1)![0] as RaciSettings;
    expect(next.cells?.states?.allow?.colors?.fg).toBe("#ff0000");
  });

  it("validates the size: a value out of range is not emitted and is explained", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<SettingsPanel config={config} value={defaultSettings(config)} onChange={onChange} />);
    const width = within(section()).getByRole("spinbutton", { name: "Cell width (px)" });
    const height = within(section()).getByRole("spinbutton", { name: "Cell height (px)" });
    await user.clear(width);
    await user.type(width, "5");
    await user.clear(height);
    await user.type(height, "32");
    expect(onChange.mock.calls.every(([v]) => (v as RaciSettings).cells?.size === undefined)).toBe(
      true,
    );
    expect(within(section()).getByRole("alert")).toHaveTextContent(
      "The width must be a number from 24 to 240.",
    );
    await user.clear(width);
    await user.type(width, "48");
    const next = onChange.mock.calls.at(-1)![0] as RaciSettings;
    expect(next.cells?.size).toEqual({ width: 48, height: 32 });
    expect(within(section()).queryByRole("alert")).toBeNull();
  });

  it("offers sizes smaller than the density defaults", () => {
    render(<SettingsPanel config={config} value={defaultSettings(config)} onChange={() => {}} />);
    const width = within(section()).getByRole("spinbutton", { name: "Cell width (px)" });
    expect(Number(width.getAttribute("min"))).toBeLessThan(96);
    const height = within(section()).getByRole("spinbutton", { name: "Cell height (px)" });
    expect(Number(height.getAttribute("min"))).toBeLessThan(28);
  });

  it("round-trips: what it emits, stored and passed back, draws the same preview", async () => {
    const user = userEvent.setup();
    let stored: RaciSettings = defaultSettings(config);
    const Host = () => {
      const [value, setValue] = useState(stored);
      return (
        <SettingsPanel
          config={config}
          value={value}
          onChange={(next) => {
            stored = structuredClone(next);
            setValue(next);
          }}
        />
      );
    };
    const { unmount } = render(<Host />);
    await user.type(within(section()).getByRole("textbox", { name: "Allow glyph" }), "!");
    fireEvent.change(within(section()).getByLabelText("Allow background"), {
      target: { value: "#00ff00" },
    });
    const look = () =>
      Array.from(
        within(section()).getByTestId("cells-preview").querySelectorAll<HTMLElement>(".raci-cell"),
      ).map((c) => ({ cls: c.className, style: c.style.cssText, text: c.textContent }));
    const before = look();
    unmount();
    expect(normalizeSettings(config, stored)).toEqual(stored);
    render(
      <SettingsPanel
        config={config}
        value={normalizeSettings(config, stored)}
        onChange={() => {}}
      />,
    );
    expect(look()).toEqual(before);
  });

  it("reset to defaults clears the cell settings", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    const start: RaciSettings = {
      ...defaultSettings(config),
      cells: { states: { allow: { glyph: "Z" } } },
    };
    render(<SettingsPanel config={config} value={start} onChange={onChange} />);
    await user.click(screen.getByRole("button", { name: "Reset to defaults" }));
    expect((onChange.mock.calls.at(-1)![0] as RaciSettings).cells).toBeUndefined();
  });

  it("takes its labels from config.strings", () => {
    render(
      <SettingsPanel
        config={{ ...config, strings: { "settings.cells.legend": "Look" } }}
        value={defaultSettings(config)}
        onChange={() => {}}
      />,
    );
    expect(screen.getByRole("group", { name: "Look" })).toBeInTheDocument();
  });
});

describe("normalizeSettings and cells", () => {
  it("keeps valid cells and drops junk", () => {
    const out = normalizeSettings(config, {
      cells: { size: { width: 40, height: 30 }, states: { allow: { glyph: "toolong" } } },
    });
    expect(out.cells).toEqual({ size: { width: 40, height: 30 } });
    expect(normalizeSettings(config, {}).cells).toBeUndefined();
  });
});
