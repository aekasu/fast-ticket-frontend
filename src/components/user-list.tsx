"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { formatDateTime } from "@/lib/format";
import { hasGlobal } from "@/lib/nav";
import { ACCOUNT_STATUS_LABEL, type UserSort, useAllOrgs, useUsers } from "@/lib/queries/directory";
import { useMe } from "@/lib/queries/me";
import { DirectoryTabs } from "./directory-tabs";
import { ColumnsPicker, useCustomColumns } from "./custom-columns";
import { Pager } from "./pager";
import { UserImport } from "./user-import";

const PAGE_SIZE = 25;
const SORTS: UserSort[] = ["name", "email", "status", "created", "updated"];

// osTicket's directory columns (Name with the ticket count, Status, Created, Updated), plus the email and organization the
// API also gives. `sort` is the API's key for the column.
const COLUMNS: { label: string; sort?: UserSort }[] = [
  { label: "Name", sort: "name" },
  { label: "Status", sort: "status" },
  { label: "Email", sort: "email" },
  { label: "Organization" },
  { label: "Created", sort: "created" },
  { label: "Updated", sort: "updated" },
];

/** The list's whole state is in the URL (search, organization, sort, page), so a view can be shared and compared. */
export function UserList() {
  const router = useRouter();
  const params = useSearchParams();
  const { data: me } = useMe();
  const orgId = /^\d+$/.test(params.get("org_id") ?? "") ? Number(params.get("org_id")) : undefined;
  const q = params.get("q") ?? "";
  const sortParam = params.get("sort") as UserSort | null;
  const sort: UserSort = sortParam && SORTS.includes(sortParam) ? sortParam : "name";
  const descending = params.get("dir") === "desc";
  const page = Math.max(1, Number(params.get("page")) || 1);
  const [search, setSearch] = useState(q);

  const custom = useCustomColumns("U");
  const { data, error, isFetching } = useUsers({ fields: custom.fields, org_id: orgId, q: q || undefined, sort, descending, page, page_size: PAGE_SIZE });
  const orgs = useAllOrgs();
  const total = data?.total ?? 0;

  function go(changes: Record<string, string | null>) {
    const next = new URLSearchParams(params.toString());
    for (const [key, value] of Object.entries(changes)) {
      if (value === null || value === "") next.delete(key);
      else next.set(key, value);
    }
    router.push(`/users?${next.toString()}`);
  }

  return (
    <div>
      <DirectoryTabs current="users" />
      <form
        className="mb-4 flex flex-wrap items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          go({ q: search.trim(), page: null });
        }}
      >
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Search users"
          placeholder="Search by name, email, organization or phone"
          maxLength={100}
          className="w-80 rounded border border-slate-300 bg-white px-3 py-1.5 text-sm"
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
        <label className="ml-2 flex items-center gap-2 text-sm">
          <span className="font-semibold text-slate-700">Organization</span>
          <select aria-label="Organization" value={orgId ?? ""} onChange={(e) => go({ org_id: e.target.value, page: null })} className="rounded border border-slate-300 bg-white px-3 py-1.5 text-sm">
            <option value="">— All —</option>
            {orgs.data?.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>
        </label>
        <span className="text-xs text-slate-500">{isFetching ? "Loading…" : `${total} user${total === 1 ? "" : "s"}`}</span>
        <ColumnsPicker defs={custom.defs} selected={custom.selected} onChange={(names) => go({ cols: names.join(",") || null, page: null })} />
        {me && hasGlobal(me, "user.create") && (
          <Link href="/users/new" className="ml-auto rounded bg-sky-800 px-3 py-1.5 text-sm font-semibold text-white hover:bg-sky-900">
            Add User
          </Link>
        )}
      </form>

      {me && hasGlobal(me, "user.create") && (
        <div className="mb-4">
          <UserImport />
        </div>
      )}

      {error && <p role="alert" className="mb-3 text-sm text-red-700">{error.message}</p>}

      <div className="overflow-x-auto border border-slate-300 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-100 text-xs uppercase tracking-wide text-slate-600">
            <tr>
              {COLUMNS.map((col) => (
                <th key={col.label} className="px-3 py-2 font-semibold">
                  {col.sort ? (
                    <button type="button" className="uppercase hover:underline" onClick={() => go({ sort: col.sort!, dir: sort === col.sort && !descending ? "desc" : "asc", page: null })}>
                      {col.label}
                      {sort === col.sort && <span aria-hidden> {descending ? "▼" : "▲"}</span>}
                    </button>
                  ) : (
                    col.label
                  )}
                </th>
              ))}
              {custom.headers.map((h) => (
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
                  {/* osTicket prints the count only when the user has tickets. */}
                  {u.ticket_count > 0 && <span className="text-slate-500"> ({u.ticket_count})</span>}
                </td>
                <td className="whitespace-nowrap px-3 py-2">{ACCOUNT_STATUS_LABEL[u.account_status] ?? u.account_status}</td>
                <td className="px-3 py-2">{u.email}</td>
                <td className="px-3 py-2">
                  {u.org_id != null && u.org_id > 0 && (
                    <Link href={`/orgs/${u.org_id}`} className="text-sky-800 hover:underline">
                      {u.org_name}
                    </Link>
                  )}
                </td>
                <td className="whitespace-nowrap px-3 py-2">{formatDateTime(u.created)}</td>
                <td className="whitespace-nowrap px-3 py-2">{formatDateTime(u.updated)}</td>
              {custom.cells(u.custom_fields).map((c, i) => (
                <td key={i} className="px-3 py-2">
                  {c}
                </td>
              ))}
              </tr>
            ))}
            {data && data.items.length === 0 && (
              <tr>
                <td colSpan={COLUMNS.length + custom.headers.length} className="px-3 py-6 text-center text-slate-500">
                  {q ? "No users match your search." : "Query returned 0 results."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <Pager page={page} hasNext={page * PAGE_SIZE < total} onPage={(p) => go({ page: String(p) })} />
    </div>
  );
}
