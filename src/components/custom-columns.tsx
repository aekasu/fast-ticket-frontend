"use client";

import { useSearchParams } from "next/navigation";
import { type Answer, type FieldDef, CORE_FIELDS, displayValue } from "@/lib/custom-fields";
import { type FormType, useFormDefinition } from "@/lib/queries/forms";

const SHOWABLE = ["info", "break", "files", "thread"];

/**
 * Custom form fields as extra list columns (osTicket's queue columns). The choice is kept in the URL (`cols=a,b`) and the
 * names go to the API's `?fields=` (at most 20), so one extra query per page carries the answers, not one per row.
 */
export function useCustomColumns(form: FormType) {
  const params = useSearchParams();
  const defs = (useFormDefinition(form).data ?? []).filter((d) => d.is_enabled !== false && !CORE_FIELDS[form].includes(d.name) && d.name && !SHOWABLE.includes(d.type));
  const known = new Set(defs.map((d) => d.name));
  const selected = (params.get("cols") ?? "")
    .split(",")
    .filter((n) => known.has(n))
    .slice(0, 20);
  const shown = defs.filter((d) => selected.includes(d.name));
  return {
    defs,
    selected,
    /** The `fields` query value, or undefined when none is chosen. */
    fields: selected.length ? selected.join(",") : undefined,
    headers: shown.map((d) => d.label),
    cells: (answers: Answer[] | null | undefined) => shown.map((d) => {
      const a = answers?.find((x) => x.name === d.name);
      return a ? displayValue(a) : "";
    }),
  };
}

/** A "Columns" menu listing the form's custom fields; ticking one adds it as a column. */
export function ColumnsPicker({ defs, selected, onChange }: { defs: FieldDef[]; selected: string[]; onChange: (names: string[]) => void }) {
  if (defs.length === 0) return null;
  return (
    <details className="relative text-sm">
      <summary className="cursor-pointer rounded border border-slate-300 bg-white px-3 py-1.5 font-medium text-slate-800">Columns{selected.length ? ` (${selected.length})` : ""}</summary>
      <fieldset className="absolute right-0 z-10 mt-1 max-h-72 w-64 space-y-1 overflow-y-auto border border-slate-300 bg-white p-3 shadow" aria-label="Custom field columns">
        {defs.map((d) => (
          <label key={d.name} className="flex items-center gap-2">
            <input type="checkbox" checked={selected.includes(d.name)} onChange={(e) => onChange(e.target.checked ? [...selected, d.name] : selected.filter((n) => n !== d.name))} />
            {d.label}
          </label>
        ))}
      </fieldset>
    </details>
  );
}
