"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { components } from "@/lib/api/schema";
import { ApiError } from "@/lib/api/errors";
import { hasGlobal } from "@/lib/nav";
import { CommandFailed, runCommand, useActionKey } from "@/lib/queries/commands";
import { createdId, directoryKeys, useOrg } from "@/lib/queries/directory";
import { useMe } from "@/lib/queries/me";
import { field } from "./action-ui";

type Org = components["schemas"]["OrganizationDetail"];
type Sharing = NonNullable<components["schemas"]["OrganizationCreate"]["sharing"]>;

const SHARING: { value: Sharing; label: string }[] = [
  { value: "disabled", label: "No sharing" },
  { value: "primary_contacts", label: "Primary contacts see tickets of all members" },
  { value: "all_members", label: "All members see each other's tickets" },
];

function Row({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <label className="grid items-center gap-1 sm:grid-cols-[11rem_1fr]">
      <span className="text-sm font-semibold text-slate-700">
        {label}
        {required && <span className="text-red-700"> *</span>}
      </span>
      {children}
    </label>
  );
}

function OrgFormBody({ org }: { org?: Org }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const key = useActionKey();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const form = new FormData(event.currentTarget);
    const text = (name: string) => String(form.get(name) ?? "").trim();
    const next = {
      name: text("name"),
      domain: text("domain"),
      phone: text("phone"),
      website: text("website"),
      address: String(form.get("address") ?? ""),
      internal_notes: String(form.get("internal_notes") ?? ""),
      sharing: text("sharing") as Sharing,
    };

    let body: Record<string, unknown>;
    if (org) {
      body = {};
      for (const k of Object.keys(next) as (keyof typeof next)[]) if (next[k] !== org[k]) body[k] = next[k];
      if (Object.keys(body).length === 0) {
        setError("No changes to save.");
        return;
      }
    } else {
      body = { ...next };
      for (const k of ["domain", "phone", "website", "address", "internal_notes"] as const) if (!next[k]) delete body[k];
    }

    setBusy(true);
    try {
      const result = await runCommand({
        method: org ? "PATCH" : "POST",
        path: org ? `/api/v1/orgs/${org.id}` : "/api/v1/orgs",
        body,
        key: key.current(),
      });
      key.renew();
      await queryClient.invalidateQueries({ queryKey: directoryKeys.orgs });
      await queryClient.invalidateQueries({ queryKey: directoryKeys.users });
      router.push(`/orgs/${org ? org.id : createdId(result)}`);
    } catch (e) {
      if (e instanceof CommandFailed) key.renew();
      setError(e instanceof Error ? e.message : "Request failed");
      setBusy(false);
    }
  }

  return (
    <>
      {error && (
        <p role="alert" className="mb-3 border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </p>
      )}
      <form onSubmit={onSubmit} className="max-w-3xl space-y-3 border border-slate-300 bg-white p-4">
        <Row label="Name" required>
          <input name="name" required defaultValue={org?.name} maxLength={255} className={field} />
        </Row>
        <Row label="Domain">
          <input name="domain" defaultValue={org?.domain} maxLength={256} placeholder="example.com" className={field} />
        </Row>
        <Row label="Phone">
          <input name="phone" defaultValue={org?.phone} maxLength={64} className={field} />
        </Row>
        <Row label="Website">
          <input name="website" defaultValue={org?.website} maxLength={255} className={field} />
        </Row>
        <Row label="Address">
          <textarea name="address" rows={3} defaultValue={org?.address} className={field} />
        </Row>
        <Row label="Ticket Sharing">
          <select name="sharing" defaultValue={org?.sharing ?? "primary_contacts"} className={field}>
            {SHARING.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </Row>
        <Row label="Internal Notes">
          <textarea name="internal_notes" rows={4} defaultValue={org?.internal_notes} className={field} />
        </Row>
        <p className="text-xs text-slate-500">Account manager, primary contacts and automatic collaborators are not offered here yet.</p>
        <div className="flex gap-2">
          <button type="submit" disabled={busy} className="rounded bg-sky-800 px-5 py-2 text-sm font-semibold text-white hover:bg-sky-900 disabled:opacity-60">
            {busy ? "Saving…" : org ? "Save Changes" : "Add Organization"}
          </button>
          <Link href={org ? `/orgs/${org.id}` : "/orgs"} className="rounded border border-slate-400 bg-white px-4 py-2 text-sm font-medium text-slate-800 hover:bg-slate-100">
            Cancel
          </Link>
        </div>
      </form>
    </>
  );
}

export function OrgNew() {
  return (
    <div>
      <p className="mb-2 text-sm">
        <Link href="/orgs" className="text-sky-800 hover:underline">
          ← Organizations
        </Link>
      </p>
      <h1 className="mb-3 text-xl font-bold text-slate-800">Add New Organization</h1>
      <OrgFormBody />
    </div>
  );
}

export function OrgEdit({ id }: { id: number }) {
  const { data: me } = useMe();
  const { data: org, error, isLoading } = useOrg(id);
  if (isLoading) return <p className="text-sm text-slate-500">Loading…</p>;
  if (error instanceof ApiError && error.status === 404) return <p className="text-sm">Unknown or invalid organization ID.</p>;
  if (error || !org) return <p role="alert" className="text-sm text-red-700">{error?.message ?? "Unable to load the organization."}</p>;
  if (me && !hasGlobal(me, "org.edit")) return <p className="text-sm">Access denied. You do not have permission to edit organizations.</p>;
  return (
    <div>
      <p className="mb-2 text-sm">
        <Link href={`/orgs/${org.id}`} className="text-sky-800 hover:underline">
          ← {org.name}
        </Link>
      </p>
      <h1 className="mb-3 text-xl font-bold text-slate-800">Update {org.name}</h1>
      <OrgFormBody org={org} />
    </div>
  );
}
