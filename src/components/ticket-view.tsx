"use client";

import Link from "next/link";
import { ApiError } from "@/lib/api/errors";
import { formatDateTime } from "@/lib/format";
import { useTicket, useTicketOwner } from "@/lib/queries/tickets";
import { TicketReplyBox, TicketToolbar } from "./ticket-actions";
import { TicketPeopleTools } from "./ticket-people";
import { CustomFieldsView } from "./custom-fields";
import { Info } from "./info-table";
import { Thread } from "./thread";
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
      <TicketPeopleTools ticket={ticket} />

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

      <CustomFieldsView answers={ticket.custom_fields} form="T" />

      {ticket.collaborators.length > 0 && (
        <p className="mb-4 text-sm">
          <strong>Collaborators:</strong>{" "}
          {ticket.collaborators.map((c) => `${c.name} <${c.email}>${c.is_cc ? "" : " (no alerts)"}`).join(", ")}
        </p>
      )}

      <h2 className="border-b border-slate-300 pb-1 text-sm font-semibold text-slate-800">Ticket Thread ({posts.length})</h2>
      <Thread entries={entries} attachmentHref={(id) => `/api/v1/tickets/${ticket.ticket_id}/attachments/${id}`} />

      <TicketReplyBox ticket={ticket} />
    </div>
  );
}
