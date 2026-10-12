"use client";

import { useState } from "react";
import { saveFile } from "@/lib/download";
import { NoticeBar, button, field, type Notice } from "./action-ui";

const PAPER = ["Letter", "Legal", "A4", "A3"];

/**
 * osTicket's Print (a PDF of the thread, with the internal notes and the event history when asked) and, for a ticket,
 * Export to ZIP (the PDF and every file attached to the thread). Available to every agent who can open the record.
 */
export function FileExports({ kind, id, number }: { kind: "ticket" | "task"; id: number; number: string }) {
  const [paper, setPaper] = useState("");
  const [notes, setNotes] = useState(false);
  const [events, setEvents] = useState(false);
  const [tasks, setTasks] = useState(false);
  const [busy, setBusy] = useState<"print" | "zip" | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const base = `/api/v1/${kind === "ticket" ? "tickets" : "tasks"}/${id}`;
  const label = kind === "ticket" ? "Ticket" : "Task";

  async function download(what: "print" | "zip") {
    setNotice(null);
    setBusy(what);
    const q = new URLSearchParams();
    if (what === "print") {
      if (paper) q.set("paper_size", paper);
      if (kind === "ticket") {
        q.set("notes", String(notes));
        q.set("events", String(events));
      }
    } else {
      q.set("notes", String(notes));
      q.set("tasks", String(tasks));
    }
    try {
      const name = await saveFile(`${base}/${what}?${q}`, what === "print" ? `${label}-${number}.pdf` : `ticket-${number}.zip`);
      setNotice({ kind: "ok", text: `Saved ${name}.` });
    } catch (error) {
      setNotice({ kind: "error", text: error instanceof Error ? error.message : "Request failed" });
    }
    setBusy(null);
  }

  return (
    <section className="mb-3 border border-slate-300 bg-white p-3" aria-label="Print and export">
      <NoticeBar notice={notice} />
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
        <label className="flex items-center gap-1">
          <span className="font-semibold text-slate-700">Paper Size</span>
          <select aria-label="Paper size" value={paper} onChange={(e) => setPaper(e.target.value)} className={`${field} w-auto`}>
            <option value="">My default</option>
            {PAPER.map((p) => (
              <option key={p}>{p}</option>
            ))}
          </select>
        </label>
        {kind === "ticket" && (
          <>
            <label className="flex items-center gap-1">
              <input type="checkbox" checked={notes} onChange={(e) => setNotes(e.target.checked)} /> Print internal notes
            </label>
            <label className="flex items-center gap-1">
              <input type="checkbox" checked={events} onChange={(e) => setEvents(e.target.checked)} /> Print event history
            </label>
            <label className="flex items-center gap-1">
              <input type="checkbox" checked={tasks} onChange={(e) => setTasks(e.target.checked)} /> Include tasks in ZIP
            </label>
          </>
        )}
        <button type="button" className={button} disabled={busy !== null} onClick={() => download("print")}>
          {busy === "print" ? "Preparing…" : "Print"}
        </button>
        {kind === "ticket" && (
          <button type="button" className={button} disabled={busy !== null} onClick={() => download("zip")}>
            {busy === "zip" ? "Preparing…" : "Export to ZIP"}
          </button>
        )}
      </div>
    </section>
  );
}
