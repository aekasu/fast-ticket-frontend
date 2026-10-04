import { formatDateTime } from "@/lib/format";
import type { AdminLookups } from "@/lib/queries/admin-lookups";

export type Row = Record<string, unknown>;
type Lk = AdminLookups;

export interface Column {
  label: string;
  value: (item: Row, lk: Lk) => string;
}

export type FieldKind = "text" | "email" | "password" | "textarea" | "number" | "bool" | "select";

export interface FieldDef {
  name: string;
  label: string;
  kind: FieldKind;
  required?: boolean;
  /** Where the field appears: only when creating, only when editing, or both (the default). */
  on?: "create" | "edit";
  /** For a select: the lookup the options come from, or fixed string options. */
  optionsFrom?: keyof Lk["options"];
  options?: { value: string; label: string }[];
  /** What a select's "— None —" sends: null or 0 (osTicket uses both for "no foreign key"). */
  none?: null | 0;
  help?: string;
  /** The value of a boolean on a new record. */
  defaultChecked?: boolean;
}

export interface Section {
  title: string;
  headers: string[];
  rows: (d: Row, lk: Lk) => string[][];
}

export interface ResourceDef {
  key: string;
  title: string;
  singular: string;
  path: string;
  name: (d: Row) => string;
  columns: Column[];
  /** What osTicket's list shows that the list endpoint does not carry. */
  listNote?: string;
  info: [string, (d: Row, lk: Lk) => string][];
  fields: FieldDef[];
  sections?: Section[];
  canCreate?: boolean;
  canDelete?: (d: Row) => boolean;
  /** osTicket's list page, for tests. */
  osticketPage?: string;
}

const s = (v: unknown) => (v == null ? "" : String(v));
const yes = (v: unknown) => (v ? "Yes" : "No");
const date = (v: unknown) => (typeof v === "string" ? formatDateTime(v) : "");
const fullName = (r: Row) => `${s(r.firstname)} ${s(r.lastname)}`.trim();
const active = (v: unknown) => (v ? "Active" : "Disabled");
const kind = (v: unknown) => (v ? "Public" : "Private");
const lookup = (m: Map<number, string>, id: unknown) => (id ? (m.get(Number(id)) ?? `#${id}`) : "");

const STATUS = [
  { value: "active", label: "Active" },
  { value: "disabled", label: "Disabled" },
];

export const RESOURCES: Record<string, ResourceDef> = {
  staff: {
    key: "staff",
    title: "Agents",
    singular: "agent",
    path: "/api/v1/staff",
    osticketPage: "staff.php",
    name: fullName,
    columns: [
      { label: "Name", value: fullName },
      { label: "Username", value: (r) => s(r.username) },
      { label: "Status", value: (r) => active(r.is_active) },
      { label: "Department", value: (r, lk) => lookup(lk.names.departments, r.dept_id) },
      { label: "Created", value: (r) => date(r.created) },
    ],
    listNote: "osTicket's Last Login column is not available through the API.",
    info: [
      ["Name", fullName],
      ["Username", (r) => s(r.username)],
      ["Email", (r) => s(r.email)],
      ["Status", (r) => active(r.is_active)],
      ["Administrator", (r) => yes(r.is_admin)],
      ["Department", (r, lk) => lookup(lk.names.departments, r.dept_id)],
      ["Primary Role ID", (r) => s(r.role_id)],
      ["Listed in directory", (r) => yes(r.is_visible)],
      ["On vacation", (r) => yes(r.on_vacation)],
      ["Limited access", (r) => (r.assigned_only ? "Only tickets assigned to them" : "No")],
      ["Phone", (r) => [s(r.phone), s(r.phone_ext) && `x${s(r.phone_ext)}`].filter(Boolean).join(" ")],
      ["Mobile", (r) => s(r.mobile)],
      ["Created", (r) => date(r.created)],
      ["Notes", (r) => s(r.notes)],
    ],
    fields: [
      { name: "username", label: "Username", kind: "text", required: true },
      { name: "firstname", label: "First Name", kind: "text", required: true },
      { name: "lastname", label: "Last Name", kind: "text", required: true },
      { name: "email", label: "Email Address", kind: "email", required: true },
      { name: "password", label: "Password", kind: "password", required: true, on: "create" },
      { name: "password", label: "New Password", kind: "password", on: "edit", help: "Leave empty to keep the current password." },
      { name: "dept_id", label: "Primary Department", kind: "select", optionsFrom: "departments", required: true },
      { name: "role_id", label: "Primary Role ID", kind: "number", required: true, help: "Roles cannot be listed through the API yet: enter the role's ID (1 = the administrator's)." },
      { name: "phone", label: "Phone Number", kind: "text" },
      { name: "phone_ext", label: "Extension", kind: "text" },
      { name: "mobile", label: "Mobile Number", kind: "text" },
      { name: "is_active", label: "Account is active", kind: "bool", defaultChecked: true },
      { name: "is_admin", label: "Administrator", kind: "bool" },
      { name: "is_visible", label: "Listed in the agent directory", kind: "bool", defaultChecked: true },
      { name: "on_vacation", label: "On vacation", kind: "bool" },
      { name: "assigned_only", label: "Limit access to tickets assigned to them", kind: "bool" },
      { name: "notes", label: "Internal Notes", kind: "textarea" },
    ],
    sections: [
      {
        title: "Extended access",
        headers: ["Department", "Role ID", "Alerts"],
        rows: (d, lk) => ((d.department_access as Row[]) ?? []).map((a) => [lookup(lk.names.departments, a.dept_id), s(a.role_id), yes(a.alerts)]),
      },
      { title: "Teams", headers: ["Team ID"], rows: (d) => ((d.teams as unknown[]) ?? []).map((t) => [typeof t === "object" ? s((t as Row).team_id ?? (t as Row).id) : s(t)]) },
      { title: "Permissions", headers: ["Permission"], rows: (d) => ((d.permissions as string[]) ?? []).map((p) => [p]) },
    ],
    canDelete: (d) => d.id !== 1,
  },

  teams: {
    key: "teams",
    title: "Teams",
    singular: "team",
    path: "/api/v1/teams",
    osticketPage: "teams.php",
    name: (r) => s(r.name),
    columns: [
      { label: "Team Name", value: (r) => s(r.name) },
      { label: "Status", value: (r) => (r.is_enabled ? "Active" : "Disabled") },
      { label: "Created", value: (r) => date(r.created) },
      { label: "Last Updated", value: (r) => date(r.updated) },
    ],
    listNote: "osTicket's Members count and Team Lead columns are not in the list endpoint.",
    info: [
      ["Team Name", (r) => s(r.name)],
      ["Status", (r) => (r.is_enabled ? "Active" : "Disabled")],
      ["Team Lead", (r, lk) => lookup(lk.names.agents, r.lead_id)],
      ["Alerts", (r) => (r.no_alerts ? "Do not send alerts to the team" : "Alert the team")],
      ["Created", (r) => date(r.created)],
      ["Last Updated", (r) => date(r.updated)],
      ["Notes", (r) => s(r.notes)],
    ],
    fields: [
      { name: "name", label: "Team Name", kind: "text", required: true },
      { name: "is_enabled", label: "Team is enabled", kind: "bool", defaultChecked: true },
      { name: "lead_id", label: "Team Lead", kind: "select", optionsFrom: "agents", none: null },
      { name: "no_alerts", label: "Do not send alerts to the team", kind: "bool" },
      { name: "notes", label: "Internal Notes", kind: "textarea" },
    ],
    sections: [
      { title: "Members", headers: ["Agent"], rows: (d, lk) => ((d.members as unknown[]) ?? []).map((m) => [typeof m === "object" ? lookup(lk.names.agents, (m as Row).staff_id ?? (m as Row).id) : lookup(lk.names.agents, m)]) },
    ],
  },

  departments: {
    key: "departments",
    title: "Departments",
    singular: "department",
    path: "/api/v1/departments",
    osticketPage: "departments.php",
    name: (r) => s(r.name),
    columns: [
      { label: "Name", value: (r) => s(r.name) },
      { label: "Type", value: (r) => kind(r.is_public) },
      { label: "Created", value: (r) => date(r.created) },
    ],
    listNote: "osTicket's Status, Agents, Email Address and Manager columns are not in the list endpoint.",
    info: [
      ["Name", (r) => s(r.name)],
      ["Status", (r) => (s(r.status) === "active" ? "Active" : s(r.status))],
      ["Type", (r) => kind(r.is_public)],
      ["Parent", (r, lk) => lookup(lk.names.departments, r.parent_id)],
      ["Manager", (r, lk) => lookup(lk.names.agents, r.manager_id)],
      ["SLA Plan", (r, lk) => lookup(lk.names.slas, r.sla_id)],
      ["Auto-response to new tickets", (r) => yes(r.ticket_auto_response)],
      ["Auto-response to new messages", (r) => yes(r.message_auto_response)],
      ["Ticket assignment", (r) => s(r.assignment)],
      ["Alerts to", (r) => s(r.alerts_to)],
      ["Signature", (r) => s(r.signature)],
    ],
    fields: [
      { name: "name", label: "Name", kind: "text", required: true },
      { name: "status", label: "Status", kind: "select", options: STATUS },
      { name: "is_public", label: "Public department", kind: "bool", defaultChecked: true },
      { name: "parent_id", label: "Parent Department", kind: "select", optionsFrom: "departments", none: null },
      { name: "manager_id", label: "Manager", kind: "select", optionsFrom: "agents", none: 0 },
      { name: "sla_id", label: "SLA Plan", kind: "select", optionsFrom: "slas", none: 0 },
      { name: "ticket_auto_response", label: "Send an auto-response when a ticket is opened", kind: "bool", defaultChecked: true },
      { name: "message_auto_response", label: "Send an auto-response when a message is posted", kind: "bool", defaultChecked: true },
      { name: "signature", label: "Department Signature", kind: "textarea" },
    ],
    sections: [
      { title: "Agents", headers: ["Agent"], rows: (d, lk) => ((d.members as unknown[]) ?? []).map((m) => [typeof m === "object" ? lookup(lk.names.agents, (m as Row).staff_id ?? (m as Row).id) : lookup(lk.names.agents, m)]) },
    ],
    canDelete: (d) => d.id !== 1,
  },

  topics: {
    key: "topics",
    title: "Help Topics",
    singular: "help topic",
    path: "/api/v1/topics",
    osticketPage: "helptopics.php",
    name: (r) => s(r.topic),
    columns: [
      { label: "Help Topic", value: (r) => s(r.topic) },
      { label: "Status", value: (r) => active(r.is_active) },
      { label: "Type", value: (r) => kind(r.is_public) },
      { label: "Last Updated", value: (r) => date(r.updated) },
      { label: "Created", value: (r) => date(r.created) },
    ],
    listNote: "osTicket's Priority and Department columns are not in the list endpoint.",
    info: [
      ["Help Topic", (r) => s(r.topic)],
      ["Status", (r) => (s(r.status) === "active" ? "Active" : s(r.status))],
      ["Type", (r) => kind(r.is_public)],
      ["Priority", (r, lk) => lookup(lk.names.priorities, r.priority_id)],
      ["Department", (r, lk) => lookup(lk.names.departments, r.dept_id)],
      ["SLA Plan", (r, lk) => lookup(lk.names.slas, r.sla_id)],
      ["Auto-assign to", (r, lk) => lookup(lk.names.agents, r.assign_staff_id)],
      ["Auto-response", (r) => (r.no_auto_response ? "Disabled" : "Enabled")],
      ["Custom form IDs", (r) => ((r.form_ids as number[]) ?? []).join(", ")],
      ["Notes", (r) => s(r.notes)],
    ],
    fields: [
      { name: "topic", label: "Help Topic", kind: "text", required: true },
      { name: "status", label: "Status", kind: "select", options: STATUS },
      { name: "is_public", label: "Public topic", kind: "bool", defaultChecked: true },
      { name: "priority_id", label: "Priority", kind: "select", optionsFrom: "priorities", none: 0 },
      { name: "dept_id", label: "Department", kind: "select", optionsFrom: "departments", none: 0 },
      { name: "sla_id", label: "SLA Plan", kind: "select", optionsFrom: "slas", none: 0 },
      { name: "assign_staff_id", label: "Auto-assign to agent", kind: "select", optionsFrom: "agents", none: 0 },
      { name: "no_auto_response", label: "Disable the auto-response", kind: "bool" },
      { name: "notes", label: "Admin Notes", kind: "textarea" },
    ],
  },

  slas: {
    key: "slas",
    title: "Service Level Agreements",
    singular: "SLA plan",
    path: "/api/v1/slas",
    osticketPage: "slas.php",
    name: (r) => s(r.name),
    columns: [
      { label: "Name", value: (r) => s(r.name) },
      { label: "Status", value: (r) => active(r.is_active) },
      { label: "Grace Period (hrs)", value: (r) => s(r.grace_period) },
      { label: "Date Added", value: (r) => date(r.created) },
      { label: "Last Updated", value: (r) => date(r.updated) },
    ],
    info: [
      ["Name", (r) => s(r.name)],
      ["Status", (r) => active(r.is_active)],
      ["Grace Period (hrs)", (r) => s(r.grace_period)],
      ["Transient", (r) => yes(r.transient)],
      ["Overdue alerts", (r) => (r.disable_overdue_alerts ? "Disabled" : "Enabled")],
      ["Notes", (r) => s(r.notes)],
    ],
    fields: [
      { name: "name", label: "Name", kind: "text", required: true },
      { name: "grace_period", label: "Grace Period (hours)", kind: "number", required: true },
      { name: "is_active", label: "Plan is active", kind: "bool", defaultChecked: true },
      { name: "transient", label: "Transient: the due date is reset when the ticket is reopened", kind: "bool" },
      { name: "disable_overdue_alerts", label: "Disable overdue alerts", kind: "bool" },
      { name: "notes", label: "Admin Notes", kind: "textarea" },
    ],
  },

  banlist: {
    key: "banlist",
    title: "Banned Email Addresses",
    singular: "ban rule",
    path: "/api/v1/banlist",
    osticketPage: "banlist.php",
    name: (r) => s(r.val),
    columns: [
      { label: "Email Address", value: (r) => s(r.val) },
      { label: "Status", value: (r) => (r.is_active ? "Active" : "Disabled") },
      { label: "Date Added", value: (r) => date(r.created) },
      { label: "Last Updated", value: (r) => date(r.updated) },
    ],
    info: [
      ["Email Address", (r) => s(r.val)],
      ["Status", (r) => (r.is_active ? "Active" : "Disabled")],
      ["Date Added", (r) => date(r.created)],
      ["Notes", (r) => s(r.notes)],
    ],
    fields: [
      { name: "val", label: "Email Address", kind: "text", required: true, help: "An address, or a domain such as @example.com." },
      { name: "is_active", label: "Rule is active", kind: "bool", defaultChecked: true },
      { name: "notes", label: "Admin Notes", kind: "textarea" },
    ],
  },

  priorities: {
    key: "priorities",
    title: "Ticket Priorities",
    singular: "priority",
    path: "/api/v1/priorities",
    name: (r) => s(r.desc) || s(r.name),
    columns: [
      { label: "Priority", value: (r) => s(r.desc) },
      { label: "Name", value: (r) => s(r.name) },
      { label: "Urgency", value: (r) => s(r.urgency) },
      { label: "Type", value: (r) => kind(r.is_public) },
    ],
    info: [
      ["Priority", (r) => s(r.desc)],
      ["Name", (r) => s(r.name)],
      ["Urgency", (r) => s(r.urgency)],
      ["Type", (r) => kind(r.is_public)],
    ],
    fields: [
      { name: "name", label: "Name", kind: "text", required: true },
      { name: "desc", label: "Description", kind: "text" },
      { name: "urgency", label: "Urgency", kind: "number", help: "1 is the most urgent." },
      { name: "is_public", label: "Public priority", kind: "bool", defaultChecked: true },
    ],
  },

  forms: {
    key: "forms",
    title: "Custom Forms",
    singular: "form",
    path: "/api/v1/forms",
    osticketPage: "forms.php",
    name: (r) => s(r.title),
    columns: [
      { label: "Title", value: (r) => s(r.title) },
      { label: "Type", value: (r) => s(r.type) },
      { label: "Last Updated", value: (r) => date(r.updated) },
    ],
    info: [
      ["Title", (r) => s(r.title)],
      ["Type", (r) => s(r.type)],
      ["Deletable", (r) => yes(r.is_deletable)],
      ["Instructions", (r) => s(r.instructions)],
      ["Notes", (r) => s(r.notes)],
    ],
    fields: [
      { name: "title", label: "Title", kind: "text", required: true },
      { name: "instructions", label: "Instructions", kind: "textarea" },
      { name: "notes", label: "Internal Notes", kind: "textarea" },
    ],
    sections: [
      {
        title: "Fields",
        headers: ["Label", "Variable", "Type", "Required"],
        rows: (d) => ((d.fields as Row[]) ?? []).map((f) => [s(f.label), s(f.name), s(f.type), yes(f.required)]),
      },
    ],
    // Forms are created and their fields edited through osTicket's builder; the API edits only the form's text.
    canCreate: false,
    canDelete: () => false,
  },
};
