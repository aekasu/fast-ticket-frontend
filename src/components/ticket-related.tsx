"use client";

import Link from "next/link";
import { useRelated } from "@/lib/queries/tickets";

/** osTicket's related tickets: the parent a ticket is linked or merged into, or the children under it. */
export function TicketRelated({ ticketId }: { ticketId: number }) {
  const { data } = useRelated(ticketId);
  if (!data || data.relation === "none") return null;
  const rows = data.is_parent ? data.children : data.parent ? [data.parent] : [];
  const what = data.relation === "merged" ? "Merged" : "Linked";
  return (
    <section className="mb-4 border border-slate-300 bg-white" aria-label="Related tickets">
      <h2 className="border-b border-slate-300 bg-slate-100 px-3 py-1.5 text-sm font-bold text-slate-800">
        {what} Tickets{data.merge_type ? ` (${data.merge_type})` : ""} — {data.is_parent ? "children of this ticket" : "this ticket's parent"}
      </h2>
      <ul className="text-sm">
        {rows.map((t) => (
          <li key={t.ticket_id} className="flex gap-3 border-b border-slate-100 px-3 py-1.5 last:border-b-0">
            <Link href={`/tickets/${t.ticket_id}`} className="font-medium text-sky-800 hover:underline">
              #{t.number}
            </Link>
            <span className="flex-1">{t.subject}</span>
            <span className="text-slate-500">{t.status_name}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
