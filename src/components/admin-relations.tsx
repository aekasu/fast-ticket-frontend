"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { getJson } from "@/lib/api/raw";
import { type Row } from "@/lib/admin/resources";
import { useAdminLookups, useFormsList, usePermissionKeys, useStaffList, useTeamsList } from "@/lib/queries/admin-lookups";
import { NoticeBar, button, field, primary, useRunner } from "./action-ui";

// Editors for the list-valued fields of an admin record: who is on a team, a department's extended-access agents, an
// agent's extra departments, teams and permissions, and a help topic's forms. Each saves only its own field.

const asId = (m: unknown): number => Number(typeof m === "object" && m ? ((m as Row).staff_id ?? (m as Row).team_id ?? (m as Row).id) : m);

function Card({ title, children, note }: { title: string; children: React.ReactNode; note?: string }) {
  return (
    <section className="mt-6 max-w-3xl border border-slate-300 bg-white" aria-label={title}>
      <h2 className="border-b border-slate-300 bg-slate-100 px-4 py-2 text-sm font-bold text-slate-800">{title}</h2>
      <div className="space-y-3 p-4">
        {children}
        {note && <p className="text-xs text-slate-500">{note}</p>}
      </div>
    </section>
  );
}

function useSave(path: string, key: string) {
  const { run, busy, notice, clear } = useRunner(path, ["admin", key]);
  return { busy, notice, clear, save: (body: Record<string, unknown>, ok: string) => run("", body, ok, "PATCH") };
}

/** Team members, each with an alerts switch. */
export function TeamMembersEditor({ id, data }: { id: number; data: Row }) {
  const staff = useStaffList();
  const { busy, notice, clear, save } = useSave(`/api/v1/teams/${id}`, "teams");
  const members = new Set(((data.members as unknown[]) ?? []).map(asId));
  const alerts = (data.member_alerts as Record<string, boolean>) ?? {};
  const [version, setVersion] = useState(0);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const chosen = (staff.data ?? []).filter((s) => form.get(`member-${s.id}`) === "on").map((s) => s.id);
    const member_alerts = Object.fromEntries(chosen.map((sid) => [String(sid), form.get(`alerts-${sid}`) === "on"]));
    if (await save({ members: chosen, member_alerts }, "Team members saved.")) setVersion((v) => v + 1);
  }

  return (
    <Card title="Team members" note="An agent who is not ticked is not on the team.">
      <form key={`${version}-${[...members].join(",")}`} onSubmit={submit} className="space-y-3">
        <table className="w-full text-left text-sm">
          <thead className="text-xs uppercase tracking-wide text-slate-600">
            <tr>
              <th className="py-1 pr-3 font-semibold">Agent</th>
              <th className="py-1 pr-3 font-semibold">Member</th>
              <th className="py-1 font-semibold">Alerts</th>
            </tr>
          </thead>
          <tbody>
            {(staff.data ?? []).map((s) => (
              <tr key={s.id} className="border-t border-slate-200">
                <td className="py-1.5 pr-3">{`${s.firstname} ${s.lastname}`}</td>
                <td className="py-1.5 pr-3">
                  <input type="checkbox" name={`member-${s.id}`} aria-label={`${s.firstname} ${s.lastname} is a member`} defaultChecked={members.has(s.id)} />
                </td>
                <td className="py-1.5">
                  <input type="checkbox" name={`alerts-${s.id}`} aria-label={`Alerts for ${s.firstname} ${s.lastname}`} defaultChecked={alerts[String(s.id)] ?? true} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <NoticeBar notice={notice} />
        <button type="submit" disabled={busy} className={primary} onClick={clear}>
          {busy ? "Saving…" : "Save Members"}
        </button>
      </form>
    </Card>
  );
}

interface Access {
  key: string;
  id: number;
  role: number;
  alerts: boolean;
}

/** Extended access: agents from other departments who work in this one, with the role they hold here. */
export function DepartmentMembersEditor({ id, data }: { id: number; data: Row }) {
  const lookups = useAdminLookups();
  const { busy, notice, clear, save } = useSave(`/api/v1/departments/${id}`, "departments");
  const initial = ((data.members as Row[]) ?? []).map((m, i): Access => ({ key: `m${i}`, id: Number(m.staff_id), role: Number(m.role_id), alerts: m.alerts !== false }));
  const [rows, setRows] = useState<Access[]>(initial);
  const [agent, setAgent] = useState("");
  const [role, setRole] = useState("");
  const roleName = (rid: number) => lookups.names.roles.get(rid) ?? `#${rid}`;
  const name = (sid: number) => lookups.names.agents.get(sid) ?? `#${sid}`;

  function add() {
    if (!agent || !role || rows.some((r) => r.id === Number(agent))) return;
    setRows((r) => [...r, { key: `n${Date.now()}`, id: Number(agent), role: Number(role), alerts: true }]);
    setAgent("");
  }

  return (
    <Card title="Extended access" note="Agents whose primary department is another one, and who also work here.">
      <table className="w-full text-left text-sm">
        <thead className="text-xs uppercase tracking-wide text-slate-600">
          <tr>
            <th className="py-1 pr-3 font-semibold">Agent</th>
            <th className="py-1 pr-3 font-semibold">Role</th>
            <th className="py-1 pr-3 font-semibold">Alerts</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.key} className="border-t border-slate-200">
              <td className="py-1.5 pr-3">{name(r.id)}</td>
              <td className="py-1.5 pr-3">{roleName(r.role)}</td>
              <td className="py-1.5 pr-3">
                <input type="checkbox" aria-label={`Alerts for ${name(r.id)}`} checked={r.alerts} onChange={(e) => setRows((all) => all.map((x) => (x.key === r.key ? { ...x, alerts: e.target.checked } : x)))} />
              </td>
              <td className="py-1.5 text-right">
                <button type="button" className="text-red-800 underline" onClick={() => setRows((all) => all.filter((x) => x.key !== r.key))}>
                  Remove {name(r.id)}
                </button>
              </td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={4} className="py-3 text-center text-slate-500">
                No extended-access agents.
              </td>
            </tr>
          )}
        </tbody>
      </table>
      <div className="flex flex-wrap items-center gap-2 border-t border-slate-200 pt-3">
        <select aria-label="Agent to add" value={agent} onChange={(e) => setAgent(e.target.value)} className={`${field} max-w-xs`}>
          <option value="">— Select an agent —</option>
          {lookups.options.agents.filter((a) => !rows.some((r) => r.id === a.value)).map((a) => (
            <option key={a.value} value={a.value}>
              {a.label}
            </option>
          ))}
        </select>
        <select aria-label="Role" value={role} onChange={(e) => setRole(e.target.value)} className={`${field} max-w-xs`}>
          <option value="">— Select a role —</option>
          {lookups.options.roles.map((r) => (
            <option key={r.value} value={r.value}>
              {r.label}
            </option>
          ))}
        </select>
        <button type="button" className={button} onClick={add} disabled={!agent || !role}>
          Add Agent
        </button>
      </div>
      <NoticeBar notice={notice} />
      <button type="button" disabled={busy} className={primary} onClick={() => { clear(); save({ members: rows.map((r) => ({ staff_id: r.id, role_id: r.role, alerts: r.alerts })) }, "Extended access saved."); }}>
        {busy ? "Saving…" : "Save Extended Access"}
      </button>
    </Card>
  );
}

// Labels and groups for the global permissions the API lists (`GET /permissions`). A key with no label here is still
// offered, under "Other", worded as its key.
const PERMISSION_LABELS: Record<string, { label: string; group: string }> = {
  "user.create": { group: "Users", label: "Create users" },
  "user.edit": { group: "Users", label: "Edit users" },
  "user.delete": { group: "Users", label: "Delete users" },
  "user.manage": { group: "Users", label: "Manage user accounts" },
  "user.dir": { group: "Users", label: "Browse the user directory" },
  "org.create": { group: "Organizations", label: "Create organizations" },
  "org.edit": { group: "Organizations", label: "Edit organizations" },
  "org.delete": { group: "Organizations", label: "Delete organizations" },
  "faq.manage": { group: "Knowledge base", label: "Manage FAQs" },
  "emails.banlist": { group: "Emails", label: "Manage the email banlist" },
  "visibility.agents": { group: "Visibility", label: "See agents outside their departments" },
  "visibility.departments": { group: "Visibility", label: "See other departments" },
};

/** An agent's extra departments, teams and global permissions: three separate saves. */
export function StaffAccessEditor({ id, data }: { id: number; data: Row }) {
  const teams = useTeamsList();
  const lookups = useAdminLookups();
  const access = useSave(`/api/v1/staff/${id}`, "staff");
  const teamSave = useSave(`/api/v1/staff/${id}`, "staff");
  const permSave = useSave(`/api/v1/staff/${id}`, "staff");

  const initial = ((data.department_access as Row[]) ?? []).map((a, i): Access => ({ key: `a${i}`, id: Number(a.dept_id), role: Number(a.role_id), alerts: a.alerts !== false }));
  const [rows, setRows] = useState<Access[]>(initial);
  const [dept, setDept] = useState("");
  const [role, setRole] = useState("");
  const roleName = (rid: number) => lookups.names.roles.get(rid) ?? `#${rid}`;
  const deptName = (d: number) => lookups.names.departments.get(d) ?? `#${d}`;
  const myTeams = new Set(((data.teams as unknown[]) ?? []).map(asId));
  const held = new Set((data.permissions as string[]) ?? []);
  const permissionKeys = usePermissionKeys();
  const PERMISSIONS = (permissionKeys.data ?? [])
    .filter((p) => p.kind === "global")
    .map((p) => ({ key: p.key, label: PERMISSION_LABELS[p.key]?.label ?? p.key, group: PERMISSION_LABELS[p.key]?.group ?? "Other" }));
  const unknownHeld = permissionKeys.data ? [...held].filter((k) => !PERMISSIONS.some((p) => p.key === k)) : [];

  async function saveTeams(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    await teamSave.save({ teams: (teams.data ?? []).filter((t) => form.get(`team-${t.id}`) === "on").map((t) => t.id) }, "Teams saved.");
  }
  async function savePermissions(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    if (!permissionKeys.data) return;
    const chosen = PERMISSIONS.filter((p) => form.get(p.key) === "on").map((p) => p.key);
    await permSave.save({ permissions: [...chosen, ...unknownHeld] }, "Permissions saved.");
  }

  return (
    <>
      <Card title="Extended access" note="Other departments this agent works in, with their role there.">
        <table className="w-full text-left text-sm">
          <thead className="text-xs uppercase tracking-wide text-slate-600">
            <tr>
              <th className="py-1 pr-3 font-semibold">Department</th>
              <th className="py-1 pr-3 font-semibold">Role</th>
              <th className="py-1 pr-3 font-semibold">Alerts</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.key} className="border-t border-slate-200">
                <td className="py-1.5 pr-3">{deptName(r.id)}</td>
                <td className="py-1.5 pr-3">{roleName(r.role)}</td>
                <td className="py-1.5 pr-3">
                  <input type="checkbox" aria-label={`Alerts for ${deptName(r.id)}`} checked={r.alerts} onChange={(e) => setRows((all) => all.map((x) => (x.key === r.key ? { ...x, alerts: e.target.checked } : x)))} />
                </td>
                <td className="py-1.5 text-right">
                  <button type="button" className="text-red-800 underline" onClick={() => setRows((all) => all.filter((x) => x.key !== r.key))}>
                    Remove {deptName(r.id)}
                  </button>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={4} className="py-3 text-center text-slate-500">
                  No extended access.
                </td>
              </tr>
            )}
          </tbody>
        </table>
        <div className="flex flex-wrap items-center gap-2 border-t border-slate-200 pt-3">
          <select aria-label="Department to add" value={dept} onChange={(e) => setDept(e.target.value)} className={`${field} max-w-xs`}>
            <option value="">— Select a department —</option>
            {lookups.options.departments.filter((d) => d.value !== Number(data.dept_id) && !rows.some((r) => r.id === d.value)).map((d) => (
              <option key={d.value} value={d.value}>
                {d.label}
              </option>
            ))}
          </select>
          <select aria-label="Role" value={role} onChange={(e) => setRole(e.target.value)} className={`${field} max-w-xs`}>
            <option value="">— Select a role —</option>
            {lookups.options.roles.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
          <button
            type="button"
            className={button}
            disabled={!dept || !role}
            onClick={() => {
              setRows((all) => [...all, { key: `n${Date.now()}`, id: Number(dept), role: Number(role), alerts: true }]);
              setDept("");
            }}
          >
            Add Department
          </button>
        </div>
        <NoticeBar notice={access.notice} />
        <button type="button" disabled={access.busy} className={primary} onClick={() => { access.clear(); access.save({ department_access: rows.map((r) => ({ dept_id: r.id, role_id: r.role, alerts: r.alerts })) }, "Extended access saved."); }}>
          {access.busy ? "Saving…" : "Save Extended Access"}
        </button>
      </Card>

      <Card title="Teams">
        <form key={[...myTeams].join(",")} onSubmit={saveTeams} className="space-y-2">
          {(teams.data ?? []).map((t) => (
            <label key={t.id} className="flex items-center gap-2 text-sm">
              <input type="checkbox" name={`team-${t.id}`} defaultChecked={myTeams.has(t.id)} /> {t.name}
            </label>
          ))}
          {teams.data?.length === 0 && <p className="text-sm text-slate-500">There are no teams.</p>}
          <NoticeBar notice={teamSave.notice} />
          <button type="submit" disabled={teamSave.busy} className={primary} onClick={teamSave.clear}>
            {teamSave.busy ? "Saving…" : "Save Teams"}
          </button>
        </form>
      </Card>

      <Card title="Permissions" note="Global permissions: what the agent may do beyond the role they hold in each department.">
        <form key={[...held].join(",")} onSubmit={savePermissions} className="space-y-3">
          {[...new Set(PERMISSIONS.map((p) => p.group))].map((group) => (
            <fieldset key={group} className="space-y-1">
              <legend className="text-xs font-semibold uppercase tracking-wide text-slate-600">{group}</legend>
              {PERMISSIONS.filter((p) => p.group === group).map((p) => (
                <label key={p.key} className="flex items-center gap-2 text-sm">
                  <input type="checkbox" name={p.key} defaultChecked={held.has(p.key)} /> {p.label}
                </label>
              ))}
            </fieldset>
          ))}
          {unknownHeld.length > 0 && <p className="text-xs text-slate-500">Also held, and kept: {unknownHeld.join(", ")}.</p>}
          <NoticeBar notice={permSave.notice} />
          <button type="submit" disabled={permSave.busy} className={primary} onClick={permSave.clear}>
            {permSave.busy ? "Saving…" : "Save Permissions"}
          </button>
        </form>
      </Card>
    </>
  );
}

/** The forms attached to a help topic. The ticket form always stays; this lists the others. */
export function TopicFormsEditor({ id, data }: { id: number; data: Row }) {
  const forms = useFormsList();
  const { busy, notice, clear, save } = useSave(`/api/v1/topics/${id}`, "topics");
  const attached = new Set(((data.form_ids as number[]) ?? []).map(Number));
  const attachable = (forms.data ?? []).filter((f) => f.type !== "T" && f.type !== "L1" && f.type !== "C" && f.type !== "U" && f.type !== "O" && f.type !== "A");

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const ticketForms = (forms.data ?? []).filter((f) => f.type === "T").map((f) => f.id);
    const chosen = attachable.filter((f) => form.get(`form-${f.id}`) === "on").map((f) => f.id);
    await save({ form_ids: [...ticketForms, ...chosen] }, "Forms saved.");
  }

  return (
    <Card title="Custom forms" note="The ticket form always stays. A form listed here asks its questions when a ticket is opened under this topic.">
      <form key={[...attached].join(",")} onSubmit={submit} className="space-y-2">
        {attachable.map((f) => (
          <label key={f.id} className="flex items-center gap-2 text-sm">
            <input type="checkbox" name={`form-${f.id}`} defaultChecked={attached.has(f.id)} /> {f.title}
          </label>
        ))}
        {forms.data && attachable.length === 0 && <p className="text-sm text-slate-500">There are no custom forms to attach. Create one under Manage, Forms.</p>}
        <NoticeBar notice={notice} />
        <button type="submit" disabled={busy || attachable.length === 0} className={primary} onClick={clear}>
          {busy ? "Saving…" : "Save Forms"}
        </button>
      </form>
    </Card>
  );
}

type ListEntry = { id: number; value: string; abbrev: string | null; sort: number; is_enabled: boolean; is_internal: boolean };

/** The items of a custom list: add, rename, enable or disable, remove. A list osTicket manages itself is shown read-only. */
export function ListItemsEditor({ id, data }: { id: number; data: Row }) {
  const editable = data.is_editable === true;
  const items = useQuery({
    queryKey: ["admin", "lists", "items", id],
    queryFn: () => getJson<{ items: ListEntry[] }>(`/api/v1/lists/${id}/items?page_size=200`),
  });
  const { run, busy, notice, clear } = useRunner(`/api/v1/lists/${id}/items`, ["admin", "lists"]);
  const [version, setVersion] = useState(0);

  async function add(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const value = String(form.get("value") ?? "").trim();
    const abbrev = String(form.get("abbrev") ?? "").trim();
    const sort = String(form.get("sort") ?? "").trim();
    if (!value) return;
    if (await run("", { value, ...(abbrev ? { abbrev } : {}), ...(sort ? { sort: Number(sort) } : {}) }, `${value} added.`, "POST")) setVersion((v) => v + 1);
  }

  return (
    <Card title="List items" note={editable ? undefined : "osTicket manages this list itself; its items are not edited here."}>
      <NoticeBar notice={notice} />
      {items.error && <p role="alert" className="text-sm text-red-700">{items.error.message}</p>}
      <table className="w-full text-left text-sm">
        <thead className="text-xs uppercase tracking-wide text-slate-600">
          <tr>
            <th className="py-1 pr-3 font-semibold">Value</th>
            <th className="py-1 pr-3 font-semibold">Abbreviation</th>
            <th className="py-1 pr-3 font-semibold">Sort</th>
            <th className="py-1 pr-3 font-semibold">Enabled</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {items.data?.items.map((i) => (
            <tr key={i.id} className="border-t border-slate-200">
              <td className="py-1.5 pr-3">
                {i.value}
                {i.is_internal && <span className="ml-1 text-xs text-slate-500">(internal)</span>}
              </td>
              <td className="py-1.5 pr-3">{i.abbrev}</td>
              <td className="py-1.5 pr-3">{i.sort}</td>
              <td className="py-1.5 pr-3">
                <input
                  type="checkbox"
                  aria-label={`${i.value} is enabled`}
                  checked={i.is_enabled}
                  disabled={busy || !editable}
                  onChange={(e) => run(String(i.id), { is_enabled: e.target.checked }, `${i.value} ${e.target.checked ? "enabled" : "disabled"}.`, "PATCH")}
                />
              </td>
              <td className="py-1.5 text-right">
                {editable && (
                  <button type="button" disabled={busy} className="text-red-800 underline disabled:opacity-50" onClick={() => run(String(i.id), {}, `${i.value} removed.`, "DELETE")}>
                    Remove {i.value}
                  </button>
                )}
              </td>
            </tr>
          ))}
          {items.data?.items.length === 0 && (
            <tr>
              <td colSpan={5} className="py-3 text-center text-slate-500">
                This list has no items.
              </td>
            </tr>
          )}
        </tbody>
      </table>
      {editable && (
        <form key={version} onSubmit={add} className="flex flex-wrap items-center gap-2 border-t border-slate-200 pt-3" aria-label="Add item">
          <input name="value" aria-label="Item value" required placeholder="Value" className={`${field} max-w-xs`} />
          <input name="abbrev" aria-label="Abbreviation" placeholder="Abbreviation" className={`${field} max-w-40`} />
          <input name="sort" aria-label="Sort number" type="number" placeholder="Sort" className={`${field} max-w-28`} />
          <button type="submit" disabled={busy} className={primary} onClick={clear}>
            Add Item
          </button>
        </form>
      )}
    </Card>
  );
}

type ScheduleEntry = { id: number; name: string; description: string; repeats: string; starts_on: string };
const REPEATS = ["never", "daily", "weekly", "weekdays", "weekends", "monthly", "yearly"];

/** A schedule's entries: osTicket's own sentence for each, add and remove. (An entry is replaced whole by the API; to change one, remove and add it.) */
export function ScheduleEntriesEditor({ id, data }: { id: number; data: Row }) {
  const entries = (data.entries as ScheduleEntry[]) ?? [];
  const { run, busy, notice, clear } = useRunner(`/api/v1/schedules/${id}/entries`, ["admin", "schedules"]);
  const [version, setVersion] = useState(0);
  const [repeats, setRepeats] = useState("never");
  const [allDay, setAllDay] = useState(true);

  async function add(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const t = (n: string) => String(f.get(n) ?? "").trim();
    const num = (n: string) => (t(n) ? Number(t(n)) : undefined);
    const body = {
      name: t("name"),
      repeats,
      starts_on: t("starts_on"),
      all_day: allDay,
      ...(!allDay && t("starts_at") ? { starts_at: t("starts_at") } : {}),
      ...(!allDay && t("ends_at") ? { ends_at: t("ends_at") } : {}),
      ...(t("stops_on") ? { stops_on: t("stops_on") } : {}),
      ...(num("day") ? { day: num("day") } : {}),
      ...(num("week") ? { week: num("week") } : {}),
      ...(num("month") ? { month: num("month") } : {}),
    };
    if (await run("", body, `${body.name} added.`, "POST")) setVersion((v) => v + 1);
  }

  return (
    <Card title="Entries" note="osTicket's rules apply: unique names, one daily entry excludes others, no overlapping weekday entries. Weekly takes a day 1-7 (Mon-Sun); monthly and yearly repeat on the start date, or on the n-th weekday (week 1-5 or -1 for the last, with a day).">
      <NoticeBar notice={notice} />
      <ul className="text-sm" aria-label="Schedule entries">
        {entries.map((en) => (
          <li key={en.id} className="flex items-center justify-between gap-3 border-b border-slate-200 py-1.5">
            <span>
              <strong>{en.name}</strong> <span className="text-slate-600">— {en.description}</span>
            </span>
            <button type="button" disabled={busy} className="text-red-800 underline" onClick={() => run(String(en.id), {}, `${en.name} removed.`, "DELETE")}>
              Remove {en.name}
            </button>
          </li>
        ))}
        {entries.length === 0 && <li className="py-1 text-slate-500">This schedule has no entries.</li>}
      </ul>
      <form key={version} onSubmit={add} className="grid gap-2 border-t border-slate-200 pt-3 sm:grid-cols-2" aria-label="Add entry">
        <input name="name" aria-label="Entry name" required placeholder="Name" className={field} />
        <select aria-label="Repeats" value={repeats} onChange={(e) => setRepeats(e.target.value)} className={field}>
          {REPEATS.map((r) => (
            <option key={r}>{r}</option>
          ))}
        </select>
        <label className="flex items-center gap-2 text-sm">
          Starts on <input name="starts_on" aria-label="Starts on" type="date" required className={field} />
        </label>
        <label className="flex items-center gap-2 text-sm">
          Stops on <input name="stops_on" aria-label="Stops on" type="date" className={field} />
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={allDay} onChange={(e) => setAllDay(e.target.checked)} /> All day
        </label>
        {!allDay && (
          <div className="flex gap-2">
            <input name="starts_at" aria-label="From" type="time" className={field} />
            <input name="ends_at" aria-label="To" type="time" className={field} />
          </div>
        )}
        <input name="day" aria-label="Day (1-7)" type="number" placeholder="Day 1-7" className={field} />
        <input name="week" aria-label="Week (1-5, -1 last)" type="number" placeholder="Week 1-5 or -1" className={field} />
        <input name="month" aria-label="Month (1-12)" type="number" placeholder="Month 1-12" className={field} />
        <button type="submit" disabled={busy} className={primary} onClick={clear}>
          Add Entry
        </button>
      </form>
    </Card>
  );
}

type TemplateMessage = { code_name: string; name: string; group: string; description: string; defined: boolean; subject: string };

/** An email template set's messages: all 19 osTicket knows, with the ones the set has no copy of marked; edit a copy's subject and body. */
export function TemplateMessagesEditor({ id, data }: { id: number; data: Row }) {
  const messages = (data.messages as TemplateMessage[]) ?? [];
  const [open, setOpen] = useState<string | null>(null);
  const body = useQuery({
    queryKey: ["admin", "templates", "message", id, open],
    enabled: open != null,
    queryFn: () => getJson<{ subject: string; body: string }>(`/api/v1/email-templates/${id}/messages/${open}`),
  });
  const { run, busy, notice, clear } = useRunner(`/api/v1/email-templates/${id}/messages`, ["admin", "templates"]);

  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    if (await run(String(open), { subject: String(f.get("subject") ?? ""), body: String(f.get("body") ?? "") }, "Message saved.", "PUT")) setOpen(null);
  }

  return (
    <Card title="Messages" note="A message the set has no copy of uses osTicket's built-in text until it is saved here.">
      <NoticeBar notice={notice} />
      <ul className="text-sm" aria-label="Template messages">
        {messages.map((m) => (
          <li key={m.code_name} className="border-b border-slate-200 py-1.5">
            <div className="flex items-center justify-between gap-3">
              <span>
                <span className="text-xs uppercase text-slate-500">{m.group}</span> <strong>{m.name}</strong>{" "}
                <span className="text-slate-600">{m.defined ? m.subject : "(built-in text)"}</span>
              </span>
              <button type="button" className="text-sky-800 underline" aria-expanded={open === m.code_name} onClick={() => { clear(); setOpen(open === m.code_name ? null : m.code_name); }}>
                {open === m.code_name ? "Close" : "Edit"} {m.name}
              </button>
            </div>
            {open === m.code_name && (
              <form key={body.data ? "loaded" : "loading"} onSubmit={save} className="mt-2 space-y-2" aria-label={`Edit ${m.name}`}>
                <p className="text-xs text-slate-500">{m.description}</p>
                {body.isLoading ? (
                  <p className="text-slate-500">Loading…</p>
                ) : (
                  <>
                    <input name="subject" aria-label="Subject" required defaultValue={body.data?.subject ?? ""} className={field} />
                    <textarea name="body" aria-label="Body" required rows={10} defaultValue={body.data?.body ?? ""} className={`${field} font-mono`} />
                    <button type="submit" disabled={busy} className={primary}>
                      {busy ? "Saving…" : "Save Message"}
                    </button>
                  </>
                )}
              </form>
            )}
          </li>
        ))}
      </ul>
    </Card>
  );
}
