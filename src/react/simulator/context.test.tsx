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
import { afterEach, describe, expect, it } from "vitest";
import type { RaciConfig, RuleSet } from "@/core/types";
import { Simulator } from "@/react/simulator/Simulator";

afterEach(cleanup);

const ruleSet: RuleSet = {
  categories: {
    docs: {
      entries: [
        { subject: "everyone:*", action: "view", effect: "allow" },
        { subject: "can:ack", action: "ack", effect: "allow" },
      ],
    },
  },
  parents: {},
};

const config = (extra: Partial<RaciConfig> = {}): RaciConfig => ({
  actions: [
    { id: "view", label: "View" },
    { id: "ack", label: "Acknowledge" },
  ],
  subjectKinds: [],
  matchers: [
    { id: "can:ack", label: "Can acknowledge" },
    { id: "has:approve", label: "Can approve" },
  ],
  resources: [{ id: "docs", label: "Documents" }],
  ...extra,
});

const show = (cfg: RaciConfig) =>
  render(<Simulator config={cfg} ruleSet={ruleSet} categoryId="docs" />);

const verdict = (action: string): string => {
  const row = screen.getByRole("rowheader", { name: action }).closest("tr") as HTMLElement;
  return within(row).getAllByRole("cell")[0]!.textContent ?? "";
};

describe("matcher toggles", () => {
  it("previews at once, with no directory lookup and no picker", () => {
    show(config());
    expect(screen.queryByRole("combobox")).toBeNull();
    expect(screen.getByRole("group", { name: "Which of these apply?" })).toBeInTheDocument();
    expect(verdict("View")).toBe("Would be allowed");
    expect(verdict("Acknowledge")).toBe("Would be denied");
  });

  it("toggling a matcher changes the answer, and the reason names it by its label", async () => {
    const user = userEvent.setup();
    show(config());
    await user.click(screen.getByRole("checkbox", { name: "Can acknowledge" }));
    expect(verdict("Acknowledge")).toBe("Would be allowed");
    const row = screen.getByRole("rowheader", { name: "Acknowledge" }).closest("tr") as HTMLElement;
    expect(row).toHaveTextContent("Can acknowledge");
    await user.click(screen.getByRole("checkbox", { name: "Can acknowledge" }));
    expect(verdict("Acknowledge")).toBe("Would be denied");
  });

  it("says Everyone for the built-in subject in a reason", () => {
    show(config());
    const row = screen.getByRole("rowheader", { name: "View" }).closest("tr") as HTMLElement;
    expect(row).toHaveTextContent("Everyone");
  });
});

describe("named contexts", () => {
  const cfg = config({
    contexts: [
      { id: "hire", label: "New hire", subjects: ["can:ack"] },
      { id: "guest", label: "Guest", subjects: [] },
    ],
  });

  it("asks for a context first, with the host's label", () => {
    show({ ...cfg, strings: { "simulator.context": "Account" } });
    expect(screen.getByRole("combobox", { name: "Account" })).toBeInTheDocument();
    expect(screen.getByText(/Choose a context to preview/)).toBeInTheDocument();
  });

  it("previews the chosen context using its matchers", async () => {
    const user = userEvent.setup();
    show(cfg);
    expect(screen.getByRole("combobox", { name: "Context" })).toBeInTheDocument();
    await user.selectOptions(screen.getByRole("combobox", { name: "Context" }), "hire");
    expect(verdict("Acknowledge")).toBe("Would be allowed");
    await user.selectOptions(screen.getByRole("combobox", { name: "Context" }), "guest");
    expect(verdict("Acknowledge")).toBe("Would be denied");
  });

  it("a context can be adjusted with the toggles", async () => {
    const user = userEvent.setup();
    show(cfg);
    await user.selectOptions(screen.getByRole("combobox", { name: "Context" }), "guest");
    await user.click(screen.getByRole("checkbox", { name: "Can acknowledge" }));
    expect(verdict("Acknowledge")).toBe("Would be allowed");
  });
});

describe("a host with a directory keeps the person picker", () => {
  it("is unchanged when there are no matchers or contexts", () => {
    show({
      actions: [{ id: "view", label: "View" }],
      subjectKinds: [{ kind: "user", label: "People", search: () => [] }],
      resources: [{ id: "docs", label: "Documents" }],
    });
    expect(screen.getByRole("combobox", { name: "Person" })).toBeInTheDocument();
    expect(screen.queryByRole("group", { name: "Which of these apply?" })).toBeNull();
  });
});
