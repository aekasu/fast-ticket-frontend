"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { components } from "@/lib/api/schema";
import { ApiError } from "@/lib/api/errors";
import { hasGlobal } from "@/lib/nav";
import { CommandFailed, runCommand, useActionKey } from "@/lib/queries/commands";
import { createdId, directoryKeys, useAllOrgs, useUser } from "@/lib/queries/directory";
import { useMe } from "@/lib/queries/me";
import { field } from "./action-ui";

type User = components["schemas"]["UserDetail"];

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

/** osTicket's "Add User" / "Update User": create posts everything, edit sends only what changed. */
function UserFormBody({ user }: { user?: User }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const key = useActionKey();
  const orgs = useAllOrgs();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (orgs.isLoading) return <p className="text-sm text-slate-500">Loading…</p>;

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const form = new FormData(event.currentTarget);
    const text = (name: string) => String(form.get(name) ?? "").trim();
    const orgValue = text("org_id") ? Number(text("org_id")) : null;
    const next = {
      name: text("name"),
      email: text("email"),
      phone: text("phone"),
      mobile: text("mobile"),
      internal_notes: String(form.get("internal_notes") ?? ""),
      org_id: orgValue,
    };

    let body: Record<string, unknown>;
    if (user) {
      body = {};
      if (next.name !== user.name) body.name = next.name;
      if (next.email !== user.email) body.email = next.email;
      if (next.phone !== user.phone) body.phone = next.phone;
      if (next.mobile !== user.mobile) body.mobile = next.mobile;
      if (next.internal_notes !== user.internal_notes) body.internal_notes = next.internal_notes;
      if (next.org_id !== (user.org_id ?? null)) body.org_id = next.org_id;
      if (Object.keys(body).length === 0) {
        setError("No changes to save.");
        return;
      }
    } else {
      body = { ...next, phone: next.phone || undefined, mobile: next.mobile || undefined, internal_notes: next.internal_notes || undefined, org_id: next.org_id ?? undefined };
    }

    setBusy(true);
    try {
      const result = await runCommand({
        method: user ? "PATCH" : "POST",
        path: user ? `/api/v1/users/${user.id}` : "/api/v1/users",
        body,
        key: key.current(),
      });
      key.renew();
      await queryClient.invalidateQueries({ queryKey: directoryKeys.users });
      router.push(`/users/${user ? user.id : createdId(result)}`);
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
        <Row label="Email Address" required>
          <input name="email" type="email" required defaultValue={user?.email} maxLength={255} className={field} autoComplete="off" />
        </Row>
        <Row label="Full Name" required>
          <input name="name" required defaultValue={user?.name} maxLength={255} className={field} autoComplete="off" />
        </Row>
        <Row label="Phone Number">
          <input name="phone" defaultValue={user?.phone} maxLength={64} className={field} autoComplete="off" />
        </Row>
        <Row label="Mobile Number">
          <input name="mobile" defaultValue={user?.mobile} maxLength={64} className={field} autoComplete="off" />
        </Row>
        <Row label="Organization">
          <select name="org_id" defaultValue={user?.org_id ?? ""} className={field}>
            <option value="">— None —</option>
            {orgs.data?.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>
        </Row>
        <Row label="Internal Notes">
          <textarea name="internal_notes" rows={4} defaultValue={user?.internal_notes} className={field} />
        </Row>
        <div className="flex gap-2">
          <button type="submit" disabled={busy} className="rounded bg-sky-800 px-5 py-2 text-sm font-semibold text-white hover:bg-sky-900 disabled:opacity-60">
            {busy ? "Saving…" : user ? "Save Changes" : "Add User"}
          </button>
          <Link href={user ? `/users/${user.id}` : "/users"} className="rounded border border-slate-400 bg-white px-4 py-2 text-sm font-medium text-slate-800 hover:bg-slate-100">
            Cancel
          </Link>
        </div>
      </form>
    </>
  );
}

export function UserNew() {
  return (
    <div>
      <p className="mb-2 text-sm">
        <Link href="/users" className="text-sky-800 hover:underline">
          ← User Directory
        </Link>
      </p>
      <h1 className="mb-3 text-xl font-bold text-slate-800">Add New User</h1>
      <UserFormBody />
    </div>
  );
}

export function UserEdit({ id }: { id: number }) {
  const { data: me } = useMe();
  const { data: user, error, isLoading } = useUser(id);
  if (isLoading) return <p className="text-sm text-slate-500">Loading…</p>;
  if (error instanceof ApiError && error.status === 404) return <p className="text-sm">Unknown or invalid user ID.</p>;
  if (error || !user) return <p role="alert" className="text-sm text-red-700">{error?.message ?? "Unable to load the user."}</p>;
  if (me && !hasGlobal(me, "user.edit")) return <p className="text-sm">Access denied. You do not have permission to edit users.</p>;
  return (
    <div>
      <p className="mb-2 text-sm">
        <Link href={`/users/${user.id}`} className="text-sky-800 hover:underline">
          ← {user.name}
        </Link>
      </p>
      <h1 className="mb-3 text-xl font-bold text-slate-800">Update {user.name}</h1>
      <UserFormBody user={user} />
    </div>
  );
}
