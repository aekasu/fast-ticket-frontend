"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { CommandFailed, runCommand, useActionKey } from "@/lib/queries/commands";
import { directoryKeys } from "@/lib/queries/directory";
import { button, field, primary } from "./action-ui";

/**
 * osTicket's Import dialog for the user directory: a CSV file (a header row naming user-form fields), or pasted
 * "name, email" lines. All-or-nothing: the first bad row refuses the whole import, and osTicket's reason is shown.
 */
export function UserImport() {
  const queryClient = useQueryClient();
  const key = useActionKey();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"file" | "paste">("paste");
  const [pasted, setPasted] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const csv = mode === "paste" ? pasted : file ? await file.text() : "";
    if (!csv.trim()) return;
    setBusy(true);
    setNotice(null);
    try {
      const result = await runCommand({ method: "POST", path: "/api/v1/users/import", body: { csv, pasted: mode === "paste" }, key: key.current() });
      key.renew();
      const n = Number(result.imported ?? 0);
      setNotice({ kind: "ok", text: `Imported ${n} user${n === 1 ? "" : "s"}.` });
      setPasted("");
      setFile(null);
      await queryClient.invalidateQueries({ queryKey: directoryKeys.users });
    } catch (error) {
      if (error instanceof CommandFailed) key.renew();
      setNotice({ kind: "error", text: error instanceof Error ? error.message : "Request failed" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <button type="button" className={button} aria-expanded={open} onClick={() => setOpen(!open)}>
        Import
      </button>
      {open && (
        <form onSubmit={submit} aria-label="Import users" className="mt-3 max-w-xl space-y-3 border border-slate-300 bg-white p-4">
          <h3 className="text-sm font-semibold text-slate-800">Import Users</h3>
          <div className="flex gap-4 text-sm">
            <label className="flex items-center gap-1">
              <input type="radio" name="import-mode" checked={mode === "paste"} onChange={() => setMode("paste")} /> Paste name, email lines
            </label>
            <label className="flex items-center gap-1">
              <input type="radio" name="import-mode" checked={mode === "file"} onChange={() => setMode("file")} /> Upload a CSV file
            </label>
          </div>
          {mode === "paste" ? (
            <textarea aria-label="Users to import" rows={6} value={pasted} onChange={(e) => setPasted(e.target.value)} placeholder={"Ada Lovelace, ada@example.com\nAlan Turing, alan@example.com"} className={field} />
          ) : (
            <div className="space-y-1">
              <input type="file" accept=".csv,text/csv" aria-label="CSV file" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
              <p className="text-xs text-slate-500">The first row names the user-form fields (name, email, phone, …). Up to 1 MB.</p>
            </div>
          )}
          {notice && (
            <p role={notice.kind === "error" ? "alert" : "status"} className={`border px-3 py-2 text-sm ${notice.kind === "error" ? "border-red-300 bg-red-50 text-red-800" : "border-emerald-300 bg-emerald-50 text-emerald-800"}`}>
              {notice.text}
            </p>
          )}
          <div className="flex gap-2">
            <button type="submit" disabled={busy || (mode === "paste" ? !pasted.trim() : !file)} className={primary}>
              {busy ? "Importing…" : "Import"}
            </button>
            <button type="button" className={button} onClick={() => setOpen(false)}>
              Close
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
