"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api/client";
import { errorMessage } from "@/lib/api/errors";
import { formatDateTime } from "@/lib/format";
import { useTicketList } from "@/lib/queries/tickets";

type Hit = { id: number; type: string; title: string; subtitle?: string | null; url_path: string };

/** The API names the page a hit lives at; only a path on this site is followed. */
const safePath = (path: string) => (path.startsWith("/") && !path.startsWith("//") ? path : "/");

/**
 * The header search. Users and organizations come from the API's global search. Tickets come from the ticket list's own
 * search instead: it finds the same tickets (both match the requester, as osTicket's search does; a test compares them),
 * and its rows carry the columns a result table needs, where a global-search hit is only a number and a subject.
 */
export function SearchResults() {
  const q = (useSearchParams().get("q") ?? "").trim();
  const global = useQuery({
    queryKey: ["search", q],
    enabled: q.length > 0,
    queryFn: async () => {
      const { data, error } = await api.GET("/api/v1/search", { params: { query: { q, limit: 50 } } });
      if (!data) throw new Error(errorMessage(error));
      return data.results as Hit[];
    },
  });
  const tickets = useTicketList({ q: q || undefined, sort: "updated", descending: true, page: 1, page_size: 50 });

  if (!q) return <p className="text-sm text-slate-600">Type something in the search box above.</p>;

  const users = (global.data ?? []).filter((h) => h.type === "user");
  const orgs = (global.data ?? []).filter((h) => h.type === "org" || h.type === "organization");
  const ticketRows = tickets.data?.items ?? [];
  const loading = global.isLoading || (tickets.isLoading && q.length > 0);
  const nothing = !loading && users.length + orgs.length + ticketRows.length === 0;

  return (
    <div>
      <h1 className="mb-1 text-xl font-bold text-slate-800">Search</h1>
      <p className="mb-4 text-sm text-slate-600">
        Results for <strong>{q}</strong>
        {loading && " …"}
      </p>
      {(global.error || tickets.error) && <p role="alert" className="mb-3 text-sm text-red-700">{(global.error ?? tickets.error)?.message}</p>}
      {nothing && <p className="text-sm text-slate-600">Query returned 0 results.</p>}

      {ticketRows.length > 0 && (
        <section className="mb-6" aria-label="Ticket results">
          <h2 className="mb-1 border-b border-slate-300 pb-1 text-sm font-semibold text-slate-800">Tickets ({tickets.data?.total ?? ticketRows.length})</h2>
          <table className="w-full border border-slate-300 bg-white text-left text-sm">
            <thead className="bg-slate-100 text-xs uppercase tracking-wide text-slate-600">
              <tr>
                {["Ticket", "Last Updated", "Subject", "From", "Status"].map((h) => (
                  <th key={h} className="px-3 py-2 font-semibold">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ticketRows.map((t) => (
                <tr key={t.ticket_id} className="border-t border-slate-200 hover:bg-sky-50">
                  <td className="px-3 py-2">
                    <Link href={`/tickets/${t.ticket_id}`} className="font-medium text-sky-800 hover:underline">
                      {t.number}
                    </Link>
                  </td>
                  <td className="whitespace-nowrap px-3 py-2">{formatDateTime(t.updated)}</td>
                  <td className="px-3 py-2">{t.subject}</td>
                  <td className="px-3 py-2">{t.user_name}</td>
                  <td className="px-3 py-2">{t.status.name}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {users.length > 0 && (
        <section className="mb-6" aria-label="User results">
          <h2 className="mb-1 border-b border-slate-300 pb-1 text-sm font-semibold text-slate-800">Users ({users.length})</h2>
          <ul className="space-y-1 text-sm">
            {users.map((h) => (
              <li key={`u${h.id}`}>
                <Link href={safePath(h.url_path)} className="font-medium text-sky-800 hover:underline">
                  {h.title}
                </Link>{" "}
                <span className="text-slate-500">{h.subtitle}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {orgs.length > 0 && (
        <section className="mb-6" aria-label="Organization results">
          <h2 className="mb-1 border-b border-slate-300 pb-1 text-sm font-semibold text-slate-800">Organizations ({orgs.length})</h2>
          <ul className="space-y-1 text-sm">
            {orgs.map((h) => (
              <li key={`o${h.id}`}>
                <Link href={safePath(h.url_path)} className="font-medium text-sky-800 hover:underline">
                  {h.title}
                </Link>{" "}
                <span className="text-slate-500">{h.subtitle}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
