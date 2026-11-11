import { useEffect, useId, useState } from "react";
import type { KeyboardEvent } from "react";
import type { SubjectKind, SubjectOption } from "@/core/types";

export interface SubjectPickerProps {
  label: string;
  placeholder: string;
  noMatches: string;
  kinds: readonly SubjectKind[];
  /** Subject ids already chosen; they are not offered again. */
  exclude: readonly string[];
  onPick: (option: SubjectOption) => void;
}

/** A search box with a listbox of subjects from the given kinds (combobox pattern). */
export const SubjectPicker = (props: SubjectPickerProps) => {
  const { label, placeholder, noMatches, kinds, exclude, onPick } = props;
  const uid = useId();
  const inputId = `${uid}-input`;
  const listId = `${uid}-list`;
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [found, setFound] = useState<SubjectOption[] | null>(null);
  const [active, setActive] = useState(0);

  useEffect(() => {
    if (!open) return;
    let live = true;
    const lookups = kinds.map((k) =>
      Promise.resolve()
        .then(() => k.search(query))
        .catch((): SubjectOption[] => []),
    );
    void Promise.all(lookups).then((lists) => {
      if (!live) return;
      setFound(lists.flat());
      setActive(0);
    });
    return () => {
      live = false;
    };
  }, [open, query, kinds]);

  const options = (found ?? []).filter((o) => !exclude.includes(o.id));

  const choose = (option: SubjectOption) => {
    onPick(option);
    setQuery("");
    setOpen(false);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (!open) {
        setOpen(true);
        return;
      }
      const step = e.key === "ArrowDown" ? 1 : -1;
      const n = Math.max(options.length, 1);
      setActive((a) => (a + step + n) % n);
    } else if (e.key === "Enter" && open) {
      const option = options[active];
      if (option) {
        e.preventDefault();
        choose(option);
      }
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  const showList = open && found !== null;
  const activeOption = options[active];

  return (
    <div className="raci-picker">
      <label className="raci-label" htmlFor={inputId}>
        {label}
      </label>
      <input
        id={inputId}
        className="raci-input"
        type="text"
        role="combobox"
        autoComplete="off"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={showList && activeOption ? `${listId}-${active}` : undefined}
        placeholder={placeholder}
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={onKeyDown}
      />
      {showList ? (
        <ul id={listId} className="raci-listbox" role="listbox" aria-label={label}>
          {options.length === 0 ? (
            <li className="raci-listbox-empty" role="presentation">
              {noMatches}
            </li>
          ) : (
            options.map((o, i) => (
              <li
                key={o.id}
                id={`${listId}-${i}`}
                role="option"
                aria-selected={i === active}
                className="raci-option"
                data-active={i === active || undefined}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => choose(o)}
              >
                <span>{o.label}</span>
                {o.detail ? <span className="raci-option-detail">{o.detail}</span> : null}
              </li>
            ))
          )}
        </ul>
      ) : null}
    </div>
  );
};
