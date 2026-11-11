import { useMemo, useRef, useState } from "react";
import type { ChangeEvent, KeyboardEvent, RefObject } from "react";
import { defaultSettings } from "@/core/types";
import type { RaciSettings, ResourceNode, RuleSet } from "@/core/types";
import { RulesEditor, Simulator, SettingsPanel } from "@/index";
import { nodeLabel, presetById, presets } from "./data";
import { parseRuleSet, readTheme, serializeRuleSet, writeTheme } from "./io";
import type { ThemeChoice } from "./io";
import "./brand-override.css";
import "./demo.css";

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
  const preset = presetById(presetId);
  const { config } = preset;
  const [ruleSet, setRuleSet] = useState<RuleSet>(preset.seed);
  const [categoryId, setCategoryId] = useState(preset.initialCategory);
  const [tab, setTab] = useState<TabId>("editor");
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
    document.getElementById(`demo-tab-${next.id}`)?.focus();
  };

  return (
    <div className="demo-layout">
      <nav className="demo-sidebar" aria-label="Resources">
        <h2 className="demo-h2">Resources</h2>
        <Tree nodes={config.resources} selected={categoryId} onSelect={setCategoryId} />
      </nav>

      <main className="demo-main">
        <h2 className="demo-h2" data-testid="demo-category">
          Rules for {nodeLabel(config.resources, categoryId)}
        </h2>
        <div role="tablist" aria-label="Views" className="demo-tabs">
          {tabs.map((t, i) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              id={`demo-tab-${t.id}`}
              aria-selected={tab === t.id}
              aria-controls="demo-panel"
              tabIndex={tab === t.id ? 0 : -1}
              className="demo-tab"
              onClick={() => setTab(t.id)}
              onKeyDown={(e) => onTabKey(e, i)}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div
          role="tabpanel"
          id="demo-panel"
          aria-labelledby={`demo-tab-${tab}`}
          className="demo-panel"
        >
          {tab === "editor" && (
            <RulesEditor
              config={config}
              ruleSet={ruleSet}
              categoryId={categoryId}
              onChange={setRuleSet}
              settings={settings}
            />
          )}
          {tab === "simulator" && (
            <Simulator
              config={config}
              ruleSet={ruleSet}
              categoryId={categoryId}
              onCategoryChange={setCategoryId}
              settings={settings}
            />
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

export const App = () => {
  const [theme, setTheme] = useState<ThemeChoice>(readTheme);
  const [brand, setBrand] = useState(false);
  const [presetId, setPresetId] = useState(presets[0]!.id);
  const dataTheme = theme === "system" ? undefined : theme;

  const chooseTheme = (next: ThemeChoice) => {
    setTheme(next);
    writeTheme(next);
  };

  return (
    <div
      className={["raci-root", "demo-app", brand ? "demo-brand" : ""].filter(Boolean).join(" ")}
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
