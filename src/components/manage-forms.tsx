"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { getJson } from "@/lib/api/raw";
import { CommandFailed, runCommand, useActionKey } from "@/lib/queries/commands";
import { NoticeBar, button, field, primary, type Notice } from "./action-ui";

interface Entry {
  entry_id: number;
  form_id: number;
  title: string;
  kind: "built_in" | "extra";
}
interface Available {
  form_id: number;
  title: string;
}

/**
 * osTicket's "Manage Forms" dialog on a ticket, user or organization: the extra forms it carries, in order, and the
 * ones that can still be added. The API takes the whole ordered list; a form left out is removed with its answers, so
 * the dialog says so before saving, as osTicket does.
 */
export function ManageForms({ base, invalidate }: { base: string; invalidate: readonly unknown[] }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className={button} aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        Manage Forms
      </button>
      {open && <Panel base={base} invalidate={invalidate} onClose={() => setOpen(false)} />}
    </>
  );
}

function Panel({ base, invalidate, onClose }: { base: string; invalidate: readonly unknown[]; onClose: () => void }) {
  const queryClient = useQueryClient();
  const key = useActionKey();
  const [notice, setNotice] = useState<Notice | null>(null);
  const [busy, setBusy] = useState(false);
  const [order, setOrder] = useState<Entry[] | null>(null);
  const [adding, setAdding] = useState("");
  const loaded = useQuery({
    queryKey: ["object-forms", base],
    queryFn: async () => {
      const data = await getJson<{ forms: Entry[]; available: Available[] }>(`${base}/forms`);
      setOrder(data.forms);
      return data;
    },
    refetchOnWindowFocus: false,
  });
  if (loaded.isLoading || !order) return <p className="basis-full text-sm text-slate-500">Loading…</p>;
  if (!loaded.data) return <p role="alert" className="basis-full text-sm text-red-700">{loaded.error?.message ?? "Unable to load the forms."}</p>;

  const original = loaded.data.forms;
  const removed = original.filter((f) => !order.some((o) => o.form_id === f.form_id));
  const addable = [...loaded.data.available, ...removed.map((f) => ({ form_id: f.form_id, title: f.title }))].filter((a) => !order.some((o) => o.form_id === a.form_id));
  const changed = JSON.stringify(order.map((o) => o.form_id)) !== JSON.stringify(original.map((o) => o.form_id));

  function move(index: number, by: -1 | 1) {
    const next = [...order!];
    [next[index], next[index + by]] = [next[index + by], next[index]];
    setNotice(null);
    setOrder(next);
  }

  function add() {
    const found = addable.find((a) => String(a.form_id) === adding);
    if (!found) return;
    setNotice(null);
    setOrder([...order!, { entry_id: 0, form_id: found.form_id, title: found.title, kind: "extra" }]);
    setAdding("");
  }

  async function save() {
    setNotice(null);
    setBusy(true);
    try {
      await runCommand({ method: "PUT", path: `${base}/forms`, body: { form_ids: order!.map((o) => o.form_id) }, key: key.current() });
      key.renew();
      await Promise.all([...invalidate.map((k) => queryClient.invalidateQueries({ queryKey: [k] })), queryClient.invalidateQueries({ queryKey: ["object-forms", base] })]);
      setNotice({ kind: "ok", text: "Successfully updated forms." });
    } catch (e) {
      if (e instanceof CommandFailed) key.renew();
      setNotice({ kind: "error", text: e instanceof Error ? e.message : "Request failed" });
    }
    setBusy(false);
  }

  return (
    <section className="basis-full border border-slate-300 bg-white p-3" aria-label="Manage forms">
      <NoticeBar notice={notice} />
      <ol className="mb-3 space-y-1 text-sm">
        {order.map((f, i) => (
          <li key={f.form_id} className="flex items-center gap-2">
            <span className="font-medium">{f.title}</span>
            {f.kind === "built_in" ? (
              <span className="text-xs text-slate-500">(built in)</span>
            ) : (
              <>
                <button type="button" className={button} disabled={i === 0 || order[i - 1].kind === "built_in"} aria-label={`Move ${f.title} up`} onClick={() => move(i, -1)}>
                  ↑
                </button>
                <button type="button" className={button} disabled={i === order.length - 1} aria-label={`Move ${f.title} down`} onClick={() => move(i, 1)}>
                  ↓
                </button>
                <button type="button" className={button} aria-label={`Remove ${f.title}`} onClick={() => {
                    setNotice(null);
                    setOrder(order.filter((o) => o.form_id !== f.form_id));
                  }}>
                  Remove
                </button>
              </>
            )}
          </li>
        ))}
      </ol>
      {removed.length > 0 && (
        <p role="status" className="mb-3 border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          Removing {removed.map((f) => f.title).join(", ")} deletes the answers given to {removed.length === 1 ? "it" : "them"}.
        </p>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <select aria-label="Add a form" value={adding} onChange={(e) => setAdding(e.target.value)} className={`${field} w-auto`} disabled={addable.length === 0}>
          <option value="">{addable.length === 0 ? "No more forms to add" : "— Add a form —"}</option>
          {addable.map((a) => (
            <option key={a.form_id} value={a.form_id}>
              {a.title}
            </option>
          ))}
        </select>
        <button type="button" className={button} disabled={!adding} onClick={add}>
          Add
        </button>
        <button type="button" className={primary} disabled={busy || !changed} onClick={save}>
          {busy ? "Saving…" : "Save Changes"}
        </button>
        <button type="button" className={button} onClick={onClose}>
          Close
        </button>
      </div>
    </section>
  );
}
