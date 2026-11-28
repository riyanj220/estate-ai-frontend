"use client";

import { useEffect, useId, useRef, useState, useSyncExternalStore } from "react";

type Option = { value: string; label: string };

const never = () => () => {};

/**
 * A long dropdown with a search box inside, as wide as its field. The server renders a plain select, which also serves a browser
 * without scripts; the form sends the same field either way.
 */
export function SearchSelect({ id, name, options, emptyLabel, searchLabel }: { id: string; name: string; options: Option[]; emptyLabel: string; searchLabel: string }) {
  const ready = useSyncExternalStore(never, () => true, () => false);
  const [value, setValue] = useState("");
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const search = useRef<HTMLInputElement>(null);
  const listId = useId();

  const all = [{ value: "", label: emptyLabel }, ...options];
  const wanted = query.trim().toLowerCase();
  const shown = wanted ? options.filter((option) => option.label.toLowerCase().includes(wanted)) : all;
  const selected = all.find((option) => option.value === value) ?? all[0];

  useEffect(() => {
    if (!open) return;
    search.current?.focus();
    const outside = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [open]);

  useEffect(() => {
    if (open) document.getElementById(`${listId}-${active}`)?.scrollIntoView({ block: "nearest" });
  }, [open, active, listId]);

  function show() {
    setQuery("");
    setActive(Math.max(0, all.findIndex((option) => option.value === value)));
    setOpen(true);
  }

  function close() {
    setOpen(false);
    button.current?.focus();
  }

  function choose(option: Option) {
    setValue(option.value);
    close();
  }

  function onKeyDown(event: React.KeyboardEvent) {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const step = event.key === "ArrowDown" ? 1 : -1;
      setActive((current) => Math.min(Math.max(current + step, 0), Math.max(shown.length - 1, 0)));
    } else if (event.key === "Enter") {
      event.preventDefault(); // the list is open: Enter picks, it does not submit the search
      if (shown[active]) choose(shown[active]);
    } else if (event.key === "Escape") {
      event.preventDefault();
      close();
    } else if (event.key === "Tab") {
      setOpen(false);
    }
  }

  if (!ready) {
    return (
      <select id={id} name={name} defaultValue="">
        {all.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    );
  }

  return (
    <div ref={root} className="static">
      <input type="hidden" name={name} value={value} />
      <button
        ref={button}
        id={id}
        type="button"
        className="chevron flex min-h-8 w-full cursor-pointer items-center truncate pr-6 text-left text-[0.9375rem] text-muted focus-visible:outline-none"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => (open ? close() : show())}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            show();
          }
        }}
      >
        <span className="truncate">{selected.label}</span>
      </button>
      {open && (
        // Positioned against the field around it, so the list is exactly as wide as the field.
        <div className="absolute top-full right-0 left-0 z-30 mt-2 rounded-[0.875rem] border border-line bg-surface p-1.5 shadow-[0_16px_40px_rgb(23_32_27/14%)]">
          <input
            ref={search}
            type="text"
            role="combobox"
            aria-label={searchLabel}
            aria-expanded="true"
            aria-controls={listId}
            aria-activedescendant={shown[active] ? `${listId}-${active}` : undefined}
            autoComplete="off"
            placeholder={searchLabel}
            className="mb-1.5 min-h-11 w-full rounded-lg border border-border bg-surface px-3 text-[0.9375rem] placeholder:text-muted"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setActive(0);
            }}
            onKeyDown={onKeyDown}
          />
          <ul id={listId} role="listbox" aria-label={searchLabel} className="max-h-64 overflow-y-auto">
            {shown.map((option, index) => (
              <li
                key={option.value}
                id={`${listId}-${index}`}
                role="option"
                aria-selected={option.value === value}
                className={`flex min-h-10 cursor-pointer items-center justify-between gap-3 rounded-lg px-3 py-2 text-[0.9375rem] wrap-anywhere ${
                  option.value === value ? "bg-accent font-semibold text-white" : index === active ? "bg-accent-soft text-text" : "text-text"
                }`}
                onPointerMove={() => setActive(index)}
                onClick={() => choose(option)}
              >
                {option.label}
              </li>
            ))}
          </ul>
          {shown.length === 0 && (
            <p role="status" className="px-3 py-2 text-[0.875rem] text-muted">
              No area matches.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
