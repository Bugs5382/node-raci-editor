import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "./App";
import { presetById } from "./data";
import { serializeRuleSet } from "./io";

const shownJson = () => JSON.parse(screen.getByTestId("demo-json").textContent ?? "{}");
const appRoot = () => document.querySelector(".demo-app") as HTMLElement;

beforeEach(() => {
  window.localStorage.clear();
});

describe("theme and brand", () => {
  it("sets data-theme on the wrapper and inner roots, and persists it", async () => {
    const user = userEvent.setup();
    render(<App />);
    expect(appRoot()).not.toHaveAttribute("data-theme");
    await user.click(screen.getByRole("button", { name: "Dark" }));
    expect(appRoot()).toHaveAttribute("data-theme", "dark");
    expect(document.querySelector(".raci-editor")).toHaveAttribute("data-theme", "dark");
    expect(window.localStorage.getItem("raci-demo-theme")).toBe("dark");
    await user.click(screen.getByRole("button", { name: "Light" }));
    expect(appRoot()).toHaveAttribute("data-theme", "light");
    await user.click(screen.getByRole("button", { name: "System" }));
    expect(appRoot()).not.toHaveAttribute("data-theme");
    expect(document.querySelector(".raci-editor")).not.toHaveAttribute("data-theme");
  });

  it("restores the saved theme", () => {
    window.localStorage.setItem("raci-demo-theme", "dark");
    render(<App />);
    expect(appRoot()).toHaveAttribute("data-theme", "dark");
    expect(screen.getByRole("button", { name: "Dark" })).toHaveAttribute("aria-pressed", "true");
  });

  it("toggles the brand override class", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole("checkbox", { name: "Brand override" }));
    expect(appRoot()).toHaveClass("demo-brand");
    await user.click(screen.getByRole("checkbox", { name: "Brand override" }));
    expect(appRoot()).not.toHaveClass("demo-brand");
  });
});

describe("presets", () => {
  it("switches configuration, tree, strings and rules", async () => {
    const user = userEvent.setup();
    render(<App />);
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

describe("tree selection", () => {
  it("updates the category shown by the editor", async () => {
    const user = userEvent.setup();
    render(<App />);
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
    render(<App />);
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
    render(<App />);
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
    render(<App />);
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
    render(<App />);
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
    render(<App />);
    const input = screen.getByLabelText("Upload rule set JSON");
    fireEvent.change(input, { target: { files: [] } });
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("copies the JSON, or says it cannot", async () => {
    const user = userEvent.setup();
    render(<App />);
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
