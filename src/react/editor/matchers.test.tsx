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
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { RaciConfig, RuleSet } from "@/core/types";
import { RulesEditor } from "@/react/editor/RulesEditor";

afterEach(cleanup);

const config = (extra: Partial<RaciConfig> = {}): RaciConfig => ({
  actions: [
    { id: "view", label: "View" },
    { id: "ack", label: "Acknowledge" },
  ],
  subjectKinds: [],
  matchers: [
    {
      id: "can:ack",
      label: "Can acknowledge",
      description: "Anyone who may acknowledge",
      group: "Duties",
    },
    { id: "has:approve", label: "Can approve", group: "Duties" },
    { id: "in:review", label: "In review" },
  ],
  resources: [{ id: "docs", label: "Documents" }],
  ...extra,
});

const ruleSet: RuleSet = {
  categories: { docs: { entries: [{ subject: "can:ack", action: "ack", effect: "allow" }] } },
  parents: {},
};

const show = (cfg: RaciConfig, rs: RuleSet = ruleSet, onChange = vi.fn()) => {
  render(<RulesEditor config={cfg} ruleSet={rs} categoryId="docs" onChange={onChange} />);
  return onChange;
};

describe("a host with no subject kinds", () => {
  it("shows no kind chooser and no search, only a flat choice", () => {
    show(config());
    expect(screen.queryByRole("combobox", { name: /search/i })).toBeNull();
    expect(document.querySelector(".raci-picker__kind")).toBeNull();
    expect(document.querySelector("input[role=combobox]")).toBeNull();
    const choice = screen.getByRole("combobox", { name: "Choose who to add" });
    expect(choice.tagName).toBe("SELECT");
  });

  it("offers Everyone and each matcher not already a row, grouped", () => {
    show(config());
    const choice = screen.getByRole("combobox", { name: "Choose who to add" });
    const labels = within(choice)
      .getAllByRole("option")
      .map((o) => o.textContent);
    expect(labels).toEqual(
      ["Add a subject", "Everyone", "Can approve", "In review", "Can acknowledge"].filter(
        (l) => l !== "Can acknowledge",
      ),
    );
    expect(choice.querySelector("optgroup")).toHaveAttribute("label", "Duties");
    expect(within(choice).getByRole("option", { name: "Can approve" })).toBeInTheDocument();
  });

  it("labels existing rows with the matcher's label and the built-in Everyone", () => {
    show(config(), {
      categories: {
        docs: {
          entries: [
            { subject: "can:ack", action: "ack", effect: "allow" },
            { subject: "everyone:*", action: "view", effect: "allow" },
          ],
        },
      },
      parents: {},
    });
    expect(screen.getByRole("rowheader", { name: "Can acknowledge" })).toBeInTheDocument();
    expect(screen.getByRole("rowheader", { name: "Everyone" })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Can acknowledge, Acknowledge: allow" }),
    ).toBeInTheDocument();
  });

  it("adds a row for a chosen matcher, which becomes a rule only when a cell is set", async () => {
    const user = userEvent.setup();
    const onChange = show(config());
    await user.selectOptions(
      screen.getByRole("combobox", { name: "Choose who to add" }),
      "has:approve",
    );
    expect(screen.getByRole("rowheader", { name: "Can approve" })).toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Can approve, View: not set" }));
    expect(onChange.mock.calls[0]![0].categories.docs.entries).toContainEqual({
      subject: "has:approve",
      action: "view",
      effect: "allow",
    });
    const choice = screen.getByRole("combobox", { name: "Choose who to add" });
    expect(within(choice).queryByRole("option", { name: "Can approve" })).toBeNull();
  });

  it("works with Everyone alone and with no matchers at all", async () => {
    const user = userEvent.setup();
    show(config({ matchers: undefined }), { categories: {}, parents: {} });
    const choice = screen.getByRole("combobox", { name: "Choose who to add" });
    expect(
      within(choice)
        .getAllByRole("option")
        .map((o) => o.textContent),
    ).toEqual(["Add a subject", "Everyone"]);
    await user.selectOptions(choice, "everyone:*");
    expect(screen.getByRole("rowheader", { name: "Everyone" })).toBeInTheDocument();
  });

  it("takes the words from config.strings", () => {
    show(
      config({ strings: { "editor.everyone": "All callers", "editor.pickMatcher": "Add who" } }),
    );
    const choice = screen.getByRole("combobox", { name: "Add who" });
    expect(within(choice).getByRole("option", { name: "All callers" })).toBeInTheDocument();
  });
});

describe("matchers mixed with subject kinds", () => {
  it("keeps the kind picker and adds the flat choice", () => {
    show(config({ subjectKinds: [{ kind: "user", label: "People", search: () => [] }] }));
    expect(document.querySelector("input[role=combobox]")).not.toBeNull();
    expect(screen.getByRole("combobox", { name: "Choose who to add" })).toBeInTheDocument();
  });
  it("a host with kinds and no matchers sees nothing new", () => {
    show(
      config({
        matchers: undefined,
        subjectKinds: [{ kind: "user", label: "People", search: () => [] }],
      }),
    );
    expect(screen.queryByRole("combobox", { name: "Choose who to add" })).toBeNull();
  });
});
