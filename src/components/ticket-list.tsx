"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { formatDateTime } from "@/lib/format";
import { type QueueKey, type TicketSort, useTicketList } from "@/lib/queries/tickets";
import { TicketQueues } from "./ticket-queues";

const QUEUES: QueueKey[] = ["open", "unanswered", "answered", "overdue", "mine", "assigned_me", "assigned_teams", "closed"];
const SORTS: TicketSort[] = ["last_activity", "updated", "created", "due_date", "number", "subject", "status", "dept", "priority", "assignee", "requester"];
const PAGE_SIZE = 25;

// osTicket's default ticket columns. `sort` is the API's sort key for the column (none: not sortable here).
const COLUMNS: { label: string; sort?: TicketSort }[] = [
  { label: "Ticket", sort: "number" },
  // osTicket's "Last Updated" is the last message or response, which the API calls last_activity.
  { label: "Last Updated", sort: "last_activity" },
  { label: "Subject", sort: "subject" },
  { label: "From", sort: "requester" },
  { label: "Priority", sort: "priority" },
  { label: "Assigned To", sort: "assignee" },
];

/** The list's whole state lives in the URL (queue, search, sort, page), so a view can be shared and compared. */
export function TicketList() {
  const router = useRouter();
  const params = useSearchParams();
  const queueParam = params.get("queue") as QueueKey | null;
  const queue: QueueKey = queueParam && QUEUES.includes(queueParam) ? queueParam : "open";
  const q = params.get("q") ?? "";
  const sortParam = params.get("sort") as TicketSort | null;
  // osTicket's default queue order starts with the most urgent priority. In the API that is `priority` ascending
  // (its key is the urgency number, 1 = Emergency); every other column starts newest/highest first.
  const sort: TicketSort = sortParam && SORTS.includes(sortParam) ? sortParam : "priority";
  const dirParam = params.get("dir");
  const descending = dirParam ? dirParam === "desc" : sort !== "priority";
  const page = Math.max(1, Number(params.get("page")) || 1);

  const { data, error, isFetching } = useTicketList({
    queue,
    q: q || undefined,
    sort,
    descending,
    page,
    page_size: PAGE_SIZE,
  });

  function go(changes: Record<string, string | null>) {
    const next = new URLSearchParams(params.toString());
    for (const [key, value] of Object.entries(changes)) {
      if (value === null || value === "") next.delete(key);
      else next.set(key, value);
    }
    router.push(`/tickets?${next.toString()}`);
  }

  const [search, setSearch] = useState(q);
  const total = data?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div>
      <TicketQueues current={queue} />

      <form
        className="mb-4 flex items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          go({ q: search.trim(), page: null });
        }}
      >
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          maxLength={100}
          placeholder="Search tickets"
          aria-label="Search tickets"
          className="w-72 rounded border border-slate-300 bg-white px-3 py-1.5 text-sm"
        />
        <button type="submit" className="rounded bg-sky-800 px-3 py-1.5 text-sm font-semibold text-white hover:bg-sky-900">
          Search
        </button>
        {q && (
          <button
            type="button"
            className="text-sm text-sky-800 underline"
            onClick={() => {
              setSearch("");
              go({ q: null, page: null });
            }}
          >
            Clear
          </button>
        )}
        <span className="ml-auto text-xs text-slate-500">{isFetching ? "Loading…" : `${total} ticket${total === 1 ? "" : "s"}`}</span>
      </form>

      {error && <p role="alert" className="mb-3 text-sm text-red-700">{error.message}</p>}

      <div className="overflow-x-auto border border-slate-300 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-100 text-xs uppercase tracking-wide text-slate-600">
            <tr>
              {COLUMNS.map((col) => (
                <th key={col.label} className="px-3 py-2 font-semibold">
                  {col.sort ? (
                    <button
                      type="button"
                      className="uppercase hover:underline"
                      onClick={() =>
                        go({
                          sort: col.sort!,
                          // Same column: flip. New column: start at its natural direction.
                          dir: (sort === col.sort ? !descending : col.sort !== "priority") ? "desc" : "asc",
                          page: null,
                        })
                      }
                    >
                      {col.label}
                      {sort === col.sort && <span aria-hidden> {descending ? "▼" : "▲"}</span>}
                    </button>
                  ) : (
                    col.label
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data?.items.map((t) => (
              <tr key={t.ticket_id} className={`border-t border-slate-200 hover:bg-sky-50 ${t.is_overdue ? "text-red-700" : ""}`} data-overdue={t.is_overdue ? "true" : undefined}>
                <td className="whitespace-nowrap px-3 py-2">
                  <Link href={`/tickets/${t.ticket_id}`} className="font-medium text-sky-800 hover:underline">
                    {t.number}
                  </Link>
                </td>
                <td className="whitespace-nowrap px-3 py-2">{formatDateTime(t.last_activity ?? t.updated)}</td>
                <td className="px-3 py-2">
                  <Link href={`/tickets/${t.ticket_id}`} className="text-sky-800 hover:underline">
                    {t.subject}
                  </Link>
                </td>
                <td className="px-3 py-2">{t.user_name}</td>
                <td className="px-3 py-2">{t.priority_name}</td>
                <td className="px-3 py-2">{t.assignee_name ?? t.team_name ?? ""}</td>
              </tr>
            ))}
            {data && data.items.length === 0 && (
              <tr>
                <td colSpan={COLUMNS.length} className="px-3 py-6 text-center text-slate-500">
                  {q ? "No tickets match your search." : "Query returned 0 results."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {pages > 1 && (
        <nav className="mt-3 flex items-center gap-3 text-sm" aria-label="Pages">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => go({ page: String(page - 1) })}
            className="rounded border border-slate-300 bg-white px-3 py-1 disabled:opacity-40"
          >
            Previous
          </button>
          <span>
            Page {page} of {pages}
          </span>
          <button
            type="button"
            disabled={page >= pages}
            onClick={() => go({ page: String(page + 1) })}
            className="rounded border border-slate-300 bg-white px-3 py-1 disabled:opacity-40"
          >
            Next
          </button>
        </nav>
      )}
    </div>
  );
}
