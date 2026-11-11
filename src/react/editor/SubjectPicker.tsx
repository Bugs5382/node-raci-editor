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
import { useEffect, useId, useRef, useState } from "react";
import type { SubjectKind, SubjectOption } from "@/core/types";

export const SEARCH_DEBOUNCE_MS = 200;

type Status = "idle" | "loading" | "done" | "error";

export interface SubjectPickerProps {
  kinds: SubjectKind[];
  /** Subjects already shown as rows; they are left out of the results. */
  existing: string[];
  onPick: (option: SubjectOption) => void;
  /** Greys the whole picker out (read-only view); it keeps its size. */
  disabled?: boolean;
  /** Names the group; default "Add subject". */
  label?: string;
  /** Names the search box; default "Search". */
  searchLabel?: string;
  t: (key: string, vars?: Record<string, string | number>) => string;
}

/** Kind select plus an async, debounced, keyboard accessible search combobox. */
export const SubjectPicker = ({
  kinds,
  existing,
  onPick,
  disabled = false,
  label,
  searchLabel,
  t,
}: SubjectPickerProps) => {
  const uid = useId();
  const listId = `${uid}-list`;
  const [kindId, setKindId] = useState(kinds[0]?.kind ?? "");
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<Status>("idle");
  const [results, setResults] = useState<SubjectOption[]>([]);
  const [active, setActive] = useState(0);
  const requestId = useRef(0);
  const kind = kinds.find((k) => k.kind === kindId) ?? kinds[0];
  const searchName = searchLabel ?? t("editor.search");

  useEffect(() => {
    requestId.current += 1;
    const mine = requestId.current;
    if (!kind || query.trim() === "") {
      setStatus("idle");
      setResults([]);
      return;
    }
    setStatus("loading");
    const timer = setTimeout(() => {
      Promise.resolve()
        .then(() => kind.search(query.trim()))
        .then(
          (found) => {
            if (mine !== requestId.current) return;
            setResults(found);
            setActive(0);
            setStatus("done");
          },
          () => {
            if (mine !== requestId.current) return;
            setResults([]);
            setStatus("error");
          },
        );
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [kind, query]);

  const options = results.filter((r) => !existing.includes(r.id));
  const showPanel = open && status !== "idle";

  const pick = (option: SubjectOption) => {
    onPick(option);
    setQuery("");
    setOpen(false);
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        setOpen(true);
        setActive((i) => Math.min(i + 1, Math.max(options.length - 1, 0)));
        break;
      case "ArrowUp":
        event.preventDefault();
        setActive((i) => Math.max(i - 1, 0));
        break;
      case "Enter": {
        const chosen = options[active];
        if (showPanel && status === "done" && chosen) {
          event.preventDefault();
          pick(chosen);
        }
        break;
      }
      case "Escape":
        setOpen(false);
        break;
      default:
    }
  };

  return (
    <div className="raci-picker" role="group" aria-label={label ?? t("editor.addSubject")}>
      {kinds.length > 1 && (
        <label className="raci-picker__kind">
          <span className="raci-visually-hidden">{t("editor.kind")}</span>
          <select
            className="raci-select"
            disabled={disabled}
            value={kind?.kind ?? ""}
            onChange={(e) => {
              setKindId(e.target.value);
              setResults([]);
            }}
          >
            {kinds.map((k) => (
              <option key={k.kind} value={k.kind}>
                {k.label}
              </option>
            ))}
          </select>
        </label>
      )}
      <div className="raci-picker__search">
        <input
          className="raci-input"
          type="text"
          role="combobox"
          aria-label={searchName}
          aria-autocomplete="list"
          aria-expanded={showPanel}
          aria-controls={listId}
          aria-activedescendant={
            showPanel && status === "done" && options[active] ? `${uid}-opt-${active}` : undefined
          }
          placeholder={t("editor.searchPlaceholder")}
          disabled={disabled}
          autoComplete="off"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setOpen(false)}
          onKeyDown={onKeyDown}
        />
        <ul
          id={listId}
          role="listbox"
          aria-label={searchName}
          className="raci-listbox"
          hidden={!showPanel}
        >
          {status === "loading" && (
            <li role="status" className="raci-listbox__note">
              {t("editor.searching")}
            </li>
          )}
          {status === "error" && (
            <li role="alert" className="raci-listbox__note raci-listbox__note--error">
              {t("editor.searchError")}
            </li>
          )}
          {status === "done" && options.length === 0 && (
            <li role="presentation" className="raci-listbox__note">
              {t("editor.noResults")}
            </li>
          )}
          {status === "done" &&
            options.map((option, i) => (
              <li
                key={option.id}
                id={`${uid}-opt-${i}`}
                role="option"
                aria-selected={i === active}
                className={`raci-listbox__option${i === active ? " raci-listbox__option--active" : ""}`}
                // mouse down, not click: the input must not blur before the pick lands
                onMouseDown={(e) => {
                  e.preventDefault();
                  pick(option);
                }}
                onMouseEnter={() => setActive(i)}
              >
                <span>{option.label}</span>
                {option.detail && <span className="raci-listbox__detail">{option.detail}</span>}
              </li>
            ))}
        </ul>
      </div>
    </div>
  );
};
