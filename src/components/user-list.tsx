"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { formatDateTime } from "@/lib/format";
import { hasGlobal } from "@/lib/nav";
import { useAllOrgs, useUsers } from "@/lib/queries/directory";
import { useMe } from "@/lib/queries/me";
import { DirectoryTabs } from "./directory-tabs";
import { Pager } from "./pager";

const PAGE_SIZE = 25;

export function UserList() {
  const router = useRouter();
  const params = useSearchParams();
  const { data: me } = useMe();
  const orgId = /^\d+$/.test(params.get("org_id") ?? "") ? Number(params.get("org_id")) : undefined;
  const page = Math.max(1, Number(params.get("page")) || 1);
  const { data, error, isFetching } = useUsers({ org_id: orgId, page, page_size: PAGE_SIZE });
  const orgs = useAllOrgs();

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
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-sm">
          <span className="font-semibold text-slate-700">Organization</span>
          <select
            aria-label="Organization"
            value={orgId ?? ""}
            onChange={(e) => go({ org_id: e.target.value, page: null })}
            className="rounded border border-slate-300 bg-white px-3 py-1.5 text-sm"
          >
            <option value="">— All —</option>
            {orgs.data?.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>
        </label>
        <span className="text-xs text-slate-500">{isFetching ? "Loading…" : ""}</span>
        {me && hasGlobal(me, "user.create") && (
          <Link href="/users/new" className="ml-auto rounded bg-sky-800 px-3 py-1.5 text-sm font-semibold text-white hover:bg-sky-900">
            Add User
          </Link>
        )}
      </div>

      {error && <p role="alert" className="mb-3 text-sm text-red-700">{error.message}</p>}

      <div className="overflow-x-auto border border-slate-300 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-100 text-xs uppercase tracking-wide text-slate-600">
            <tr>
              {["Name", "Email", "Organization", "Created", "Updated"].map((h) => (
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
                <td className="px-3 py-2">
                  {u.org_id != null && (
                    <Link href={`/orgs/${u.org_id}`} className="text-sky-800 hover:underline">
                      {u.org_name}
                    </Link>
                  )}
                </td>
                <td className="whitespace-nowrap px-3 py-2">{formatDateTime(u.created)}</td>
                <td className="whitespace-nowrap px-3 py-2">{formatDateTime(u.updated)}</td>
              </tr>
            ))}
            {data && data.items.length === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-slate-500">
                  Query returned 0 results.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-xs text-slate-500">
        Search, sorting, ticket counts and registration status are not available through the API yet.
      </p>
      <Pager page={page} hasNext={(data?.items.length ?? 0) === PAGE_SIZE} onPage={(p) => go({ page: String(p) })} />
    </div>
  );
}
