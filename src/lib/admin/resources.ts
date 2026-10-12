import { formatDateTime } from "@/lib/format";
import type { AdminLookups } from "@/lib/queries/admin-lookups";

export type Row = Record<string, unknown>;
type Lk = AdminLookups;

export interface Column {
  label: string;
  value: (item: Row, lk: Lk) => string;
}

export type FieldKind = "text" | "email" | "password" | "textarea" | "number" | "bool" | "select" | "permissions";

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
  /** The control is disabled (and not sent) on a record for which this is true: osTicket keeps it fixed. */
  lockedWhen?: (d: Row) => boolean;
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
  /** Where the list is read from, when it differs from `path` (the records are written at `path`). */
  listPath?: string;
  name: (d: Row) => string;
  columns: Column[];
  /** What osTicket's list shows that the list endpoint does not carry. */
  listNote?: string;
  info: [string, (d: Row, lk: Lk) => string][];
  fields: FieldDef[];
  sections?: Section[];
  /** Sent with a new record's form values (a custom form is always type "G"). */
  createDefaults?: Record<string, unknown>;
  canCreate?: boolean;
  canDelete?: (d: Row) => boolean;
  /** osTicket's list page, for tests. */
  osticketPage?: string;
  /** The API only lists these (no per-record read, create, edit or delete): rows are not links. */
  listOnly?: boolean;
}

const s = (v: unknown) => (v == null ? "" : String(v));
const cap = (v: unknown) => s(v).replace(/^./, (c) => c.toUpperCase());
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
      { label: "Last Login", value: (r) => date(r.last_login) },
      { label: "Created", value: (r) => date(r.created) },
    ],
    info: [
      ["Name", fullName],
      ["Username", (r) => s(r.username)],
      ["Email", (r) => s(r.email)],
      ["Status", (r) => active(r.is_active)],
      ["Administrator", (r) => yes(r.is_admin)],
      ["Department", (r, lk) => lookup(lk.names.departments, r.dept_id)],
      ["Primary Role", (r, lk) => lookup(lk.names.roles, r.role_id)],
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
      { name: "role_id", label: "Primary Role", kind: "select", optionsFrom: "roles", required: true },
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
    // Extended access, teams and permissions are edited by StaffAccessEditor.
    canDelete: (d) => d.id !== 1,
  },

  roles: {
    key: "roles",
    title: "Roles",
    singular: "role",
    path: "/api/v1/roles",
    osticketPage: "roles.php",
    name: (r) => s(r.name),
    columns: [
      { label: "Name", value: (r) => s(r.name) },
      { label: "Status", value: (r) => (r.enabled ? "Enabled" : "Disabled") },
      { label: "Permissions", value: (r) => String(((r.permissions as unknown[]) ?? []).length) },
      { label: "In use", value: (r) => s(r.in_use) },
      { label: "Created", value: (r) => date(r.created) },
      { label: "Last Updated", value: (r) => date(r.updated) },
    ],
    info: [
      ["Name", (r) => s(r.name)],
      ["Status", (r) => (r.enabled ? "Enabled" : "Disabled")],
      ["In use", (r) => (r.in_use ? `Yes (${s(r.in_use)})` : "No")],
      ["Created", (r) => date(r.created)],
      ["Last Updated", (r) => date(r.updated)],
      ["Permissions", (r) => ((r.permissions as string[]) ?? []).join(", ")],
      ["Notes", (r) => s(r.notes)],
    ],
    fields: [
      { name: "name", label: "Name", kind: "text", required: true },
      { name: "enabled", label: "Role is enabled", kind: "bool", defaultChecked: true },
      { name: "permissions", label: "Permissions", kind: "permissions", help: "osTicket needs at least one." },
      { name: "notes", label: "Admin Notes", kind: "textarea" },
    ],
    // A role an agent or a department's access entry uses is refused by osTicket ("in use"): its answer is shown.
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
      { label: "Members", value: (r) => s(r.members_count) },
      { label: "Team Lead", value: (r) => s(r.lead_name) },
      { label: "Created", value: (r) => date(r.created) },
      { label: "Last Updated", value: (r) => date(r.updated) },
    ],
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
    // Members are edited by TeamMembersEditor.
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
      { label: "Status", value: (r) => (s(r.status) === "active" ? "Active" : s(r.status)) },
      { label: "Agents", value: (r) => s(r.agents_count) },
      { label: "Email Address", value: (r) => s(r.email_address) },
      { label: "Manager", value: (r) => s(r.manager_name) },
      { label: "Created", value: (r) => date(r.created) },
    ],
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
      { name: "assignment", label: "Ticket assignment", kind: "select", options: [{ value: "all", label: "Any agent" }, { value: "members", label: "Department members only" }, { value: "primary", label: "Primary members only" }] },
      { name: "alerts_to", label: "Send alerts to", kind: "select", options: [{ value: "no_one", label: "No one" }, { value: "admin_only", label: "Administrators only" }, { value: "dept_only", label: "Department members" }, { value: "dept_and_extended", label: "Department and extended-access members" }] },
      { name: "ticket_auto_response", label: "Send an auto-response when a ticket is opened", kind: "bool", defaultChecked: true },
      { name: "message_auto_response", label: "Send an auto-response when a message is posted", kind: "bool", defaultChecked: true },
      { name: "signature", label: "Department Signature", kind: "textarea" },
    ],
    // Extended-access agents are edited by DepartmentMembersEditor.
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
      { label: "Help Topic", value: (r) => s(r.path) || s(r.topic) },
      { label: "Status", value: (r) => active(r.is_active) },
      { label: "Type", value: (r) => kind(r.is_public) },
      { label: "Priority", value: (r) => s(r.priority_name) },
      { label: "Department", value: (r) => s(r.dept_name) },
      { label: "Last Updated", value: (r) => date(r.updated) },
      { label: "Created", value: (r) => date(r.created) },
    ],
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

  statuses: {
    key: "statuses",
    title: "Ticket Statuses",
    singular: "status",
    path: "/api/v1/ticket-statuses",
    listPath: "/api/v1/ticket-statuses/manage",
    osticketPage: "lists.php?id=1",
    name: (r) => s(r.name),
    columns: [
      { label: "Name", value: (r) => s(r.name) },
      { label: "State", value: (r) => cap(r.state) },
      { label: "Status", value: (r) => active(r.is_enabled) },
      { label: "Tickets", value: (r) => s(r.ticket_count) },
      { label: "Order", value: (r) => s(r.sort) },
    ],
    info: [
      ["Name", (r) => s(r.name)],
      ["State", (r) => cap(r.state)],
      ["Status", (r) => active(r.is_enabled)],
      ["Description", (r) => s(r.description)],
      ["Sort order", (r) => s(r.sort)],
      ["Tickets", (r) => s(r.ticket_count)],
      ["Built in", (r) => yes(r.is_internal)],
      ["Default", (r) => yes(r.is_default)],
      ["End users may reopen", (r) => (r.state === "closed" ? yes(r.allow_reopen) : "")],
      ["Reopens as", (r, lk) => (r.state === "closed" && r.allow_reopen ? lookup(lk.names.reopenStatuses, r.reopen_status_id) || "System default" : "")],
    ],
    fields: [
      { name: "name", label: "Name", kind: "text", required: true, lockedWhen: (d) => d.is_internal === true, help: "A built-in status keeps its name and state." },
      {
        name: "state",
        label: "State",
        kind: "select",
        required: true,
        options: [
          { value: "open", label: "Open" },
          { value: "closed", label: "Closed" },
          { value: "archived", label: "Archived" },
          { value: "deleted", label: "Deleted" },
        ],
        lockedWhen: (d) => d.is_internal === true,
      },
      { name: "description", label: "Description", kind: "textarea" },
      { name: "sort", label: "Sort Order", kind: "number" },
      { name: "is_enabled", label: "Enabled", kind: "bool", defaultChecked: true, lockedWhen: (d) => d.is_internal === true },
      { name: "allow_reopen", label: "End users may reopen a ticket in this status (closed states only)", kind: "bool" },
      { name: "reopen_status_id", label: "Reopened tickets get status", kind: "select", optionsFrom: "reopenStatuses", none: 0, help: "An enabled open status; empty is the system default." },
    ],
    canDelete: (d) => d.is_deletable === true,
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
      { label: "Fields", value: (r) => s(r.field_count) },
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
    // The fields are managed by FormFieldsAdmin, shown under the form.
    // A custom form is type "G". The core forms (ticket, user, organization, task, company) cannot be deleted here.
    createDefaults: { type: "G" },
    canDelete: (d) => d.type === "G" && d.is_deletable === true,
  },

  apikeys: {
    key: "apikeys",
    title: "API Keys",
    singular: "API key",
    path: "/api/v1/api-keys",
    osticketPage: "apikeys.php",
    name: (r) => s(r.ip_address),
    columns: [
      { label: "IP Address", value: (r) => s(r.ip_address) },
      { label: "API Key", value: (r) => s(r.key) },
      { label: "Status", value: (r) => active(r.is_active) },
      { label: "Date Added", value: (r) => date(r.created) },
      { label: "Last Updated", value: (r) => date(r.updated) },
    ],
    info: [
      ["IP Address", (r) => s(r.ip_address)],
      ["API Key", (r) => s(r.key)],
      ["Status", (r) => active(r.is_active)],
      ["Can create tickets", (r) => yes(r.can_create_tickets)],
      ["Can execute cron", (r) => yes(r.can_exec_cron)],
      ["Date Added", (r) => date(r.created)],
      ["Last Updated", (r) => date(r.updated)],
      ["Notes", (r) => s(r.notes)],
    ],
    fields: [
      { name: "ip_address", label: "IP Address", kind: "text", required: true, on: "create", help: "The address is fixed once the key exists." },
      { name: "is_active", label: "Key is active", kind: "bool", defaultChecked: true },
      { name: "can_create_tickets", label: "Can create tickets", kind: "bool", defaultChecked: true },
      { name: "can_exec_cron", label: "Can execute cron", kind: "bool" },
      { name: "notes", label: "Admin Notes", kind: "textarea" },
    ],
  },

  pages: {
    key: "pages",
    title: "Site Pages",
    singular: "page",
    path: "/api/v1/pages",
    osticketPage: "pages.php",
    name: (r) => s(r.name),
    columns: [
      { label: "Name", value: (r) => s(r.name) },
      { label: "Type", value: (r) => s(r.type) },
      { label: "Status", value: (r) => active(r.is_active) },
      { label: "Date Added", value: (r) => date(r.created) },
      { label: "Last Updated", value: (r) => date(r.updated) },
    ],
    info: [
      ["Name", (r) => s(r.name)],
      ["Type", (r) => s(r.type)],
      ["Status", (r) => active(r.is_active)],
      ["In use", (r) => yes(r.in_use)],
      ["Date Added", (r) => date(r.created)],
      ["Last Updated", (r) => date(r.updated)],
      ["Body", (r) => s(r.body)],
      ["Notes", (r) => s(r.notes)],
    ],
    fields: [
      { name: "name", label: "Name", kind: "text", required: true },
      {
        name: "type",
        label: "Type",
        kind: "select",
        required: true,
        options: [
          { value: "landing", label: "Landing page" },
          { value: "offline", label: "Offline page" },
          { value: "thank-you", label: "Thank-you page" },
          { value: "other", label: "Other" },
        ],
      },
      { name: "is_active", label: "Page is active", kind: "bool", defaultChecked: true },
      { name: "body", label: "Body", kind: "textarea", required: true, help: "HTML." },
      { name: "notes", label: "Admin Notes", kind: "textarea" },
    ],
    canDelete: (d) => d.in_use !== true,
  },

  emails: {
    key: "emails",
    title: "Emails",
    singular: "email address",
    path: "/api/v1/emails",
    osticketPage: "emails.php",
    name: (r) => s(r.email),
    columns: [
      { label: "Email", value: (r) => s(r.email) },
      { label: "Name", value: (r) => s(r.name) },
      { label: "Department", value: (r) => s(r.dept_name) },
      { label: "Created", value: (r) => date(r.created) },
      { label: "Last Updated", value: (r) => date(r.updated) },
    ],
    info: [
      ["Email", (r) => s(r.email)],
      ["Name", (r) => s(r.name)],
      ["Default", (r) => yes(r.is_default)],
      ["Department", (r) => s(r.dept_name)],
      ["Priority", (r) => s(r.priority_name)],
      ["Help Topic", (r) => s(r.topic_name)],
      ["Auto-response", (r) => (r.no_autoresponse ? "Disabled" : "Enabled")],
      ["Mailbox account", (r) => yes(r.has_mailbox)],
      ["SMTP account", (r) => yes(r.has_smtp)],
      ["Created", (r) => date(r.created)],
      ["Last Updated", (r) => date(r.updated)],
      ["Notes", (r) => s(r.notes)],
    ],
    fields: [
      { name: "email", label: "Email Address", kind: "email", required: true },
      { name: "name", label: "Email Name", kind: "text", required: true },
      { name: "dept_id", label: "New Ticket Department", kind: "select", optionsFrom: "departments", none: null },
      { name: "priority_id", label: "New Ticket Priority", kind: "select", optionsFrom: "priorities", none: null },
      { name: "topic_id", label: "New Ticket Help Topic", kind: "select", optionsFrom: "topics", none: null },
      { name: "no_autoresponse", label: "Disable the auto-response", kind: "bool" },
      { name: "notes", label: "Admin Notes", kind: "textarea" },
    ],
    canDelete: (d) => d.is_default !== true,
    // Mailbox and SMTP accounts (host, login, OAuth) are set up in osTicket; the detail page lists their status.
  },

  lists: {
    key: "lists",
    title: "Custom Lists",
    singular: "list",
    path: "/api/v1/lists",
    osticketPage: "lists.php",
    name: (r) => s(r.name),
    columns: [
      { label: "Name", value: (r) => s(r.name) },
      { label: "Items", value: (r) => s(r.item_count) },
      { label: "Created", value: (r) => date(r.created) },
      { label: "Last Updated", value: (r) => date(r.updated) },
    ],
    info: [
      ["Name", (r) => s(r.name)],
      ["Plural name", (r) => s(r.name_plural)],
      ["Sort order", (r) => ({ Alpha: "Alphabetical", "-Alpha": "Reverse alphabetical", SortCol: "Manual" })[s(r.sort_mode)] ?? s(r.sort_mode)],
      ["Items", (r) => s(r.item_count)],
      ["Managed by osTicket", (r) => (r.handled_by ? s(r.handled_by) : "No")],
      ["Created", (r) => date(r.created)],
      ["Last Updated", (r) => date(r.updated)],
      ["Notes", (r) => s(r.notes)],
    ],
    fields: [
      { name: "name", label: "Name", kind: "text", required: true },
      { name: "name_plural", label: "Plural Name", kind: "text" },
      {
        name: "sort_mode",
        label: "Sort Order",
        kind: "select",
        options: [
          { value: "Alpha", label: "Alphabetical" },
          { value: "-Alpha", label: "Reverse alphabetical" },
          { value: "SortCol", label: "Manual (by the sort number)" },
        ],
      },
      { name: "notes", label: "Admin Notes", kind: "textarea" },
    ],
    // A list osTicket manages itself (ticket statuses) is read-only: its Update and Delete are refused with osTicket's wording.
    canDelete: (d) => d.is_deletable === true,
  },

  schedules: {
    key: "schedules",
    title: "Schedules",
    singular: "schedule",
    path: "/api/v1/schedules",
    osticketPage: "schedules.php",
    name: (r) => s(r.name),
    columns: [
      { label: "Name", value: (r) => s(r.name) },
      { label: "Type", value: (r) => (r.type === "holidays" ? "Holidays" : "Business Hours") },
      { label: "Entries", value: (r) => s(r.entry_count) },
      { label: "Timezone", value: (r) => s(r.timezone) || "Floating" },
      { label: "Last Updated", value: (r) => date(r.updated) },
    ],
    info: [
      ["Name", (r) => s(r.name)],
      ["Type", (r) => (r.type === "holidays" ? "Holidays" : "Business Hours")],
      ["Timezone", (r) => s(r.timezone) || "Floating (the viewer's timezone)"],
      ["Entries", (r) => s(r.entry_count)],
      ["Holiday schedules", (r) => ((r.holiday_schedule_ids as number[]) ?? []).join(", ")],
      ["Created", (r) => date(r.created)],
      ["Last Updated", (r) => date(r.updated)],
      ["Description", (r) => s(r.description)],
    ],
    fields: [
      { name: "name", label: "Name", kind: "text", required: true },
      {
        name: "type",
        label: "Type",
        kind: "select",
        required: true,
        on: "create",
        options: [
          { value: "business_hours", label: "Business hours" },
          { value: "holidays", label: "Holidays" },
        ],
      },
      { name: "timezone", label: "Timezone", kind: "text", help: "An IANA name such as Europe/Berlin; empty floats with the viewer's timezone." },
      { name: "copy_from_id", label: "Copy entries from schedule ID", kind: "number", on: "create", help: "A copy must be the same type." },
      { name: "description", label: "Description", kind: "textarea" },
    ],
    // The entries (and a business-hours schedule's holiday links) are edited by ScheduleEntriesEditor.
  },

  templates: {
    key: "templates",
    title: "Email Template Sets",
    singular: "template set",
    path: "/api/v1/email-templates",
    osticketPage: "templates.php",
    name: (r) => s(r.name),
    columns: [
      { label: "Name", value: (r) => s(r.name) },
      { label: "Status", value: (r) => (r.is_active ? "Enabled" : "Disabled") },
      { label: "In use", value: (r) => yes(r.in_use) },
      { label: "Messages", value: (r) => s(r.message_count) },
      { label: "Language", value: (r) => s(r.lang) },
      { label: "Last Updated", value: (r) => date(r.updated) },
    ],
    info: [
      ["Name", (r) => s(r.name)],
      ["Status", (r) => (r.is_active ? "Enabled" : "Disabled")],
      ["In use", (r) => yes(r.in_use)],
      ["Language", (r) => s(r.lang)],
      ["Messages with their own copy", (r) => s(r.message_count)],
      ["Created", (r) => date(r.created)],
      ["Last Updated", (r) => date(r.updated)],
      ["Notes", (r) => s(r.notes)],
    ],
    fields: [
      { name: "name", label: "Name", kind: "text", required: true },
      { name: "lang", label: "Language", kind: "text", help: "A language code such as en_US." },
      { name: "copy_from_id", label: "Copy messages from set ID", kind: "number", on: "create" },
      { name: "is_active", label: "Set is enabled", kind: "bool", defaultChecked: true },
      { name: "notes", label: "Admin Notes", kind: "textarea" },
    ],
    // The default set and a department's set are "in use": osTicket refuses to disable or delete them.
    canDelete: (d) => d.in_use !== true,
    // The messages are edited by TemplateMessagesEditor.
  },

  filters: {
    key: "filters",
    title: "Ticket Filters",
    singular: "filter",
    path: "/api/v1/filters",
    osticketPage: "filters.php",
    name: (r) => s(r.name),
    columns: [
      { label: "Name", value: (r) => s(r.name) },
      { label: "Status", value: (r) => active(r.is_active) },
      { label: "Order", value: (r) => s(r.execorder) },
      { label: "Target", value: (r) => s(r.target) },
      { label: "Rules", value: (r) => s(r.rule_count) },
      { label: "Last Updated", value: (r) => date(r.updated) },
    ],
    info: [
      ["Name", (r) => s(r.name)],
      ["Status", (r) => active(r.is_active)],
      ["Execution Order", (r) => s(r.execorder)],
      ["Target", (r) => s(r.target) + (r.email_address ? ` (${s(r.email_address)})` : "")],
      ["Rules match", (r) => (r.match_all_rules ? "All rules" : "Any rule")],
      ["Stops further filters", (r) => yes(r.stop_onmatch)],
      ["Created", (r) => date(r.created)],
      ["Last Updated", (r) => date(r.updated)],
      ["Notes", (r) => s(r.notes)],
    ],
    fields: [
      { name: "name", label: "Filter Name", kind: "text", required: true },
      { name: "execorder", label: "Execution Order", kind: "number" },
      { name: "target", label: "Filter Target", kind: "select", options: ["Any", "Web", "Email", "API"].map((v) => ({ value: v, label: v })) },
      { name: "is_active", label: "Filter is active", kind: "bool", defaultChecked: true },
      { name: "match_all_rules", label: "All rules must match (otherwise any one)", kind: "bool" },
      { name: "stop_onmatch", label: "Stop processing further filters on a match", kind: "bool" },
      { name: "notes", label: "Admin Notes", kind: "textarea" },
    ],
    // Rules and actions are edited by FilterRulesActionsEditor; a new filter has its own form (FilterNew).
  },
};
