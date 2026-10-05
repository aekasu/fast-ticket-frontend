"use client";

import Link from "next/link";
import { ApiError } from "@/lib/api/errors";
import { formatDateTime } from "@/lib/format";
import { hasGlobal } from "@/lib/nav";
import { directoryKeys, useOrg, useUsers } from "@/lib/queries/directory";
import { useAgentDirectory, useTeamsList } from "@/lib/queries/admin-lookups";
import { useMe } from "@/lib/queries/me";
import { CustomFieldsView } from "./custom-fields";
import { DeleteButton } from "./delete-button";
import { SHARING } from "./org-form";
import { Info } from "./info-table";

function Members({ orgId }: { orgId: number }) {
  const { data, isLoading } = useUsers({ org_id: orgId, page: 1, page_size: 100 });
  return (
    <section className="mt-6">
      <h2 className="border-b border-slate-300 pb-1 text-sm font-semibold text-slate-800">Users ({isLoading ? "…" : data?.items.length ?? 0})</h2>
      <table className="mt-2 w-full border border-slate-300 bg-white text-left text-sm">
        <thead className="bg-slate-100 text-xs uppercase tracking-wide text-slate-600">
          <tr>
            {["Name", "Email", "Created"].map((h) => (
              <th key={h} className="px-3 py-2 font-semibold">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data?.items.map((u) => (
            <tr key={u.id} className="border-t border-slate-200 hover:bg-sky-50">
              <td className="px-3 py-2">
                <Link href={`/users/${u.id}`} className="font-medium text-sky-800 hover:underline">
                  {u.name}
                </Link>
              </td>
              <td className="px-3 py-2">{u.email}</td>
              <td className="whitespace-nowrap px-3 py-2">{formatDateTime(u.created)}</td>
            </tr>
          ))}
          {data && data.items.length === 0 && (
            <tr>
              <td colSpan={3} className="px-3 py-4 text-center text-slate-500">
                No users.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </section>
  );
}

export function OrgView({ id }: { id: number }) {
  const { data: me } = useMe();
  const { data: org, error, isLoading } = useOrg(id);
  const agents = useAgentDirectory();
  const teams = useTeamsList();
  const members = useUsers({ org_id: id, page: 1, page_size: 100 });

  if (isLoading) return <p className="text-sm text-slate-500">Loading…</p>;
  if (error instanceof ApiError && error.status === 404) {
    return (
      <div>
        <p role="alert" className="mb-3 border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800">
          Unknown or invalid organization ID.
        </p>
        <Link href="/orgs" className="text-sm text-sky-800 underline">
          Back to organizations
        </Link>
      </div>
    );
  }
  if (error || !org) return <p role="alert" className="text-sm text-red-700">{error?.message ?? "Unable to load the organization."}</p>;

  const manager = org.manager_staff_id
    ? (agents.data?.find((a) => a.id === org.manager_staff_id)?.name ?? `Agent #${org.manager_staff_id}`)
    : org.manager_team_id
      ? `${teams.data?.find((t) => t.id === org.manager_team_id)?.name ?? `Team #${org.manager_team_id}`} (team)`
      : "";
  const contacts = (org.primary_contact_ids ?? []).map((cid) => members.data?.items.find((u) => u.id === cid)?.name ?? `User #${cid}`).join(", ");
  const collab = [org.collab_primary_contacts && "Primary contacts", org.collab_all_members && "All members"].filter(Boolean).join(", ");

  return (
    <div>
      <p className="mb-2 text-sm">
        <Link href="/orgs" className="text-sky-800 hover:underline">
          ← Organizations
        </Link>
      </p>
      <h1 className="mb-3 text-xl font-bold text-slate-800">{org.name}</h1>

      <div className="mb-4 flex flex-wrap items-start gap-2">
        {me && hasGlobal(me, "org.edit") && (
          <Link href={`/orgs/${org.id}/edit`} className="rounded border border-slate-400 bg-white px-3 py-1.5 text-sm font-medium text-slate-800 hover:bg-slate-100">
            Edit
          </Link>
        )}
        {me && hasGlobal(me, "org.delete") && (
          <DeleteButton noun="organization" path={`/api/v1/orgs/${org.id}`} redirectTo="/orgs" invalidate={directoryKeys.orgs} />
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Info
          rows={[
            ["Name", org.name],
            ["Domain", org.domain],
            ["Phone", org.phone],
            ["Website", org.website],
            ["Address", <span key="a" className="whitespace-pre-wrap">{org.address}</span>],
          ]}
        />
        <Info
          rows={[
            ["Created", formatDateTime(org.created)],
            ["Last Updated", formatDateTime(org.updated)],
            ["Account Manager", manager],
            ["Auto-Assignment", org.assign_account_manager ? "Tickets go to the Account Manager" : ""],
            ["Primary Contacts", contacts],
            ["Ticket Sharing", SHARING.find((x) => x.value === org.sharing)?.label ?? org.sharing],
            ["Automated Collaboration", collab ? `Added to all tickets: ${collab}` : ""],
            ["Internal Notes", <span key="n" className="whitespace-pre-wrap">{org.internal_notes}</span>],
          ]}
        />
      </div>

      <CustomFieldsView answers={org.custom_fields} form="O" />

      <Members orgId={org.id} />
    </div>
  );
}
