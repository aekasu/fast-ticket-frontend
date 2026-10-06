"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { components } from "@/lib/api/schema";
import { runMany, summarize } from "@/lib/bulk";
import { useAgentDirectory } from "@/lib/queries/admin-lookups";
import { runCommand } from "@/lib/queries/commands";
import { can, useMe } from "@/lib/queries/me";
import { useDepartments } from "@/lib/queries/reference";
import { ticketKeys } from "@/lib/queries/tickets";
import { NoticeBar, button, field, primary } from "./action-ui";

type Item = components["schemas"]["TicketListItem"];
type Action = "close" | "reopen" | "assign" | "transfer" | "delete";

const LABEL: Record<Action, string> = { close: "Close", reopen: "Reopen", assign: "Assign", transfer: "Transfer", delete: "Delete" };
const PERMISSION: Record<Action, string> = { close: "ticket.close", reopen: "ticket.close", assign: "ticket.assign", transfer: "ticket.transfer", delete: "ticket.delete" };

/**
 * osTicket's mass actions on the ticked rows. The server decides per ticket (a refusal is reported with its reason);
 * the buttons only appear for what the agent's role could do on at least one ticked ticket.
 */
export function TicketMassActions({ items, onDone }: { items: Item[]; onDone: () => void }) {
  const { data: me } = useMe();
  const queryClient = useQueryClient();
  const agents = useAgentDirectory();
  const departments = useDepartments();
  const [panel, setPanel] = useState<Action | null>(null);
  const [target, setTarget] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  // After an action the rows are unticked (or gone), but its answer stays until the next selection.
  if (items.length === 0 && !notice) return null;

  const allowed = (Object.keys(LABEL) as Action[]).filter((a) => items.some((t) => can(me, t.dept_id, PERMISSION[a])));
  const numberOf = (id: number) => items.find((t) => t.ticket_id === id)?.number ?? String(id);

  async function apply(action: Action) {
    setBusy(true);
    setNotice(null);
    const request = (id: number) => {
      const key = crypto.randomUUID();
      if (action === "assign") return runCommand({ method: "POST", path: `/api/v1/tickets/${id}/assign`, body: { staff_id: Number(target) }, key });
      if (action === "transfer") return runCommand({ method: "POST", path: `/api/v1/tickets/${id}/transfer`, body: { dept_id: Number(target) }, key });
      if (action === "delete") return runCommand({ method: "DELETE", path: `/api/v1/tickets/${id}`, key });
      return runCommand({ method: "POST", path: `/api/v1/tickets/${id}/${action}`, body: {}, key });
    };
    const result = await runMany(items.map((t) => t.ticket_id), request);
    const verb = { close: "Closed", reopen: "Reopened", assign: "Assigned", transfer: "Transferred", delete: "Deleted" }[action];
    setNotice({ kind: result.failed.length ? "error" : "ok", text: summarize(verb, result, numberOf) });
    await queryClient.invalidateQueries({ queryKey: ticketKeys.all });
    setBusy(false);
    setPanel(null);
    setTarget("");
    if (result.done > 0) onDone();
  }

  return (
    <section aria-label="Mass actions" className="mb-3 border border-slate-300 bg-white p-3">
      <div className="flex flex-wrap items-center gap-2">
        {items.length > 0 && <span className="text-sm font-semibold text-slate-700">{items.length} selected</span>}
        {(items.length > 0 ? allowed : []).map((a) => (
          <button key={a} type="button" disabled={busy} aria-expanded={panel === a} className={button} onClick={() => { setNotice(null); setTarget(""); setPanel(panel === a ? null : a); }}>
            {LABEL[a]}
          </button>
        ))}
      </div>
      {panel && items.length > 0 && (
        <form
          className="mt-3 flex flex-wrap items-center gap-2"
          aria-label={`${LABEL[panel]} the selected tickets`}
          onSubmit={(e) => {
            e.preventDefault();
            void apply(panel);
          }}
        >
          {panel === "assign" && (
            <select aria-label="Assign to" required value={target} onChange={(e) => setTarget(e.target.value)} className={`${field} max-w-xs`}>
              <option value="">— Select an agent —</option>
              {agents.data?.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          )}
          {panel === "transfer" && (
            <select aria-label="Department" required value={target} onChange={(e) => setTarget(e.target.value)} className={`${field} max-w-xs`}>
              <option value="">— Select a department —</option>
              {departments.data?.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          )}
          {panel === "delete" && <span className="text-sm text-red-800">This permanently deletes {items.length} ticket{items.length === 1 ? "" : "s"}.</span>}
          <button type="submit" disabled={busy} className={primary}>
            {busy ? "Working…" : `${LABEL[panel]} ${items.length} ticket${items.length === 1 ? "" : "s"}`}
          </button>
        </form>
      )}
      <div className="mt-2">
        <NoticeBar notice={notice} />
      </div>
    </section>
  );
}
