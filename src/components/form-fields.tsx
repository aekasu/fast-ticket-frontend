"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { parseChoices } from "@/lib/custom-fields";
import { NoticeBar, button, field, primary, useRunner } from "./action-ui";

interface FormField {
  id: number;
  name: string;
  label: string;
  type: string;
  mode?: string | null;
  hint?: string | null;
  sort?: number;
  is_required?: boolean;
  is_enabled?: boolean;
  is_deletable?: boolean;
  is_name_locked?: boolean;
  is_type_locked?: boolean;
  configuration?: Record<string, unknown> | null;
}

// The field types the API documents for a new field, with osTicket's names for them.
const TYPES: { value: string; label: string }[] = [
  { value: "text", label: "Short Answer" },
  { value: "memo", label: "Long Answer" },
  { value: "choices", label: "Selection List" },
  { value: "bool", label: "Checkbox" },
  { value: "datetime", label: "Date and Time" },
  { value: "phone", label: "Phone Number" },
  { value: "info", label: "Section Break (information)" },
  { value: "break", label: "Divider" },
];

const MODES: { value: string; label: string }[] = [
  { value: "optional", label: "Optional" },
  { value: "required", label: "Required" },
  { value: "required_for_users", label: "Required for end users" },
  { value: "required_for_agents", label: "Required for agents" },
  { value: "internal_optional", label: "Internal, optional" },
  { value: "internal_required", label: "Internal, required" },
  { value: "users_only", label: "End users only" },
];

type Panel = { kind: "add" } | { kind: "edit"; field: FormField } | null;

/** A form's fields, with add, edit and remove. Locked fields (a core form's own) cannot be renamed, retyped or removed. */
export function FormFieldsAdmin({ formId, fields }: { formId: number; fields: FormField[] }) {
  const queryClient = useQueryClient();
  const { run, busy, notice, clear } = useRunner(`/api/v1/forms/${formId}`, ["admin", "forms"]);
  const [panel, setPanel] = useState<Panel>(null);
  const [type, setType] = useState("text");
  const [removing, setRemoving] = useState<FormField | null>(null);
  const [deleteData, setDeleteData] = useState(false);

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["forms"] });

  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!panel) return;
    const form = new FormData(e.currentTarget);
    const text = (name: string) => String(form.get(name) ?? "").trim();
    const choices = text("choices");
    const configuration: Record<string, unknown> = {};
    if ((panel.kind === "add" ? type : panel.field.type) === "choices") {
      configuration.choices = choices;
      configuration.multiselect = form.get("multiselect") === "on";
    }

    if (panel.kind === "add") {
      const body: Record<string, unknown> = { label: text("label"), type, mode: text("mode") || "optional" };
      if (text("name")) body.name = text("name");
      if (text("hint")) body.hint = text("hint");
      if (Object.keys(configuration).length) body.configuration = configuration;
      if (await run("fields", body, `Field "${text("label")}" added.`, "POST")) {
        setPanel(null);
        refresh();
      }
      return;
    }

    const f = panel.field;
    const body: Record<string, unknown> = {};
    if (text("label") !== f.label) body.label = text("label");
    if (!f.is_name_locked && text("name") !== f.name) body.name = text("name");
    if (text("hint") !== (f.hint ?? "")) body.hint = text("hint");
    if (text("mode") && text("mode") !== (f.mode ?? "")) body.mode = text("mode");
    if ((form.get("enabled") === "on") !== (f.is_enabled !== false)) body.is_enabled = form.get("enabled") === "on";
    if (text("sort") !== "" && Number(text("sort")) !== (f.sort ?? 0)) body.sort = Number(text("sort"));
    if (Object.keys(configuration).length) {
      const before = f.configuration ?? {};
      if (configuration.choices !== (before.choices ?? "") || configuration.multiselect !== Boolean(before.multiselect)) body.configuration = configuration;
    }
    if (Object.keys(body).length === 0) {
      clear();
      return;
    }
    if (await run(`fields/${f.id}`, body, `Field "${text("label")}" updated.`, "PATCH")) {
      setPanel(null);
      refresh();
    }
  }

  async function remove(f: FormField) {
    if (await run(`fields/${f.id}${deleteData ? "?delete_data=true" : ""}`, {}, `Field "${f.label}" removed.`, "DELETE")) {
      setRemoving(null);
      setDeleteData(false);
      refresh();
    }
  }

  const editing = panel?.kind === "edit" ? panel.field : null;
  const activeType = panel?.kind === "add" ? type : (editing?.type ?? "text");
  const modeLabel = (m?: string | null) => MODES.find((x) => x.value === m)?.label ?? (m ?? "—");
  const typeLabel = (t: string) => TYPES.find((x) => x.value === t)?.label ?? t;

  return (
    <section className="mt-6" aria-label="Form fields">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2 border-b border-slate-300 pb-1">
        <h2 className="text-sm font-semibold text-slate-800">Fields ({fields.length})</h2>
        <button
          type="button"
          className={button}
          onClick={() => {
            clear();
            setType("text");
            setPanel(panel?.kind === "add" ? null : { kind: "add" });
          }}
          aria-expanded={panel?.kind === "add"}
        >
          Add Field
        </button>
      </div>
      <NoticeBar notice={notice} />
      <table className="w-full border border-slate-300 bg-white text-left text-sm">
        <thead className="bg-slate-100 text-xs uppercase tracking-wide text-slate-600">
          <tr>
            {["Label", "Variable", "Type", "Visibility", "Enabled", ""].map((h) => (
              <th key={h || "actions"} className="px-3 py-2 font-semibold">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {fields.map((f) => (
            <tr key={f.id} className="border-t border-slate-200">
              <td className="px-3 py-2">{f.label}</td>
              <td className="px-3 py-2 font-mono text-xs">{f.name}</td>
              <td className="px-3 py-2">{typeLabel(f.type)}</td>
              <td className="px-3 py-2">{modeLabel(f.mode)}</td>
              <td className="px-3 py-2">{f.is_enabled === false ? "No" : "Yes"}</td>
              <td className="whitespace-nowrap px-3 py-2 text-right">
                <button type="button" className="text-sky-800 underline" onClick={() => { clear(); setPanel({ kind: "edit", field: f }); }}>
                  Edit {f.label}
                </button>
                {f.is_deletable !== false && (
                  <button type="button" className="ml-3 text-red-800 underline" onClick={() => { clear(); setRemoving(f); setDeleteData(false); }}>
                    Remove {f.label}
                  </button>
                )}
              </td>
            </tr>
          ))}
          {fields.length === 0 && (
            <tr>
              <td colSpan={6} className="px-3 py-4 text-center text-slate-500">
                This form has no fields yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {removing && (
        <div className="mt-3 max-w-xl space-y-3 border border-red-300 bg-red-50 p-4 text-sm">
          <p>
            Remove the field <strong>{removing.label}</strong>?
          </p>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={deleteData} onChange={(e) => setDeleteData(e.target.checked)} /> Also delete the answers already given to it
          </label>
          <div className="flex gap-2">
            <button type="button" disabled={busy} onClick={() => remove(removing)} className="rounded bg-red-700 px-4 py-1.5 text-sm font-semibold text-white hover:bg-red-800 disabled:opacity-60">
              {busy ? "Removing…" : "Remove field"}
            </button>
            <button type="button" className={button} onClick={() => setRemoving(null)}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {panel && (
        <form key={editing?.id ?? "add"} onSubmit={save} className="mt-3 max-w-xl space-y-3 border border-slate-300 bg-white p-4" aria-label={panel.kind === "add" ? "Add field" : "Edit field"}>
          <h3 className="text-sm font-semibold text-slate-800">{panel.kind === "add" ? "Add Field" : `Edit ${editing?.label}`}</h3>
          <input name="label" aria-label="Label" required placeholder="Label" defaultValue={editing?.label ?? ""} maxLength={255} className={field} />
          <input name="name" aria-label="Variable" placeholder="Variable (letters, digits, _ and -)" defaultValue={editing?.name ?? ""} disabled={editing?.is_name_locked} maxLength={64} className={field} />
          {panel.kind === "add" ? (
            <select aria-label="Type" value={type} onChange={(e) => setType(e.target.value)} className={field}>
              {TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          ) : (
            <p className="text-sm text-slate-600">
              Type: <strong>{typeLabel(editing?.type ?? "")}</strong> (a field&apos;s type cannot be changed here)
            </p>
          )}
          <select name="mode" aria-label="Visibility" defaultValue={editing?.mode ?? "optional"} className={field}>
            {MODES.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
          <input name="hint" aria-label="Hint" placeholder="Hint shown with the field (optional)" defaultValue={editing?.hint ?? ""} maxLength={512} className={field} />
          {activeType === "choices" && (
            <>
              <textarea
                name="choices"
                aria-label="Choices"
                rows={5}
                placeholder={"One per line, as key:Label\na:Alpha\nb:Beta"}
                defaultValue={typeof editing?.configuration?.choices === "string" ? editing.configuration.choices : ""}
                className={`${field} font-mono`}
              />
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="multiselect" defaultChecked={Boolean(editing?.configuration?.multiselect)} /> Allow more than one choice
              </label>
              <p className="text-xs text-slate-500">{parseChoices({ choices: editing?.configuration?.choices }).length > 0 ? "" : "Each line is key:Label; a line without a colon is both."}</p>
            </>
          )}
          {panel.kind === "edit" && (
            <>
              <input name="sort" aria-label="Order" type="number" min={0} placeholder="Order" defaultValue={editing?.sort ?? 0} className={field} />
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="enabled" defaultChecked={editing?.is_enabled !== false} /> Field is enabled
              </label>
            </>
          )}
          <div className="flex gap-2">
            <button type="submit" className={primary} disabled={busy}>
              {busy ? "Saving…" : panel.kind === "add" ? "Add Field" : "Save Field"}
            </button>
            <button type="button" className={button} onClick={() => setPanel(null)}>
              Cancel
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
