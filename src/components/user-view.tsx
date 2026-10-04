"use client";

import Link from "next/link";
import { ApiError } from "@/lib/api/errors";
import { formatDateTime } from "@/lib/format";
import { hasGlobal } from "@/lib/nav";
import { directoryKeys, useUser } from "@/lib/queries/directory";
import { useMe } from "@/lib/queries/me";
import { useTicketList } from "@/lib/queries/tickets";
import { DeleteButton } from "./delete-button";
import { Info } from "./info-table";
import { UserAccount, accountStatus } from "./user-account";

/** The tickets this user opened, as far as the agent can see. */
function UserTickets({ userId, email }: { userId: number; email: string }) {
  // The ticket list has no user filter: search by the email and keep the exact owner.
  const { data, isLoading } = useTicketList({ q: email, page_size: 100, sort: "updated" });
  const mine = data?.items.filter((t) => t.user_id === userId) ?? [];
  return (
    <section className="mt-6">
      <h2 className="border-b border-slate-300 pb-1 text-sm font-semibold text-slate-800">Tickets ({isLoading ? "…" : mine.length})</h2>
      <table className="mt-2 w-full border border-slate-300 bg-white text-left text-sm">
        <thead className="bg-slate-100 text-xs uppercase tracking-wide text-slate-600">
          <tr>
            {["Ticket", "Last Updated", "Subject", "Status"].map((h) => (
              <th key={h} className="px-3 py-2 font-semibold">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {mine.map((t) => (
            <tr key={t.ticket_id} className="border-t border-slate-200 hover:bg-sky-50">
              <td className="px-3 py-2">
                <Link href={`/tickets/${t.ticket_id}`} className="font-medium text-sky-800 hover:underline">
                  {t.number}
                </Link>
              </td>
              <td className="whitespace-nowrap px-3 py-2">{formatDateTime(t.updated)}</td>
              <td className="px-3 py-2">{t.subject}</td>
              <td className="px-3 py-2">{t.status.name}</td>
            </tr>
          ))}
          {!isLoading && mine.length === 0 && (
            <tr>
              <td colSpan={4} className="px-3 py-4 text-center text-slate-500">
                No tickets.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </section>
  );
}

export function UserView({ id }: { id: number }) {
  const { data: me } = useMe();
  const { data: user, error, isLoading } = useUser(id);

  if (isLoading) return <p className="text-sm text-slate-500">Loading…</p>;
  if (error instanceof ApiError && error.status === 404) {
    return (
      <div>
        <p role="alert" className="mb-3 border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800">
          Unknown or invalid user ID.
        </p>
        <Link href="/users" className="text-sm text-sky-800 underline">
          Back to the user directory
        </Link>
      </div>
    );
  }
  if (error || !user) return <p role="alert" className="text-sm text-red-700">{error?.message ?? "Unable to load the user."}</p>;

  const account = user.account;
  return (
    <div>
      <p className="mb-2 text-sm">
        <Link href="/users" className="text-sky-800 hover:underline">
          ← User Directory
        </Link>
      </p>
      <h1 className="mb-3 text-xl font-bold text-slate-800">{user.name}</h1>

      <div className="mb-4 flex flex-wrap items-start gap-2">
        {me && hasGlobal(me, "user.edit") && (
          <Link href={`/users/${user.id}/edit`} className="rounded border border-slate-400 bg-white px-3 py-1.5 text-sm font-medium text-slate-800 hover:bg-slate-100">
            Edit
          </Link>
        )}
        {me && hasGlobal(me, "user.delete") && (
          <DeleteButton noun="user" path={`/api/v1/users/${user.id}`} redirectTo="/users" invalidate={directoryKeys.users} />
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Info
          rows={[
            ["Name", user.name],
            ["Email", user.email],
            [
              "Organization",
              user.org_id != null ? (
                <Link href={`/orgs/${user.org_id}`} className="text-sky-800 hover:underline">
                  {user.org_name}
                </Link>
              ) : (
                ""
              ),
            ],
            ["Phone", user.phone],
            ["Mobile", user.mobile],
          ]}
        />
        <Info
          rows={[
            ["Created", formatDateTime(user.created)],
            ["Updated", formatDateTime(user.updated)],
            ["Status", accountStatus(account)],
            ["Internal Notes", user.internal_notes],
          ]}
        />
      </div>

      <UserAccount user={user} />

      <UserTickets userId={user.id} email={user.email} />
    </div>
  );
}
