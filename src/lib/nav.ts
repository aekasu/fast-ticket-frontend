import type { Me } from "@/lib/api/me";

export interface Section {
  href: string;
  label: string;
  /** Hides the entry (and its page) from agents who cannot use it. The server enforces the real rule. */
  visible: (me: Me) => boolean;
  /** Other path prefixes that belong under this menu entry (osTicket keeps Organizations under Users). */
  also?: string[];
}

// osTicket's top-level menu, in its order.
export const SECTIONS: Section[] = [
  { href: "/", label: "Dashboard", visible: () => true, also: ["/report", "/directory", "/profile"] },
  { href: "/users", label: "Users", visible: (me) => me.is_admin || me.global_permissions.includes("user.dir"), also: ["/orgs"] },
  { href: "/tasks", label: "Tasks", visible: () => true },
  { href: "/tickets", label: "Tickets", visible: () => true },
  { href: "/kb", label: "Knowledge Base", visible: () => true },
  { href: "/admin", label: "Admin Panel", visible: (me) => me.is_admin },
];

/** osTicket offers "New Ticket" to agents whose role grants ticket.create in some department. */
export function canCreateTickets(me: Me): boolean {
  return me.is_admin || Object.values(me.roles).some((permissions) => permissions.includes("ticket.create"));
}

export function canCreateTasks(me: Me): boolean {
  return me.is_admin || Object.values(me.roles).some((permissions) => permissions.includes("task.create"));
}

/** Global (not per-department) permissions, as `/auth/me` lists them. Administrators have all. */
export function hasGlobal(me: Me, permission: string): boolean {
  return me.is_admin || me.global_permissions.includes(permission);
}

export const canBrowseDirectory = (me: Me) => hasGlobal(me, "user.dir");

/** Canned responses are managed through a role permission (`canned.manage`) in any of the agent's departments. */
export const canManageCanned = (me: Me) => me.is_admin || Object.values(me.roles).some((permissions) => permissions.includes("canned.manage"));
export const canManageFaqs = (me: Me) => hasGlobal(me, "faq.manage");
