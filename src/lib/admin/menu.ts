// osTicket's Admin Panel menu (scp/admin.php), with what the API can back. `slug` is the route under /admin;
// an item with no `resource` has no API behind it and is shown as unavailable, never faked.
export interface AdminItem {
  label: string;
  slug: string;
  /** The resource config key in `resources.ts`, when the API serves it. */
  resource?: string;
  /** A hand-built screen (not the generic resource list) the API serves for this entry. */
  screen?: "logs" | "system" | "plugins" | "settings" | "schedules" | "templates" | "filters";
  /** osTicket's page, for reference in the unavailable notice. */
  page: string;
}

export interface AdminGroup {
  key: string;
  label: string;
  items: AdminItem[];
}

export const ADMIN_MENU: AdminGroup[] = [
  {
    key: "dashboard",
    label: "Dashboard",
    items: [
      { label: "System Logs", slug: "logs", screen: "logs", page: "logs.php" },
      { label: "Information", slug: "system", screen: "system", page: "system.php" },
    ],
  },
  {
    key: "settings",
    label: "Settings",
    items: [
      { label: "Company", slug: "settings-company", page: "settings.php?t=pages" },
      { label: "System", slug: "settings-system", page: "settings.php?t=system" },
      { label: "Tickets", slug: "settings-tickets", page: "settings.php?t=tickets" },
      { label: "Tasks", slug: "settings-tasks", page: "settings.php?t=tasks" },
      { label: "Agents", slug: "settings-agents", page: "settings.php?t=agents" },
      { label: "Users", slug: "settings-users", page: "settings.php?t=users" },
      { label: "Knowledgebase", slug: "settings-kb", page: "settings.php?t=kb" },
    ],
  },
  {
    key: "manage",
    label: "Manage",
    items: [
      { label: "Help Topics", slug: "topics", resource: "topics", page: "helptopics.php" },
      { label: "Filters", slug: "filters", page: "filters.php" },
      { label: "SLA", slug: "slas", resource: "slas", page: "slas.php" },
      { label: "Schedules", slug: "schedules", page: "schedules.php" },
      { label: "API", slug: "apikeys", resource: "apikeys", page: "apikeys.php" },
      { label: "Pages", slug: "pages", resource: "pages", page: "pages.php" },
      { label: "Forms", slug: "forms", resource: "forms", page: "forms.php" },
      { label: "Lists", slug: "lists", resource: "lists", page: "lists.php" },
      { label: "Plugins", slug: "plugins", screen: "plugins", page: "plugins.php" },
      // Not in osTicket's menu; the API manages ticket priorities.
      { label: "Priorities", slug: "priorities", resource: "priorities", page: "" },
    ],
  },
  {
    key: "emails",
    label: "Emails",
    items: [
      { label: "Emails", slug: "emails", resource: "emails", page: "emails.php" },
      { label: "Settings", slug: "emailsettings", page: "emailsettings.php" },
      { label: "Banlist", slug: "banlist", resource: "banlist", page: "banlist.php" },
      { label: "Templates", slug: "templates", page: "templates.php" },
      { label: "Diagnostic", slug: "emailtest", page: "emailtest.php" },
    ],
  },
  {
    key: "agents",
    label: "Agents",
    items: [
      { label: "Agents", slug: "staff", resource: "staff", page: "staff.php" },
      { label: "Teams", slug: "teams", resource: "teams", page: "teams.php" },
      { label: "Roles", slug: "roles", resource: "roles", page: "roles.php" },
      { label: "Departments", slug: "departments", resource: "departments", page: "departments.php" },
    ],
  },
];

export function findAdminItem(slug: string): { group: AdminGroup; item: AdminItem } | undefined {
  for (const group of ADMIN_MENU) {
    const item = group.items.find((i) => i.slug === slug);
    if (item) return { group, item };
  }
  return undefined;
}
