"use client";

import { type Answer, type FieldDef, chosenKeys, displayValue, isListType, parseChoices } from "@/lib/custom-fields";
import type { FormType } from "@/lib/queries/forms";
import { field } from "./action-ui";
import { Info } from "./info-table";

/** An entity's custom field answers, read-only, in osTicket's label / value table. */
export function CustomFieldsView({ answers }: { answers: Answer[] | undefined; form?: FormType }) {
  if (!answers || answers.length === 0) return null;
  return (
    <section className="mt-4 max-w-2xl" aria-label="Custom fields">
      <h2 className="mb-1 text-sm font-semibold text-slate-800">Custom Fields</h2>
      <Info rows={answers.map((a): [string, React.ReactNode] => [a.label, <span key={a.name} className="whitespace-pre-wrap">{displayValue(a)}</span>])} />
    </section>
  );
}

/** Inputs for the custom fields of a form, named `cf:<variable>` so `collectCustomFields` can read them back. */
export function CustomFieldInputs({ defs, answers }: { defs: FieldDef[]; answers?: Answer[] }) {
  if (defs.length === 0) return null;
  return (
    <>
      {defs.map((def) => {
        const answer = answers?.find((a) => a.name === def.name);
        const name = `cf:${def.name}`;
        const required = def.is_required === true;
        const label = (
          <span className="pt-1.5 text-sm font-semibold text-slate-700">
            {def.label}
            {required && <span className="text-red-700"> *</span>}
          </span>
        );
        let input: React.ReactNode;
        if (def.type === "bool") {
          input = (
            <label className="flex items-center gap-2 pt-1.5 text-sm">
              <input type="checkbox" name={name} defaultChecked={answer?.bool_value === true} aria-label={def.label} />
              {def.hint}
            </label>
          );
        } else if (def.type === "memo") {
          input = <textarea name={name} aria-label={def.label} rows={4} defaultValue={answer?.value ?? ""} className={field} />;
        } else if (def.type === "choices" || isListType(def.type)) {
          const choices = parseChoices(def.configuration, def);
          const selected = chosenKeys(answer);
          input = def.configuration?.multiselect ? (
            <fieldset className="space-y-1 pt-1.5" aria-label={def.label}>
              {choices.map((c) => (
                <label key={c.key} className="flex items-center gap-2 text-sm">
                  <input type="checkbox" name={name} value={c.key} defaultChecked={selected.includes(c.key)} />
                  {c.label}
                </label>
              ))}
            </fieldset>
          ) : (
            <select name={name} aria-label={def.label} defaultValue={selected[0] ?? ""} className={field}>
              <option value="">— Select —</option>
              {choices.map((c) => (
                <option key={c.key} value={c.key}>
                  {c.label}
                </option>
              ))}
            </select>
          );
        } else if (def.type === "datetime") {
          input = <input type="datetime-local" name={name} aria-label={def.label} defaultValue={(answer?.value ?? "").replace(" ", "T").slice(0, 16)} className={field} />;
        } else {
          input = <input type="text" name={name} aria-label={def.label} defaultValue={answer?.value ?? ""} className={field} autoComplete="off" />;
        }
        return (
          // A div, not a label: a multiple-choice field holds labelled checkboxes, and every input has its own aria-label.
          <div key={def.name} className="grid items-start gap-1 sm:grid-cols-[11rem_1fr]">
            {label}
            <div>
              {input}
              {def.hint && def.type !== "bool" && <p className="mt-1 text-xs text-slate-500">{def.hint}</p>}
            </div>
          </div>
        );
      })}
    </>
  );
}
