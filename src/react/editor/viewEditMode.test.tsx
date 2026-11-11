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
import { readFileSync } from "node:fs";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { RaciConfig, RuleSet } from "@/core/types";
import { RulesEditor } from "@/react/editor/RulesEditor";
import type { RulesEditorProps } from "@/react/editor/RulesEditor";

afterEach(cleanup);

const config: RaciConfig = {
  actions: [
    { id: "view", label: "View" },
    { id: "edit", label: "Edit rule", implies: ["view"] },
  ],
  subjectKinds: [{ kind: "user", label: "Users", search: () => [] }],
  resources: [{ id: "docs", label: "Documents" }],
};

const ruleSet: RuleSet = {
  categories: { docs: { entries: [{ subject: "user:bob", action: "view", effect: "allow" }] } },
  parents: {},
};

const base = (extra: Partial<RulesEditorProps> = {}): RulesEditorProps => ({
  config,
  ruleSet,
  categoryId: "docs",
  onChange: () => {},
  ...extra,
});

const cells = () => Array.from(document.querySelectorAll<HTMLElement>("tbody button.raci-cell"));
const btn = (name: string) => screen.queryByRole("button", { name });

describe("default: nothing changes for a host that does not opt in", () => {
  it("has no Edit, Save or Cancel and an editable grid", () => {
    render(<RulesEditor {...base()} />);
    expect(btn("Edit")).toBeNull();
    expect(btn("Save")).toBeNull();
    for (const c of cells()) expect(c).toBeEnabled();
    expect(document.querySelector("table")).not.toHaveAttribute("aria-readonly");
  });
});

describe("defaultMode view", () => {
  it("starts read-only: nothing can be changed, nothing fires", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<RulesEditor {...base({ defaultMode: "view", onChange })} />);
    expect(btn("Edit")).toBeInTheDocument();
    expect(document.querySelector("table")).toHaveAttribute("aria-readonly", "true");
    for (const c of cells()) {
      expect(c).toBeDisabled();
      await user.click(c);
    }
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByRole("checkbox")).toBeDisabled();
    const remove = screen.getByRole("button", { name: /^Remove /, hidden: true });
    expect(remove).toBeDisabled();
    expect(screen.getByRole("combobox", { name: /search/i })).toBeDisabled();
  });

  it("keeps the grid out of the tab order while viewing (no tab traps)", async () => {
    const user = userEvent.setup();
    render(<RulesEditor {...base({ defaultMode: "view" })} />);
    await user.tab();
    expect(screen.getByRole("button", { name: "Edit" })).toHaveFocus();
    await user.tab();
    expect(cells().some((c) => c === document.activeElement)).toBe(false);
  });

  it("Edit opens editing with Save disabled until something changes", async () => {
    const user = userEvent.setup();
    render(<RulesEditor {...base({ defaultMode: "view" })} />);
    await user.click(screen.getByRole("button", { name: "Edit" }));
    expect(btn("Edit")).toBeNull();
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeEnabled();
    for (const c of cells()) expect(c).toBeEnabled();
    expect(document.querySelector("table")).not.toHaveAttribute("aria-readonly", "true");
  });
});

describe("canEdit and readOnlyReason", () => {
  it("hides Edit when the person may not edit", () => {
    render(<RulesEditor {...base({ defaultMode: "view", canEdit: false })} />);
    expect(btn("Edit")).toBeNull();
  });
  it("shows a disabled Edit with the host's reason", () => {
    render(
      <RulesEditor
        {...base({ defaultMode: "view", canEdit: false, readOnlyReason: "Locked by review" })}
      />,
    );
    const edit = screen.getByRole("button", { name: "Edit" });
    expect(edit).toBeDisabled();
    expect(edit).toHaveAttribute("title", "Locked by review");
    expect(screen.getByText("Locked by review")).toBeInTheDocument();
  });
});

describe("working copy, Save and Cancel", () => {
  const Host = (p: Partial<RulesEditorProps> & { onSave: RulesEditorProps["onSave"] }) => {
    const [rs, setRs] = useState(ruleSet);
    return <RulesEditor {...base({ defaultMode: "view", ruleSet: rs, onChange: setRs, ...p })} />;
  };
  const setFirst = async (user: ReturnType<typeof userEvent.setup>) => {
    await user.click(screen.getByRole("button", { name: "Edit" }));
    await user.click(screen.getByRole("button", { name: "user:bob, Edit rule: not set" }));
  };

  it("marks unsaved changes and Save emits once with the working copy, then views", async () => {
    const onSave = vi.fn();
    const user = userEvent.setup();
    render(<Host onSave={onSave} />);
    expect(screen.getByRole("status")).toHaveTextContent("");
    await setFirst(user);
    expect(screen.getByRole("status")).toHaveTextContent("Unsaved changes");
    const save = screen.getByRole("button", { name: "Save" });
    expect(save).toBeEnabled();
    await user.dblClick(save);
    expect(onSave).toHaveBeenCalledTimes(1);
    const saved = onSave.mock.calls[0]![0] as RuleSet;
    expect(saved.categories.docs!.entries).toContainEqual({
      subject: "user:bob",
      action: "edit",
      effect: "allow",
    });
    expect(btn("Edit")).toBeInTheDocument();
    expect(btn("Save")).toBeNull();
  });

  it("Cancel with changes asks, and on confirm restores what Edit started from", async () => {
    const onSave = vi.fn();
    const onCancel = vi.fn();
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<Host onSave={onSave} onCancel={onCancel} onChange={onChange} />);
    await setFirst(user);
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    const dialog = screen.getByRole("alertdialog");
    expect(dialog).toHaveTextContent("Discard unsaved changes?");
    await user.click(screen.getByRole("button", { name: "Discard" }));
    expect(onSave).not.toHaveBeenCalled();
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenLastCalledWith(ruleSet);
    expect(btn("Edit")).toBeInTheDocument();
  });

  it("declining the discard stays in edit mode with the changes", async () => {
    const user = userEvent.setup();
    render(<Host onSave={vi.fn()} />);
    await setFirst(user);
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    await user.click(
      within(screen.getByRole("alertdialog")).getByRole("button", { name: "Keep editing" }),
    );
    expect(screen.getByRole("button", { name: "Save" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "user:bob, Edit rule: allow" })).toBeInTheDocument();
  });

  it("Cancel with no changes leaves without asking", async () => {
    const onCancel = vi.fn();
    const user = userEvent.setup();
    render(<Host onSave={vi.fn()} onCancel={onCancel} />);
    await user.click(screen.getByRole("button", { name: "Edit" }));
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(btn("Edit")).toBeInTheDocument();
  });

  it("the confirmDiscard slot replaces the built-in dialog", async () => {
    const confirmDiscard = vi.fn().mockResolvedValue(false);
    const user = userEvent.setup();
    render(<Host onSave={vi.fn()} confirmDiscard={confirmDiscard} />);
    await setFirst(user);
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(confirmDiscard).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("alertdialog")).toBeNull();
    await waitFor(() => expect(screen.getByRole("button", { name: "Save" })).toBeEnabled());
  });
});

describe("controlled mode", () => {
  it("asks the host to change mode and follows it", async () => {
    const onModeChange = vi.fn();
    const user = userEvent.setup();
    const { rerender } = render(<RulesEditor {...base({ mode: "view", onModeChange })} />);
    await user.click(screen.getByRole("button", { name: "Edit" }));
    expect(onModeChange).toHaveBeenCalledWith("edit");
    expect(btn("Edit")).toBeInTheDocument();
    rerender(<RulesEditor {...base({ mode: "edit", onModeChange })} />);
    expect(btn("Save")).toBeInTheDocument();
    for (const c of cells()) expect(c).toBeEnabled();
  });
});

describe("strings and readOnly", () => {
  it("takes every label from config.strings", () => {
    render(
      <RulesEditor
        {...base({
          defaultMode: "view",
          config: { ...config, strings: { "editor.edit": "Modify" } },
        })}
      />,
    );
    expect(btn("Modify")).toBeInTheDocument();
  });
  it("readOnly still wins: no Edit button", () => {
    render(<RulesEditor {...base({ defaultMode: "view", readOnly: true })} />);
    expect(btn("Edit")).toBeNull();
  });
});

describe("stylesheet: toggling does not resize anything", () => {
  const css = readFileSync("src/styles/editor.css", "utf8");
  it("reserves the unsaved marker and keeps removal in the layout while viewing", () => {
    expect(css).toMatch(/\.raci-editor__unsaved\s*\{[^}]*min-height/);
    expect(css).toMatch(
      /\.raci-editor--viewing \.raci-button--quiet\s*\{[^}]*visibility:\s*hidden/,
    );
    const viewing = css.slice(css.indexOf(".raci-editor--viewing"));
    expect(viewing).not.toMatch(/(?:^|[\s;{])(width|height|padding|margin)[\w-]*\s*:/);
  });
});
