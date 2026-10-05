"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { components } from "@/lib/api/schema";
import { ApiError } from "@/lib/api/errors";
import { hasGlobal } from "@/lib/nav";
import { CommandFailed, runCommand, useActionKey } from "@/lib/queries/commands";
import { createdId, directoryKeys, useOrg, useUsers } from "@/lib/queries/directory";
import { useAgentDirectory, useTeamsList } from "@/lib/queries/admin-lookups";
import { useMe } from "@/lib/queries/me";
import { collectCustomFields, customDefs } from "@/lib/custom-fields";
import { useFormDefinition } from "@/lib/queries/forms";
import { field } from "./action-ui";
import { CustomFieldInputs } from "./custom-fields";

type Org = components["schemas"]["OrganizationDetail"];
type Sharing = NonNullable<components["schemas"]["OrganizationCreate"]["sharing"]>;

// osTicket's wording for the same three choices.
export const SHARING: { value: Sharing; label: string }[] = [
  { value: "disabled", label: "Disable" },
  { value: "primary_contacts", label: "Primary contacts see all tickets" },
  { value: "all_members", label: "All members see all tickets" },
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

/** The account fields of the form as an API payload; only what differs from `org` when editing. Empty if the inputs were not drawn. */
function accountChanges(form: FormData, org?: Org): Record<string, unknown> {
  if (!form.has("account-fields")) return {};
  const out: Record<string, unknown> = {};
  const [kind, id] = String(form.get("manager") ?? "").split(":");
  const staff = kind === "staff" ? Number(id) : 0;
  const team = kind === "team" ? Number(id) : 0;
  if (!org || staff !== (org.manager_staff_id ?? 0) || team !== (org.manager_team_id ?? 0)) {
    // On a new organization "no manager" is the default, so it need not be sent.
    if (org || staff || team) {
      out.manager_staff_id = staff;
      out.manager_team_id = team;
    }
  }
  const flag = (name: string) => form.get(name) === "on";
  const flags: [string, boolean, boolean | undefined][] = [
    ["assign_account_manager", flag("assign_account_manager"), org?.assign_account_manager],
    ["collab_primary_contacts", flag("collab_primary_contacts"), org?.collab_primary_contacts],
    ["collab_all_members", flag("collab_all_members"), org?.collab_all_members],
  ];
  for (const [name, now, before] of flags) if (org ? now !== Boolean(before) : now) out[name] = now;
  if (org) {
    const contacts = form.getAll("contacts").map(Number).sort((a, b) => a - b);
    const before = [...(org.primary_contact_ids ?? [])].sort((a, b) => a - b);
    if (contacts.length !== before.length || contacts.some((c, i) => c !== before[i])) out.primary_contact_ids = contacts;
  }
  return out;
}

/**
 * The account manager, auto-assignment, primary contacts and automated collaboration of an organization. The inputs are
 * only drawn once the agent and team lists are in (a select's default needs its options), and a hidden marker tells the
 * submit handler they exist, so a quick save can never clear settings the form had not shown yet.
 */
function OrgAccountFields({ org }: { org?: Org }) {
  const agents = useAgentDirectory();
  const teams = useTeamsList();
  const members = useUsers({ org_id: org?.id ?? 0, page: 1, page_size: 200 });
  if (agents.isLoading || teams.isLoading || (org && members.isLoading)) return <p className="text-sm text-slate-500">Loading account settings…</p>;

  const manager = org?.manager_staff_id ? `staff:${org.manager_staff_id}` : org?.manager_team_id ? `team:${org.manager_team_id}` : "";
  const primary = new Set(org?.primary_contact_ids ?? []);
  return (
    <>
      <input type="hidden" name="account-fields" value="1" />
      <Row label="Account Manager">
        <select name="manager" aria-label="Account Manager" defaultValue={manager} className={field}>
          <option value="">— None —</option>
          <optgroup label={`Agents (${agents.data?.length ?? 0})`}>
            {(agents.data ?? []).map((a) => (
              <option key={`s${a.id}`} value={`staff:${a.id}`}>
                {a.name}
              </option>
            ))}
          </optgroup>
          {(teams.data?.length ?? 0) > 0 && (
            <optgroup label={`Teams (${teams.data?.length ?? 0})`}>
              {(teams.data ?? []).map((t) => (
                <option key={`t${t.id}`} value={`team:${t.id}`}>
                  {t.name}
                </option>
              ))}
            </optgroup>
          )}
        </select>
      </Row>
      <Row label="Auto-Assignment">
        <span className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="assign_account_manager" aria-label="Assign tickets to the Account Manager" defaultChecked={org?.assign_account_manager} />
          Assign tickets from this organization to the Account Manager
        </span>
      </Row>
      {org && (
        <Row label="Primary Contacts">
          <fieldset aria-label="Primary Contacts" className="space-y-1">
            {(members.data?.items ?? []).map((u) => (
              <label key={u.id} className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="contacts" value={u.id} defaultChecked={primary.has(u.id)} /> {u.name}
              </label>
            ))}
            {members.data?.items.length === 0 && <p className="text-sm text-slate-500">This organization has no members yet.</p>}
          </fieldset>
        </Row>
      )}
      <Row label="Automated Collaboration">
        <span className="space-y-1 text-sm">
          <span className="flex items-center gap-2">
            <input type="checkbox" name="collab_primary_contacts" aria-label="Add primary contacts to all tickets" defaultChecked={org?.collab_primary_contacts} />
            Primary Contacts: add to all tickets from this organization
          </span>
          <span className="flex items-center gap-2">
            <input type="checkbox" name="collab_all_members" aria-label="Add organization members to all tickets" defaultChecked={org?.collab_all_members} />
            Organization Members: add to all tickets from this organization
          </span>
        </span>
      </Row>
    </>
  );
}

function OrgFormBody({ org }: { org?: Org }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const key = useActionKey();
  const formDefs = useFormDefinition("O");
  const custom = customDefs(formDefs.data ?? [], "O");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  if (formDefs.isLoading) return <p className="text-sm text-slate-500">Loading…</p>;

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
      Object.assign(body, accountChanges(form, org));
      const answers = collectCustomFields(form, custom, org.custom_fields);
      if (Object.keys(answers).length > 0) body.custom_fields = answers;
      if (Object.keys(body).length === 0) {
        setError("No changes to save.");
        return;
      }
    } else {
      body = { ...next };
      for (const k of ["domain", "phone", "website", "address", "internal_notes"] as const) if (!next[k]) delete body[k];
      Object.assign(body, accountChanges(form));
      const answers = collectCustomFields(form, custom);
      if (Object.keys(answers).length > 0) body.custom_fields = answers;
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
        <OrgAccountFields org={org} />
        <CustomFieldInputs defs={custom} answers={org?.custom_fields} />
        <Row label="Internal Notes">
          <textarea name="internal_notes" rows={4} defaultValue={org?.internal_notes} className={field} />
        </Row>
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
