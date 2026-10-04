"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { CommandFailed, runCommand, useActionKey } from "@/lib/queries/commands";
import { useDepartments, usePriorities, useTopics } from "@/lib/queries/reference";
import { ticketKeys } from "@/lib/queries/tickets";

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

/** osTicket's "Open a New Ticket", limited to what the API can create (see the notice at the bottom). */
export function TicketNew() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const key = useActionKey();
  const departments = useDepartments();
  const topics = useTopics();
  const priorities = usePriorities();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setBusy(true);
    const form = new FormData(event.currentTarget);
    const text = (name: string) => String(form.get(name) ?? "").trim();
    const number = (name: string) => (text(name) ? Number(text(name)) : undefined);
    const body = {
      email: text("email"),
      name: text("name"),
      phone: text("phone") || undefined,
      topic_id: number("topic_id"),
      dept_id: number("dept_id"),
      priority_id: number("priority_id"),
      subject: text("subject"),
      message: text("message"),
    };
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
        <Section title="User and Collaborators">
          <Row label="Email Address" required>
            <input name="email" type="email" required maxLength={255} className={field} autoComplete="off" />
          </Row>
          <Row label="Full Name" required>
            <input name="name" required maxLength={255} className={field} autoComplete="off" />
          </Row>
          <Row label="Phone Number">
            <input name="phone" maxLength={64} className={field} autoComplete="off" />
          </Row>
        </Section>

        <Section title="Ticket Information and Options">
          <Row label="Help Topic">
            <select name="topic_id" className={field} defaultValue="">
              <option value="">— Select Help Topic —</option>
              {topics.data?.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.topic}
                </option>
              ))}
            </select>
          </Row>
          <Row label="Department">
            <select name="dept_id" className={field} defaultValue="">
              <option value="">— Default —</option>
              {departments.data?.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </Row>
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
        </Section>

        <p className="text-xs text-slate-500">
          Not available through the API yet, so not offered here: ticket source, SLA plan, due date, assign on create, Cc
          collaborators, a first response or internal note, and attachments.
        </p>

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
