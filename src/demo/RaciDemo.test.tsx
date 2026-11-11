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
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { RaciDemo } from "./RaciDemo";
import { demoRuleSet, presetById } from "./data";
import { serializeRuleSet } from "./io";

const shownJson = () => JSON.parse(screen.getByTestId("demo-json").textContent ?? "{}");
const appRoot = () => document.querySelector(".demo-app") as HTMLElement;

beforeEach(() => {
  window.localStorage.clear();
});

describe("theme and brand", () => {
  it("sets data-theme on the wrapper only, and persists it", async () => {
    const user = userEvent.setup();
    render(<RaciDemo />);
    expect(appRoot()).not.toHaveAttribute("data-theme");
    await user.click(screen.getByRole("button", { name: "Dark" }));
    expect(appRoot()).toHaveAttribute("data-theme", "dark");
    expect(document.querySelector(".raci-editor")).not.toHaveAttribute("data-theme");
    expect(window.localStorage.getItem("raci-demo-theme")).toBe("dark");
    await user.click(screen.getByRole("button", { name: "Light" }));
    expect(appRoot()).toHaveAttribute("data-theme", "light");
    await user.click(screen.getByRole("button", { name: "System" }));
    expect(appRoot()).not.toHaveAttribute("data-theme");
    expect(document.querySelector(".raci-editor")).not.toHaveAttribute("data-theme");
  });

  it("restores the saved theme", () => {
    window.localStorage.setItem("raci-demo-theme", "dark");
    render(<RaciDemo />);
    expect(appRoot()).toHaveAttribute("data-theme", "dark");
    expect(screen.getByRole("button", { name: "Dark" })).toHaveAttribute("aria-pressed", "true");
  });

  it("toggles the brand override class", async () => {
    const user = userEvent.setup();
    render(<RaciDemo />);
    await user.click(screen.getByRole("checkbox", { name: "Brand override" }));
    expect(appRoot()).toHaveClass("demo-brand");
    await user.click(screen.getByRole("checkbox", { name: "Brand override" }));
    expect(appRoot()).not.toHaveClass("demo-brand");
  });
});

describe("presets", () => {
  it("switches configuration, tree, strings and rules", async () => {
    const user = userEvent.setup();
    render(<RaciDemo />);
    expect(screen.getByRole("columnheader", { name: "Manage" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Payroll" })).toBeInTheDocument();
    await user.selectOptions(screen.getByRole("combobox", { name: "Preset" }), "other");
    expect(screen.getByRole("columnheader", { name: "Publish" })).toBeInTheDocument();
    expect(screen.queryByRole("columnheader", { name: "Manage" })).not.toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Who" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Media library" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Payroll" })).not.toBeInTheDocument();
    expect(shownJson()).toEqual(presetById("other").seed);
  });
});

describe("package boundary", () => {
  it("labels the host-owned tree and the package area", () => {
    render(<RaciDemo />);
    const host = screen.getByText("host app: resource tree, not part of the package");
    expect(host.closest(".demo-host-frame")).toContainElement(
      screen.getByRole("navigation", { name: "Resources" }),
    );
    const pkg = screen.getByText("package: rules editor, simulator, settings");
    expect(pkg.closest(".demo-main")).toContainElement(screen.getByRole("tablist"));
    expect(pkg.closest(".demo-host-frame")).toBeNull();
  });
});

describe("tree selection", () => {
  it("updates the category shown by the editor", async () => {
    const user = userEvent.setup();
    render(<RaciDemo />);
    expect(screen.getByTestId("demo-category")).toHaveTextContent("Rules for Payroll");
    expect(screen.getByText("Carol Diaz")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Reports" }));
    expect(screen.getByTestId("demo-category")).toHaveTextContent("Rules for Reports");
    expect(screen.getByRole("button", { name: "Reports" })).toHaveAttribute("aria-current", "true");
    expect(screen.queryByText("Carol Diaz")).not.toBeInTheDocument();
    expect(screen.getByText("Dave Kim")).toBeInTheDocument();
  });
});

describe("tabs", () => {
  it("shows editor, simulator and settings, with arrow key navigation", async () => {
    const user = userEvent.setup();
    render(<RaciDemo />);
    expect(screen.getByRole("tab", { name: "Editor" })).toHaveAttribute("aria-selected", "true");
    await user.click(screen.getByRole("tab", { name: "Simulator" }));
    expect(document.querySelector(".raci-simulator")).toBeInTheDocument();
    await user.click(screen.getByRole("tab", { name: "Settings" }));
    expect(document.querySelector(".raci-settings")).toBeInTheDocument();
    screen.getByRole("tab", { name: "Settings" }).focus();
    await user.keyboard("{ArrowRight}");
    expect(screen.getByRole("tab", { name: "Editor" })).toHaveAttribute("aria-selected", "true");
    await user.keyboard("{ArrowLeft}");
    expect(screen.getByRole("tab", { name: "Settings" })).toHaveAttribute("aria-selected", "true");
    await user.keyboard("{Home}");
    expect(screen.getByRole("tab", { name: "Settings" })).toHaveAttribute("aria-selected", "true");
  });
});

describe("rule set data", () => {
  it("edits live JSON and resets to the sample", async () => {
    const user = userEvent.setup();
    render(<RaciDemo />);
    const seed = presetById("org").seed;
    expect(shownJson()).toEqual(seed);
    await user.click(screen.getByRole("checkbox", { name: /Stop inheriting/ }));
    expect(shownJson().categories.payroll.stopInheriting).toBe(false);
    await user.click(screen.getByRole("button", { name: "Reset to sample" }));
    expect(shownJson()).toEqual(seed);
    expect(screen.getByRole("status")).toHaveTextContent("Reset to the sample.");
  });

  it("round trips through download and upload", async () => {
    const user = userEvent.setup();
    let blob: Blob | undefined;
    URL.createObjectURL = vi.fn((b: Blob) => {
      blob = b;
      return "blob:x";
    });
    URL.revokeObjectURL = vi.fn();
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    render(<RaciDemo />);
    await user.click(screen.getByRole("checkbox", { name: /Stop inheriting/ }));
    const edited = shownJson();
    await user.click(screen.getByRole("button", { name: "Download JSON" }));
    expect(click).toHaveBeenCalled();
    const exported = await (blob as Blob).text();
    expect(JSON.parse(exported)).toEqual(edited);

    await user.click(screen.getByRole("button", { name: "Reset to sample" }));
    expect(shownJson()).not.toEqual(edited);
    const input = screen.getByLabelText("Upload rule set JSON");
    await user.upload(input, new File([exported], "rules.json", { type: "application/json" }));
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Loaded rules.json."));
    expect(shownJson()).toEqual(edited);
    click.mockRestore();
  });

  it("reports an invalid upload and keeps the rules", async () => {
    const user = userEvent.setup();
    render(<RaciDemo />);
    const before = shownJson();
    const input = screen.getByLabelText("Upload rule set JSON");
    await user.upload(input, new File(["nope"], "bad.json", { type: "application/json" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Not valid JSON.");
    expect(shownJson()).toEqual(before);
    const wrong = serializeRuleSet({
      categories: { x: { entries: [{ subject: "user:a", action: "zap", effect: "allow" }] } },
      parents: {},
    });
    await user.upload(input, new File([wrong], "w.json", { type: "application/json" }));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("unknown action"));
  });

  it("ignores an upload with no file", () => {
    render(<RaciDemo />);
    const input = screen.getByLabelText("Upload rule set JSON");
    fireEvent.change(input, { target: { files: [] } });
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("copies the JSON, or says it cannot", async () => {
    const user = userEvent.setup();
    render(<RaciDemo />);
    const write = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText: write },
      configurable: true,
    });
    await user.click(screen.getByText("Wire format (JSON)"));
    await user.click(screen.getByRole("button", { name: "Copy JSON" }));
    expect(write).toHaveBeenCalledWith(serializeRuleSet(presetById("org").seed));
    expect(await screen.findByText("Copied to the clipboard.")).toBeInTheDocument();
    write.mockRejectedValue(new Error("no"));
    await user.click(screen.getByRole("button", { name: "Copy JSON" }));
    expect(await screen.findByText(/Copy is not available/)).toBeInTheDocument();
  });
});

describe("props", () => {
  it("applies className to the root next to the built-in classes", () => {
    render(<RaciDemo className="host-wrap" />);
    expect(appRoot()).toHaveClass("host-wrap", "raci-root", "demo-app");
  });

  it("starts on the preset named by initialPreset", () => {
    render(<RaciDemo initialPreset="other" />);
    expect(screen.getByRole("columnheader", { name: "Publish" })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Preset" })).toHaveValue("other");
    expect(shownJson()).toEqual(demoRuleSet("other"));
  });

  it("falls back to the first preset for an unknown initialPreset", () => {
    render(<RaciDemo initialPreset="nope" />);
    expect(screen.getByRole("combobox", { name: "Preset" })).toHaveValue("org");
  });

  it("starts on initialTheme, ahead of the saved choice", () => {
    window.localStorage.setItem("raci-demo-theme", "light");
    render(<RaciDemo initialTheme="dark" />);
    expect(appRoot()).toHaveAttribute("data-theme", "dark");
    expect(screen.getByRole("button", { name: "Dark" })).toHaveAttribute("aria-pressed", "true");
  });

  it("keeps two instances independent, with distinct tab ids", async () => {
    const user = userEvent.setup();
    render(
      <>
        <RaciDemo />
        <RaciDemo initialPreset="other" />
      </>,
    );
    const tabs = screen.getAllByRole("tab", { name: "Simulator" });
    expect(tabs).toHaveLength(2);
    expect(tabs[0]!.id).not.toBe(tabs[1]!.id);
    await user.click(tabs[0]!);
    expect(document.querySelectorAll(".raci-simulator")).toHaveLength(1);
  });
});

describe("cell variants", () => {
  it("offers box, marks and custom, and switches the editor cells", async () => {
    const user = userEvent.setup();
    render(<RaciDemo />);
    const group = screen.getByRole("group", { name: "Cell variant" });
    expect(group.querySelectorAll("button")).toHaveLength(3);
    expect(screen.getByRole("button", { name: "box" })).toHaveAttribute("aria-pressed", "true");
    expect(document.querySelector(".raci-cell--marks")).toBeNull();

    await user.click(screen.getByRole("button", { name: "marks" }));
    expect(document.querySelector("tbody .raci-cell--marks")).not.toBeNull();
    expect(document.querySelector(".raci-cell__text")).toBeNull();

    await user.click(screen.getByRole("button", { name: "custom" }));
    expect(document.querySelector("tbody .raci-cell")).toBeNull();
    expect(document.querySelector("tbody .demo-custom-cell")).not.toBeNull();

    await user.click(screen.getByRole("button", { name: "box" }));
    expect(document.querySelector("tbody .raci-cell")).not.toBeNull();
  });

  it("keeps editing working in the custom cell", async () => {
    const user = userEvent.setup();
    render(<RaciDemo />);
    await user.click(screen.getByRole("button", { name: "custom" }));
    const before = JSON.stringify(shownJson());
    await user.click(document.querySelector("tbody .demo-custom-cell") as HTMLElement);
    expect(JSON.stringify(shownJson())).not.toBe(before);
  });
});

describe("editor start", () => {
  it("starts editable by default and offers an opt-in read-only start", async () => {
    const user = userEvent.setup();
    render(<RaciDemo />);
    const group = screen.getByRole("group", { name: "Editor start" });
    expect(group.querySelectorAll("button")).toHaveLength(2);
    expect(screen.getByRole("button", { name: "editable" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.queryByRole("button", { name: "Edit" })).toBeNull();
    for (const c of document.querySelectorAll("tbody button.raci-cell")) expect(c).toBeEnabled();

    await user.click(screen.getByRole("button", { name: "read-only" }));
    expect(screen.getByRole("button", { name: "Edit" })).toBeInTheDocument();
    for (const c of document.querySelectorAll("tbody button.raci-cell")) expect(c).toBeDisabled();
  });

  it("Edit, change, Save in the read-only start keeps the change", async () => {
    const user = userEvent.setup();
    render(<RaciDemo />);
    await user.click(screen.getByRole("button", { name: "read-only" }));
    const before = JSON.stringify(shownJson());
    await user.click(screen.getByRole("button", { name: "Edit" }));
    await user.click(document.querySelector("tbody button.raci-cell") as HTMLElement);
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(screen.getByRole("button", { name: "Edit" })).toBeInTheDocument();
    expect(JSON.stringify(shownJson())).not.toBe(before);
  });
});

describe("the short-labels preset", () => {
  it("shows R A APV M ACK under Permissions and Obligations, with the full names as names", async () => {
    const user = userEvent.setup();
    render(<RaciDemo />);
    await user.selectOptions(screen.getByRole("combobox", { name: "Preset" }), "short");
    const heads = Array.from(
      document.querySelectorAll<HTMLElement>("thead tr:last-child th[scope=col]"),
    ).map((th) => th.textContent?.trim());
    expect(heads.slice(1, 6)).toEqual(["R", "A", "APV", "M", "ACK"]);
    expect(screen.getAllByRole("columnheader", { name: "Acknowledge" })[0]).toHaveTextContent(
      "ACK",
    );
    expect(screen.getAllByRole("columnheader", { name: "Permissions" }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("columnheader", { name: "Obligations" }).length).toBeGreaterThan(0);
    expect(screen.getByRole("rowheader", { name: "Everyone" })).toBeInTheDocument();
  });

  it("has a switch for the heading labels", async () => {
    const user = userEvent.setup();
    render(<RaciDemo initialPreset="short" />);
    const group = screen.getByRole("group", { name: "Heading labels" });
    expect(group.querySelectorAll("button")).toHaveLength(3);
    await user.click(screen.getByRole("button", { name: "full" }));
    const heads = Array.from(
      document.querySelectorAll<HTMLElement>("thead tr:last-child th[scope=col]"),
    ).map((th) => th.textContent?.trim());
    expect(heads.slice(1, 6)).toEqual(["Read", "Author", "Approve", "Manage", "Acknowledge"]);
  });
});
