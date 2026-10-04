"use client";

import { useState } from "react";
import type { components } from "@/lib/api/schema";
import { useUserOptions } from "@/lib/queries/directory";
import { useDepartments } from "@/lib/queries/reference";
import { can, useMe } from "@/lib/queries/me";
import { ticketKeys, useAssignees, useTicketList } from "@/lib/queries/tickets";
import { NoticeBar, button, field, primary, useRunner } from "./action-ui";
import { DeleteButton } from "./delete-button";

type Ticket = components["schemas"]["TicketDetail"];
type Panel = "owner" | "collaborators" | "merge" | "refer" | null;

/** osTicket's "More" menu entries about people: Change Owner, Manage Collaborators, and Delete Ticket. */
export function TicketPeopleTools({ ticket }: { ticket: Ticket }) {
  const { data: me } = useMe();
  const { run, busy, notice, clear } = useRunner(`/api/v1/tickets/${ticket.ticket_id}`, ticketKeys.all);
  const [panel, setPanel] = useState<Panel>(null);
  const [userId, setUserId] = useState("");
  const users = useUserOptions(panel === "owner" || panel === "collaborators");
  const [search, setSearch] = useState("");
  const [children, setChildren] = useState<number[]>([]);
  const [target, setTarget] = useState<"agent" | "team" | "dept">("agent");
  const [targetId, setTargetId] = useState("");
  const [referNote, setReferNote] = useState("");
  const candidatesList = useTicketList({ queue: "open", sort: "updated", descending: true, page: 1, page_size: 100 });
  const assignees = useAssignees(ticket.ticket_id, panel === "refer");
  const departments = useDepartments();

  const canEdit = can(me, ticket.dept_id, "ticket.edit");
  const canDelete = can(me, ticket.dept_id, "ticket.delete");
  const canMerge = can(me, ticket.dept_id, "ticket.merge");
  const canRefer = can(me, ticket.dept_id, "ticket.refer");
  if (!canEdit && !canDelete && !canMerge && !canRefer) return null;

  const collaboratorIds = new Set(ticket.collaborators.map((c) => c.user_id));
  const candidates = (users.data ?? []).filter((u) => (panel === "owner" ? u.id !== ticket.user_id : u.id !== ticket.user_id && !collaboratorIds.has(u.id)));
  const label = (u: { name: string; email: string }) => `${u.name} (${u.email})`;

  function toggle(next: Panel) {
    clear();
    setUserId("");
    setChildren([]);
    setTargetId("");
    setPanel(panel === next ? null : next);
  }

  const mergeable = (candidatesList.data?.items ?? []).filter(
    (t) => t.ticket_id !== ticket.ticket_id && (!search.trim() || `${t.number} ${t.subject} ${t.user_name ?? ""}`.toLowerCase().includes(search.trim().toLowerCase())),
  );

  async function merge(e: React.FormEvent) {
    e.preventDefault();
    if (children.length === 0) return;
    if (await run("merge", { child_ids: children }, `${children.length} ticket${children.length === 1 ? "" : "s"} merged into this ticket.`)) {
      setChildren([]);
      setPanel(null);
    }
  }

  async function refer(e: React.FormEvent) {
    e.preventDefault();
    if (!targetId) return;
    const key = target === "agent" ? "agent_id" : target === "team" ? "team_id" : "dept_id";
    const note = referNote.trim() ? { note: referNote.trim() } : {};
    if (await run("refer", { [key]: Number(targetId), ...note }, "Ticket referred.")) {
      setTargetId("");
      setReferNote("");
      setPanel(null);
    }
  }

  async function changeOwner(e: React.FormEvent) {
    e.preventDefault();
    if (!userId) return;
    const name = users.data?.find((u) => String(u.id) === userId)?.name ?? "";
    if (await run("change-owner", { user_id: Number(userId) }, `Ticket owner changed to ${name}.`)) {
      setPanel(null);
      setUserId("");
    }
  }

  async function addCollaborator(e: React.FormEvent) {
    e.preventDefault();
    if (!userId) return;
    const name = users.data?.find((u) => String(u.id) === userId)?.name ?? "";
    if (await run("collaborators", { user_id: Number(userId) }, `${name} added as a collaborator.`)) setUserId("");
  }

  const picker = (
    <select aria-label="User" required value={userId} onChange={(e) => setUserId(e.target.value)} className={field}>
      <option value="">— Select a user —</option>
      {candidates.map((u) => (
        <option key={u.id} value={u.id}>
          {label(u)}
        </option>
      ))}
    </select>
  );
  const noDirectory = users.data === null && !users.isLoading && (
    <p className="text-sm text-amber-800">Your account cannot list users (it needs the user directory permission), so people cannot be picked here.</p>
  );

  return (
    <div className="mb-4">
      <div className="flex flex-wrap items-start gap-2">
        {canEdit && (
          <>
            <button type="button" className={button} onClick={() => toggle("owner")} aria-expanded={panel === "owner"}>
              Change Owner
            </button>
            <button type="button" className={button} onClick={() => toggle("collaborators")} aria-expanded={panel === "collaborators"}>
              Manage Collaborators ({ticket.collaborators.length})
            </button>
          </>
        )}
        {canMerge && (
          <button type="button" className={button} onClick={() => toggle("merge")} aria-expanded={panel === "merge"}>
            Merge Tickets
          </button>
        )}
        {canRefer && (
          <button type="button" className={button} onClick={() => toggle("refer")} aria-expanded={panel === "refer"}>
            Refer
          </button>
        )}
        {canDelete && <DeleteButton noun="ticket" path={`/api/v1/tickets/${ticket.ticket_id}`} redirectTo="/tickets" invalidate={ticketKeys.all} />}
      </div>

      <div className="mt-3">
        <NoticeBar notice={notice} />
      </div>

      {panel === "owner" && (
        <form onSubmit={changeOwner} className="mt-3 max-w-xl space-y-3 border border-slate-300 bg-white p-4">
          <h3 className="text-sm font-semibold text-slate-800">Change Owner</h3>
          <p className="text-sm text-slate-600">
            Current owner: <strong>{ticket.user_name}</strong>
          </p>
          {noDirectory || picker}
          <div className="flex gap-2">
            <button type="submit" className={primary} disabled={busy || !userId}>
              {busy ? "Working…" : "Change Owner"}
            </button>
            <button type="button" className={button} onClick={() => setPanel(null)}>
              Cancel
            </button>
          </div>
        </form>
      )}

      {panel === "merge" && (
        <form onSubmit={merge} className="mt-3 max-w-2xl space-y-3 border border-slate-300 bg-white p-4" aria-label="Merge tickets">
          <h3 className="text-sm font-semibold text-slate-800">Merge Tickets into #{ticket.number}</h3>
          <p className="text-sm text-slate-600">The tickets you select are merged into this one and no longer appear in the queues.</p>
          <input type="search" aria-label="Find tickets" placeholder="Filter by number, subject or user" value={search} onChange={(e) => setSearch(e.target.value)} className={field} />
          <ul className="max-h-64 overflow-y-auto border border-slate-200 text-sm">
            {mergeable.map((t) => (
              <li key={t.ticket_id} className="border-b border-slate-100 last:border-b-0">
                <label className="flex cursor-pointer items-center gap-2 px-2 py-1.5 hover:bg-sky-50">
                  <input
                    type="checkbox"
                    checked={children.includes(t.ticket_id)}
                    onChange={(e) => setChildren((c) => (e.target.checked ? [...c, t.ticket_id] : c.filter((id) => id !== t.ticket_id)))}
                  />
                  <span className="font-medium">#{t.number}</span> <span>{t.subject}</span> <span className="text-slate-500">· {t.user_name}</span>
                </label>
              </li>
            ))}
            {candidatesList.data && mergeable.length === 0 && <li className="px-2 py-3 text-center text-slate-500">No open tickets to merge.</li>}
          </ul>
          <p className="text-xs text-slate-500">The 100 most recently updated open tickets are listed.</p>
          <div className="flex gap-2">
            <button type="submit" className={primary} disabled={busy || children.length === 0}>
              {busy ? "Working…" : `Merge ${children.length || ""} ticket${children.length === 1 ? "" : "s"}`.replace("  ", " ")}
            </button>
            <button type="button" className={button} onClick={() => setPanel(null)}>
              Cancel
            </button>
          </div>
        </form>
      )}

      {panel === "refer" && (
        <form onSubmit={refer} className="mt-3 max-w-xl space-y-3 border border-slate-300 bg-white p-4" aria-label="Refer ticket">
          <h3 className="text-sm font-semibold text-slate-800">Refer Ticket</h3>
          <div className="flex gap-4 text-sm">
            {(["agent", "team", "dept"] as const).map((k) => (
              <label key={k} className="flex items-center gap-1">
                <input
                  type="radio"
                  name="refer-kind"
                  checked={target === k}
                  onChange={() => {
                    setTarget(k);
                    setTargetId("");
                  }}
                />
                {k === "agent" ? "Agent" : k === "team" ? "Team" : "Department"}
              </label>
            ))}
          </div>
          <select aria-label="Refer to" required value={targetId} onChange={(e) => setTargetId(e.target.value)} className={field}>
            <option value="">— Select —</option>
            {(target === "agent" ? (assignees.data?.agents ?? []).map((a) => ({ id: a.id, name: a.name })) : target === "team" ? (assignees.data?.teams ?? []).map((t) => ({ id: t.id, name: t.name })) : (departments.data ?? []).map((d) => ({ id: d.id, name: d.name }))).map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>
          <textarea aria-label="Comments" rows={3} value={referNote} onChange={(e) => setReferNote(e.target.value)} placeholder="Comments (optional)" className={field} />
          <p className="text-xs text-slate-500">Referrals can be created but not listed or removed through the API yet.</p>
          <div className="flex gap-2">
            <button type="submit" className={primary} disabled={busy || !targetId}>
              {busy ? "Working…" : "Refer"}
            </button>
            <button type="button" className={button} onClick={() => setPanel(null)}>
              Cancel
            </button>
          </div>
        </form>
      )}

      {panel === "collaborators" && (
        <section className="mt-3 max-w-2xl space-y-3 border border-slate-300 bg-white p-4" aria-label="Collaborators">
          <h3 className="text-sm font-semibold text-slate-800">Collaborators</h3>
          <table className="w-full text-left text-sm">
            <thead className="text-xs uppercase tracking-wide text-slate-600">
              <tr>
                <th className="py-1 pr-3 font-semibold">Collaborator</th>
                <th className="py-1 pr-3 font-semibold">Alerts</th>
                <th className="py-1 pr-3 font-semibold">Active</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {ticket.collaborators.map((c) => (
                <tr key={c.user_id} className="border-t border-slate-200">
                  <td className="py-1.5 pr-3">
                    {c.name} <span className="text-slate-500">&lt;{c.email}&gt;</span>
                  </td>
                  <td className="py-1.5 pr-3">
                    <input
                      type="checkbox"
                      aria-label={`Send alerts to ${c.name}`}
                      checked={c.is_cc}
                      disabled={busy}
                      onChange={(e) => run(`collaborators/${c.user_id}`, { is_cc: e.target.checked }, `${c.name} ${e.target.checked ? "will receive alerts" : "will not receive alerts"}.`, "PATCH")}
                    />
                  </td>
                  <td className="py-1.5 pr-3">
                    <input
                      type="checkbox"
                      aria-label={`${c.name} is active`}
                      checked={c.is_active}
                      disabled={busy}
                      onChange={(e) => run(`collaborators/${c.user_id}`, { is_active: e.target.checked }, `${c.name} is now ${e.target.checked ? "active" : "disabled"}.`, "PATCH")}
                    />
                  </td>
                  <td className="py-1.5 text-right">
                    <button type="button" disabled={busy} className="text-red-800 underline disabled:opacity-50" onClick={() => run(`collaborators/${c.user_id}`, {}, `${c.name} removed.`, "DELETE")}>
                      Remove {c.name}
                    </button>
                  </td>
                </tr>
              ))}
              {ticket.collaborators.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-3 text-center text-slate-500">
                    No collaborators.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          {noDirectory || (
            <form onSubmit={addCollaborator} className="flex flex-wrap items-center gap-2 border-t border-slate-200 pt-3">
              <div className="min-w-64 flex-1">{picker}</div>
              <button type="submit" className={primary} disabled={busy || !userId}>
                Add Collaborator
              </button>
            </form>
          )}
          <button type="button" className={button} onClick={() => setPanel(null)}>
            Close
          </button>
        </section>
      )}
    </div>
  );
}
