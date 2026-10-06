"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { CommandFailed, runCommand, useActionKey } from "@/lib/queries/commands";
import { useUserOptions } from "@/lib/queries/directory";
import { useAgentDirectory, useTeamsList } from "@/lib/queries/admin-lookups";
import { canAnywhere, useMe } from "@/lib/queries/me";
import { useDepartments, usePriorities, useSlas, useTopics } from "@/lib/queries/reference";
import { ticketKeys } from "@/lib/queries/tickets";
import { collectCustomFields, customDefs } from "@/lib/custom-fields";
import { useFormDefinition } from "@/lib/queries/forms";
import { CustomFieldInputs } from "./custom-fields";

const field = "w-full rounded border border-slate-300 bg-white px-3 py-1.5 text-sm";

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

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border border-slate-300 bg-white">
      <h2 className="border-b border-slate-300 bg-slate-100 px-4 py-2 text-sm font-bold text-slate-800">{title}</h2>
      <div className="space-y-3 p-4">{children}</div>
    </section>
  );
}

/** osTicket's staff "Open a New Ticket": requester (existing or new) with Cc, source, topic, department, SLA, due date, assignment, details, a first response and an internal note. */
export function TicketNew() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const key = useActionKey();
  const departments = useDepartments();
  const topics = useTopics();
  const priorities = usePriorities();
  const slas = useSlas();
  const { data: me } = useMe();
  const users = useUserOptions();
  const agents = useAgentDirectory().data ?? [];
  const teams = useTeamsList();
  const [userId, setUserId] = useState("");
  const [topicId, setTopicId] = useState<number | null>(null);
  const formDefs = useFormDefinition("T", topicId);
  const custom = customDefs(formDefs.data ?? [], "T");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setBusy(true);
    const form = new FormData(event.currentTarget);
    const text = (name: string) => String(form.get(name) ?? "").trim();
    const number = (name: string) => (text(name) ? Number(text(name)) : undefined);
    const assign = text("assign");
    const due = text("due_date");
    const response = text("response");
    const body = {
      // An existing user, or a new requester by name and email.
      user_id: userId ? Number(userId) : undefined,
      email: userId ? undefined : text("email"),
      name: userId ? undefined : text("name"),
      phone: !userId && text("phone") ? text("phone") : undefined,
      cc_user_ids: form.getAll("cc").length ? form.getAll("cc").map(Number) : undefined,
      source: text("source") || undefined,
      topic_id: number("topic_id"),
      dept_id: number("dept_id"),
      sla_id: number("sla_id"),
      due_date: due ? new Date(due).toISOString() : undefined,
      assign_agent_id: assign.startsWith("agent:") ? Number(assign.slice(6)) : undefined,
      assign_team_id: assign.startsWith("team:") ? Number(assign.slice(5)) : undefined,
      priority_id: number("priority_id"),
      subject: text("subject"),
      message: text("message"),
      response: response || undefined,
      signature: response ? text("signature") || undefined : undefined,
      note: text("note") || undefined,
      notify: text("notify") || undefined,
      custom_fields: undefined as Record<string, unknown> | undefined,
    };
    const answers = collectCustomFields(form, custom);
    if (Object.keys(answers).length > 0) body.custom_fields = answers;
    try {
      const result = await runCommand({ method: "POST", path: "/api/v1/tickets/", body, key: key.current() });
      key.renew();
      await queryClient.invalidateQueries({ queryKey: ticketKeys.all });
      router.push(`/tickets/${result.ticket_id}`);
    } catch (e) {
      if (e instanceof CommandFailed) key.renew();
      setError(e instanceof Error ? e.message : "Request failed");
      setBusy(false);
    }
  }

  return (
    <div>
      <p className="mb-2 text-sm">
        <Link href="/tickets" className="text-sky-800 hover:underline">
          ← Tickets
        </Link>
      </p>
      <h1 className="mb-3 text-xl font-bold text-slate-800">Open a New Ticket</h1>
      {error && (
        <p role="alert" className="mb-3 border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </p>
      )}
      <form onSubmit={onSubmit} className="max-w-3xl space-y-4">
        {/* The requester: an existing user, or a new one by name and email. */}
        <Section title="User and Collaborators">
          {users.data && (
            <Row label="Existing User">
              <select aria-label="Existing user" value={userId} onChange={(e) => setUserId(e.target.value)} className={field}>
                <option value="">— New user —</option>
                {users.data.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} &lt;{u.email}&gt;
                  </option>
                ))}
              </select>
            </Row>
          )}
          {!userId && (
            <>
              <Row label="Email Address" required>
                <input name="email" type="email" required maxLength={255} className={field} autoComplete="off" />
              </Row>
              <Row label="Full Name" required>
                <input name="name" required maxLength={255} className={field} autoComplete="off" />
              </Row>
              <Row label="Phone Number">
                <input name="phone" maxLength={64} className={field} autoComplete="off" />
              </Row>
            </>
          )}
          {users.data && (
            <Row label="Cc Collaborators">
              <select name="cc" multiple size={4} aria-label="Cc collaborators" className={field}>
                {users.data
                  .filter((u) => String(u.id) !== userId)
                  .map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name} &lt;{u.email}&gt;
                    </option>
                  ))}
              </select>
            </Row>
          )}
        </Section>

        <Section title="Ticket Information and Options">
          <Row label="Ticket Source">
            <select name="source" className={field} defaultValue="Phone">
              {["Phone", "Email", "Other"].map((o) => (
                <option key={o}>{o}</option>
              ))}
            </select>
          </Row>
          <Row label="Help Topic" required>
            <select name="topic_id" required className={field} defaultValue="" onChange={(e) => setTopicId(e.target.value ? Number(e.target.value) : null)}>
              <option value="">— Select Help Topic —</option>
              {topics.data?.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.topic}
                </option>
              ))}
            </select>
          </Row>
          <Row label="Department">
            <select name="dept_id" aria-label="Department" className={field} defaultValue="">
              <option value="">— Default —</option>
              {departments.data?.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </Row>
          <Row label="SLA Plan">
            <select name="sla_id" className={field} defaultValue="">
              <option value="">— System Default —</option>
              {slas.data?.map((sla) => (
                <option key={sla.id} value={sla.id}>
                  {sla.name}
                </option>
              ))}
            </select>
          </Row>
          <Row label="Due Date">
            <input name="due_date" type="datetime-local" className={field} />
          </Row>
          {canAnywhere(me, "ticket.assign") && (
            <Row label="Assign To">
              <select name="assign" className={field} defaultValue="">
                <option value="">— Unassigned —</option>
                <optgroup label="Agents">
                  {agents.map((a) => (
                    <option key={a.id} value={`agent:${a.id}`}>
                      {a.name}
                    </option>
                  ))}
                </optgroup>
                {(teams.data?.length ?? 0) > 0 && (
                  <optgroup label="Teams">
                    {teams.data?.map((t) => (
                      <option key={t.id} value={`team:${t.id}`}>
                        {t.name}
                      </option>
                    ))}
                  </optgroup>
                )}
              </select>
            </Row>
          )}
          <Row label="Priority">
            <select name="priority_id" className={field} defaultValue="">
              <option value="">— Default —</option>
              {priorities.data?.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.desc}
                </option>
              ))}
            </select>
          </Row>
        </Section>

        <Section title="Ticket Details">
          <Row label="Issue Summary" required>
            <input name="subject" required maxLength={255} className={field} />
          </Row>
          <Row label="Issue Details" required>
            <textarea name="message" required rows={8} className={field} />
          </Row>
          <CustomFieldInputs defs={custom} />
        </Section>

        {canAnywhere(me, "ticket.reply") && (
          <Section title="Response">
            <Row label="Response">
              <textarea name="response" rows={5} placeholder="An optional first reply to the user" className={field} />
            </Row>
            <Row label="Signature">
              <select name="signature" className={field} defaultValue="none">
                <option value="none">None</option>
                <option value="mine">My Signature</option>
                <option value="dept">Department Signature</option>
              </select>
            </Row>
          </Section>
        )}

        <Section title="Internal Note">
          <Row label="Internal Note">
            <textarea name="note" rows={4} placeholder="Visible to agents only" className={field} />
          </Row>
        </Section>

        <Section title="Ticket Notice">
          <Row label="Email on Create">
            <select name="notify" className={field} defaultValue="none">
              <option value="none">Do not send an email</option>
              <option value="user">Email the user</option>
              <option value="all">Email the user and collaborators</option>
            </select>
          </Row>
        </Section>

        <p className="text-xs text-slate-500">Not available through the API yet, so not offered here: ticket status on create and attachments on create.</p>

        <div className="flex gap-2">
          <button type="submit" disabled={busy} className="rounded bg-sky-800 px-5 py-2 text-sm font-semibold text-white hover:bg-sky-900 disabled:opacity-60">
            {busy ? "Creating…" : "Create Ticket"}
          </button>
          <Link href="/tickets" className="rounded border border-slate-400 bg-white px-4 py-2 text-sm font-medium text-slate-800 hover:bg-slate-100">
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
