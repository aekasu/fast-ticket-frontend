"use client";

import { useState } from "react";
import { type Row } from "@/lib/admin/resources";
import { knownRoleIds, useAdminLookups, useFormsList, useStaffList, useTeamsList } from "@/lib/queries/admin-lookups";
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
  const staff = useStaffList();
  const lookups = useAdminLookups();
  const { busy, notice, clear, save } = useSave(`/api/v1/departments/${id}`, "departments");
  const initial = ((data.members as Row[]) ?? []).map((m, i): Access => ({ key: `m${i}`, id: Number(m.staff_id), role: Number(m.role_id), alerts: m.alerts !== false }));
  const [rows, setRows] = useState<Access[]>(initial);
  const [agent, setAgent] = useState("");
  const [role, setRole] = useState("");
  const roles = knownRoleIds(staff.data ?? [], rows.map((r) => r.role));
  const name = (sid: number) => lookups.names.agents.get(sid) ?? `#${sid}`;

  function add() {
    if (!agent || !role || rows.some((r) => r.id === Number(agent))) return;
    setRows((r) => [...r, { key: `n${Date.now()}`, id: Number(agent), role: Number(role), alerts: true }]);
    setAgent("");
  }

  return (
    <Card title="Extended access" note="Agents whose primary department is another one, and who also work here. Roles cannot be listed through the API: the ids already in use are offered.">
      <table className="w-full text-left text-sm">
        <thead className="text-xs uppercase tracking-wide text-slate-600">
          <tr>
            <th className="py-1 pr-3 font-semibold">Agent</th>
            <th className="py-1 pr-3 font-semibold">Role ID</th>
            <th className="py-1 pr-3 font-semibold">Alerts</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.key} className="border-t border-slate-200">
              <td className="py-1.5 pr-3">{name(r.id)}</td>
              <td className="py-1.5 pr-3">{r.role}</td>
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
        <input aria-label="Role ID" list="role-ids" type="number" min={1} value={role} onChange={(e) => setRole(e.target.value)} placeholder="Role ID" className={`${field} max-w-28`} />
        <datalist id="role-ids">
          {roles.map((r) => (
            <option key={r} value={r} />
          ))}
        </datalist>
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

// osTicket's global agent permissions, as the API lists them for the administrator. Keys the agent already holds that
// are not in this list are kept as they are.
const PERMISSIONS: { key: string; label: string; group: string }[] = [
  { group: "Users", key: "user.create", label: "Create users" },
  { group: "Users", key: "user.edit", label: "Edit users" },
  { group: "Users", key: "user.delete", label: "Delete users" },
  { group: "Users", key: "user.manage", label: "Manage user accounts" },
  { group: "Users", key: "user.dir", label: "Browse the user directory" },
  { group: "Organizations", key: "org.create", label: "Create organizations" },
  { group: "Organizations", key: "org.edit", label: "Edit organizations" },
  { group: "Organizations", key: "org.delete", label: "Delete organizations" },
  { group: "Knowledge base", key: "faq.manage", label: "Manage FAQs" },
  { group: "Emails", key: "emails.banlist", label: "Manage the email banlist" },
  { group: "Visibility", key: "visibility.agents", label: "See agents outside their departments" },
  { group: "Visibility", key: "visibility.departments", label: "See other departments" },
];

/** An agent's extra departments, teams and global permissions: three separate saves. */
export function StaffAccessEditor({ id, data }: { id: number; data: Row }) {
  const staff = useStaffList();
  const teams = useTeamsList();
  const lookups = useAdminLookups();
  const access = useSave(`/api/v1/staff/${id}`, "staff");
  const teamSave = useSave(`/api/v1/staff/${id}`, "staff");
  const permSave = useSave(`/api/v1/staff/${id}`, "staff");

  const initial = ((data.department_access as Row[]) ?? []).map((a, i): Access => ({ key: `a${i}`, id: Number(a.dept_id), role: Number(a.role_id), alerts: a.alerts !== false }));
  const [rows, setRows] = useState<Access[]>(initial);
  const [dept, setDept] = useState("");
  const [role, setRole] = useState("");
  const roles = knownRoleIds(staff.data ?? [], rows.map((r) => r.role));
  const deptName = (d: number) => lookups.names.departments.get(d) ?? `#${d}`;
  const myTeams = new Set(((data.teams as unknown[]) ?? []).map(asId));
  const held = new Set((data.permissions as string[]) ?? []);
  const unknownHeld = [...held].filter((k) => !PERMISSIONS.some((p) => p.key === k));

  async function saveTeams(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    await teamSave.save({ teams: (teams.data ?? []).filter((t) => form.get(`team-${t.id}`) === "on").map((t) => t.id) }, "Teams saved.");
  }
  async function savePermissions(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const chosen = PERMISSIONS.filter((p) => form.get(p.key) === "on").map((p) => p.key);
    await permSave.save({ permissions: [...chosen, ...unknownHeld] }, "Permissions saved.");
  }

  return (
    <>
      <Card title="Extended access" note="Other departments this agent works in, with their role there. Roles cannot be listed through the API: the ids already in use are offered.">
        <table className="w-full text-left text-sm">
          <thead className="text-xs uppercase tracking-wide text-slate-600">
            <tr>
              <th className="py-1 pr-3 font-semibold">Department</th>
              <th className="py-1 pr-3 font-semibold">Role ID</th>
              <th className="py-1 pr-3 font-semibold">Alerts</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.key} className="border-t border-slate-200">
                <td className="py-1.5 pr-3">{deptName(r.id)}</td>
                <td className="py-1.5 pr-3">{r.role}</td>
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
          <input aria-label="Role ID" list="role-ids-staff" type="number" min={1} value={role} onChange={(e) => setRole(e.target.value)} placeholder="Role ID" className={`${field} max-w-28`} />
          <datalist id="role-ids-staff">
            {roles.map((r) => (
              <option key={r} value={r} />
            ))}
          </datalist>
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
