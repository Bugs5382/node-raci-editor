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
import { useId, useMemo, useRef, useState } from "react";
import type { ChangeEvent, KeyboardEvent, RefObject } from "react";
import { defaultSettings } from "@/core/types";
import type { RaciSettings, ResourceNode, RuleSet } from "@/core/types";
import { RulesEditor } from "@/react/editor/index";
import { demoRenderCell } from "@/demo/cells";
import { SettingsPanel } from "@/react/settings/index";
import { Simulator } from "@/react/simulator/Simulator";
import type { SimulatorVariant } from "@/react/simulator/view";
import { nodeLabel, presetById, presets } from "./data";
import { parseRuleSet, readTheme, serializeRuleSet, writeTheme } from "./io";
import type { ThemeChoice } from "./io";

type TabId = "editor" | "simulator" | "settings";
const tabs: { id: TabId; label: string }[] = [
  { id: "editor", label: "Editor" },
  { id: "simulator", label: "Simulator" },
  { id: "settings", label: "Settings" },
];
const themes: { id: ThemeChoice; label: string }[] = [
  { id: "light", label: "Light" },
  { id: "dark", label: "Dark" },
  { id: "system", label: "System" },
];

const Tree = ({
  nodes,
  selected,
  onSelect,
}: {
  nodes: ResourceNode[];
  selected: string;
  onSelect: (id: string) => void;
}) => (
  <ul className="demo-tree">
    {nodes.map((n) => (
      <li key={n.id}>
        <button
          type="button"
          className="demo-tree-item"
          aria-current={n.id === selected ? "true" : undefined}
          onClick={() => onSelect(n.id)}
        >
          {n.label}
        </button>
        {n.children !== undefined && n.children.length > 0 && (
          <Tree nodes={n.children} selected={selected} onSelect={onSelect} />
        )}
      </li>
    ))}
  </ul>
);

const Workbench = ({ presetId }: { presetId: string }) => {
  const uid = useId();
  const tabId = (id: TabId) => `${uid}-tab-${id}`;
  const panelId = `${uid}-panel`;
  const preset = presetById(presetId);
  const { config } = preset;
  const [ruleSet, setRuleSet] = useState<RuleSet>(preset.seed);
  const [categoryId, setCategoryId] = useState(preset.initialCategory);
  const [tab, setTab] = useState<TabId>("editor");
  const [variant, setVariant] = useState<SimulatorVariant>("list");
  const [cell, setCell] = useState<"box" | "marks" | "custom">("box");
  const [headings, setHeadings] = useState<"auto" | "full" | "short">(preset.headerMode ?? "auto");
  const [settings, setSettings] = useState<RaciSettings>(() => defaultSettings(config));
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const fileInput: RefObject<HTMLInputElement | null> = useRef(null);
  const json = useMemo(() => serializeRuleSet(ruleSet), [ruleSet]);
  const actionIds = config.actions.map((a) => a.id);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(json);
      setMessage("Copied to the clipboard.");
    } catch {
      setMessage("Copy is not available here. Select the text instead.");
    }
  };

  const download = () => {
    const url = URL.createObjectURL(new Blob([json], { type: "application/json" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `raci-rules-${preset.id}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const upload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (file === undefined) return;
    try {
      setRuleSet(parseRuleSet(await file.text(), actionIds));
      setError("");
      setMessage(`Loaded ${file.name}.`);
    } catch (error_) {
      setMessage("");
      setError(error_ instanceof Error ? error_.message : "Could not load the file.");
    }
  };

  const reset = () => {
    setRuleSet(preset.seed);
    setError("");
    setMessage("Reset to the sample.");
  };

  const onTabKey = (e: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const step = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
    if (step === 0) return;
    e.preventDefault();
    const next = tabs[(index + step + tabs.length) % tabs.length]!;
    setTab(next.id);
    document.getElementById(tabId(next.id))?.focus();
  };

  return (
    <div className="demo-layout">
      <div className="demo-host-frame">
        <p className="demo-host-caption">host app: resource tree, not part of the package</p>
        <nav className="demo-sidebar" aria-label="Resources">
          <h2 className="demo-h2">Resources</h2>
          <Tree nodes={config.resources} selected={categoryId} onSelect={setCategoryId} />
        </nav>
      </div>

      <main className="demo-main">
        <p className="demo-package-caption">package: rules editor, simulator, settings</p>
        <h2 className="demo-h2" data-testid="demo-category">
          Rules for {nodeLabel(config.resources, categoryId)}
        </h2>
        <div role="tablist" aria-label="Views" className="demo-tabs">
          {tabs.map((t, i) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              id={tabId(t.id)}
              aria-selected={tab === t.id}
              aria-controls={panelId}
              tabIndex={tab === t.id ? 0 : -1}
              className="demo-tab"
              onClick={() => setTab(t.id)}
              onKeyDown={(e) => onTabKey(e, i)}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div role="tabpanel" id={panelId} aria-labelledby={tabId(tab)} className="demo-panel">
          {tab === "editor" && (
            <>
              <div className="demo-actions" role="group" aria-label="Heading labels">
                {(["auto", "full", "short"] as const).map((v) => (
                  <button
                    key={v}
                    type="button"
                    className="demo-button"
                    aria-pressed={headings === v}
                    onClick={() => setHeadings(v)}
                  >
                    {v}
                  </button>
                ))}
              </div>
              <div className="demo-actions" role="group" aria-label="Cell variant">
                {(["box", "marks", "custom"] as const).map((v) => (
                  <button
                    key={v}
                    type="button"
                    className="demo-button"
                    aria-pressed={cell === v}
                    onClick={() => setCell(v)}
                  >
                    {v}
                  </button>
                ))}
              </div>
              <RulesEditor
                headerMode={headings}
                config={config}
                ruleSet={ruleSet}
                categoryId={categoryId}
                onChange={setRuleSet}
                settings={settings}
                cellVariant={cell === "marks" ? "marks" : "box"}
                renderCell={cell === "custom" ? demoRenderCell : undefined}
              />
            </>
          )}
          {tab === "simulator" && (
            <>
              <div className="demo-actions" role="group" aria-label="Simulator view">
                {(["list", "boxes", "strips"] as const).map((v) => (
                  <button
                    key={v}
                    type="button"
                    className="demo-button"
                    aria-pressed={variant === v}
                    onClick={() => setVariant(v)}
                  >
                    {v}
                  </button>
                ))}
              </div>
              <Simulator
                config={config}
                ruleSet={ruleSet}
                categoryId={categoryId}
                settings={settings}
                variant={variant}
              />
            </>
          )}
          {tab === "settings" && (
            <SettingsPanel config={config} value={settings} onChange={setSettings} />
          )}
        </div>

        <section className="demo-data" aria-label="Rule set data">
          <div className="demo-actions">
            <button type="button" className="demo-button" onClick={reset}>
              Reset to sample
            </button>
            <button type="button" className="demo-button" onClick={download}>
              Download JSON
            </button>
            <button
              type="button"
              className="demo-button"
              onClick={() => fileInput.current?.click()}
            >
              Upload JSON
            </button>
            <input
              ref={fileInput}
              type="file"
              accept="application/json,.json"
              className="demo-file"
              aria-label="Upload rule set JSON"
              onChange={(e) => void upload(e)}
            />
          </div>
          <p className="demo-status" role="status">
            {message}
          </p>
          {error !== "" && (
            <p className="demo-error" role="alert">
              {error}
            </p>
          )}
          <details className="demo-json">
            <summary>Wire format (JSON)</summary>
            <button type="button" className="demo-button" onClick={() => void copy()}>
              Copy JSON
            </button>
            <pre className="demo-pre" data-testid="demo-json">
              {json}
            </pre>
          </details>
        </section>
      </main>
    </div>
  );
};

/** Props of {@link RaciDemo}. All are optional. */
export interface RaciDemoProps {
  /** Extra class name(s) for the root element, next to `raci-root` and `demo-app`. */
  className?: string;
  /** Preset shown first, `"org"` (default) or `"other"`. An unknown id falls back to `"org"`. */
  initialPreset?: string;
  /** Theme chosen first. When omitted the last saved choice is used, else `"system"`. */
  initialTheme?: ThemeChoice;
}

/**
 * A ready-to-render demo: a resource tree, the rules editor, simulator and settings panel in tabs,
 * the rule set as JSON (copy, download, upload), a light/dark/system theme switch and a brand
 * override toggle. Import `node-raci-editor/styles.css` and `node-raci-editor/demo.css` first.
 * The wrapper sets `data-theme`, so the host page is not touched.
 */
export const RaciDemo = ({ className, initialPreset, initialTheme }: RaciDemoProps = {}) => {
  const [theme, setTheme] = useState<ThemeChoice>(() => initialTheme ?? readTheme());
  const [brand, setBrand] = useState(false);
  const [presetId, setPresetId] = useState(() => presetById(initialPreset ?? "").id);
  const dataTheme = theme === "system" ? undefined : theme;

  const chooseTheme = (next: ThemeChoice) => {
    setTheme(next);
    writeTheme(next);
  };

  return (
    <div
      className={["raci-root", "demo-app", brand ? "demo-brand" : "", className ?? ""]
        .filter(Boolean)
        .join(" ")}
      data-theme={dataTheme}
    >
      <header className="demo-header">
        <h1 className="demo-title">RACI editor demo</h1>
        <div className="demo-controls">
          <label className="demo-field">
            <span>Preset</span>
            <select
              className="demo-select"
              value={presetId}
              onChange={(e) => setPresetId(e.target.value)}
            >
              {presets.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
          </label>
          <div role="group" aria-label="Theme" className="demo-segment">
            {themes.map((t) => (
              <button
                key={t.id}
                type="button"
                className="demo-button"
                aria-pressed={theme === t.id}
                onClick={() => chooseTheme(t.id)}
              >
                {t.label}
              </button>
            ))}
          </div>
          <label className="demo-check">
            <input type="checkbox" checked={brand} onChange={(e) => setBrand(e.target.checked)} />
            <span>Brand override</span>
          </label>
        </div>
      </header>
      <Workbench key={presetId} presetId={presetId} />
    </div>
  );
};
