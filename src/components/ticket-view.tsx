"use client";

import Link from "next/link";
import { ApiError } from "@/lib/api/errors";
import { formatDateTime } from "@/lib/format";
import { useTicket, useTicketOwner } from "@/lib/queries/tickets";
import { SafeHtml } from "./safe-html";
import { TicketReplyBox, TicketToolbar } from "./ticket-actions";

const ENTRY_STYLE: Record<string, { label: string; box: string }> = {
  M: { label: "Message", box: "border-sky-200 bg-sky-50" },
  R: { label: "Response", box: "border-emerald-200 bg-emerald-50" },
  N: { label: "Internal Note", box: "border-amber-200 bg-amber-50" },
  E: { label: "Event", box: "border-slate-200 bg-slate-50" },
};

function size(bytes: number) {
  return bytes < 1024 ? `${bytes} B` : bytes < 1024 * 1024 ? `${(bytes / 1024).toFixed(1)} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function Info({ rows }: { rows: [string, React.ReactNode][] }) {
  return (
    <table className="w-full border border-slate-300 bg-white text-sm">
      <tbody>
        {rows.map(([label, value]) => (
          <tr key={label} className="border-t border-slate-200 first:border-t-0">
            <th className="w-40 bg-slate-100 px-3 py-1.5 text-left font-semibold text-slate-700">{label}:</th>
            <td className="px-3 py-1.5">{value}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function TicketView({ id }: { id: number }) {
  const { data: ticket, error, isLoading } = useTicket(id);
  const { data: owner } = useTicketOwner(ticket?.user_id);

  if (isLoading) return <p className="text-sm text-slate-500">Loading…</p>;
  if (error instanceof ApiError && error.status === 404) {
    // osTicket answers a ticket the agent may not open with "not found"; so does the API.
    return (
      <div>
        <p role="alert" className="mb-3 border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800">
          Unknown or invalid ticket ID.
        </p>
        <Link href="/tickets" className="text-sm text-sky-800 underline">
          Back to tickets
        </Link>
      </div>
    );
  }
  if (error || !ticket) return <p role="alert" className="text-sm text-red-700">{error?.message ?? "Unable to load the ticket."}</p>;

  const entries = ticket.thread;
  const lastOf = (type: string) => [...entries].reverse().find((e) => e.type === type)?.created;
  const assignee = [ticket.assignee_name, ticket.team_name].filter(Boolean).join(" / ");
  const posts = entries.filter((e) => e.type !== "E");

  return (
    <div>
      <p className="mb-2 text-sm">
        <Link href="/tickets" className="text-sky-800 hover:underline">
          ← Tickets
        </Link>
      </p>
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-xl font-bold text-slate-800">
          Ticket #{ticket.number} <span className="ml-2 text-base font-normal text-slate-600">{ticket.subject}</span>
        </h1>
      </div>

      <TicketToolbar ticket={ticket} />

      <div className="mb-4 grid gap-4 lg:grid-cols-2">
        <div className="space-y-4">
          <Info
            rows={[
              ["Status", ticket.status.name],
              ["Priority", ticket.priority_name],
              ["Department", ticket.dept_name],
              ["Create Date", formatDateTime(ticket.created)],
            ]}
          />
          <Info
            rows={[
              ["User", ticket.user_name],
              ["Email", owner?.email],
              ["Organization", owner?.org_name],
              ["Source", ticket.source],
            ]}
          />
        </div>
        <div className="space-y-4">
          <Info
            rows={[
              ["Assigned To", assignee || <span className="text-slate-500">— Unassigned —</span>],
              ["SLA Plan", ticket.sla_name],
              ["Due Date", formatDateTime(ticket.due_date)],
              ["Help Topic", ticket.topic_name],
              ["Last Message", formatDateTime(lastOf("M"))],
              ["Last Response", formatDateTime(lastOf("R"))],
            ]}
          />
        </div>
      </div>

      {ticket.collaborators.length > 0 && (
        <p className="mb-4 text-sm">
          <strong>Collaborators:</strong>{" "}
          {ticket.collaborators.map((c) => `${c.name} <${c.email}>${c.is_cc ? "" : " (no alerts)"}`).join(", ")}
        </p>
      )}

      <h2 className="border-b border-slate-300 pb-1 text-sm font-semibold text-slate-800">Ticket Thread ({posts.length})</h2>
      <ol className="mt-3 space-y-3">
        {entries.map((entry) => {
          const style = ENTRY_STYLE[entry.type] ?? ENTRY_STYLE.E;
          return (
            <li key={entry.id} className={`border ${style.box} ${entry.type === "E" ? "px-3 py-1.5 text-xs text-slate-600" : ""}`}>
              {entry.type === "E" ? (
                <p>
                  {formatDateTime(entry.created)} — {entry.title || entry.body}
                  {entry.poster ? ` (${entry.poster})` : ""}
                </p>
              ) : (
                <>
                  <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-inherit px-3 py-1.5 text-sm">
                    <span>
                      <strong>{entry.poster ?? "Unknown"}</strong> <span className="text-slate-500">· {style.label}</span>
                      {entry.is_edited && <span className="text-slate-500"> · edited</span>}
                    </span>
                    <time className="text-xs text-slate-500">{formatDateTime(entry.created)}</time>
                  </div>
                  <div className="px-3 py-2 text-sm">
                    {entry.title && <p className="mb-1 font-semibold">{entry.title}</p>}
                    <SafeHtml html={entry.body} />
                    {entry.attachments.length > 0 && (
                      <ul className="mt-2 border-t border-inherit pt-2 text-xs">
                        {entry.attachments.map((a) => (
                          <li key={a.id}>
                            <a href={`/api/v1/tickets/${ticket.ticket_id}/attachments/${a.id}`} className="text-sky-800 underline">
                              {a.name}
                            </a>{" "}
                            <span className="text-slate-500">({size(a.size)})</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </>
              )}
            </li>
          );
        })}
      </ol>

      <TicketReplyBox ticket={ticket} />
    </div>
  );
}
