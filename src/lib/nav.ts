import type { Me } from "@/lib/api/me";

export interface Section {
  href: string;
  label: string;
  /** Hides the entry (and its page) from agents who cannot use it. The server enforces the real rule. */
  visible: (me: Me) => boolean;
}

// osTicket's top-level menu, in its order.
export const SECTIONS: Section[] = [
  { href: "/", label: "Dashboard", visible: () => true },
  { href: "/users", label: "Users", visible: (me) => me.is_admin || me.global_permissions.includes("user.dir") },
  { href: "/tasks", label: "Tasks", visible: () => true },
  { href: "/tickets", label: "Tickets", visible: () => true },
  { href: "/kb", label: "Knowledge Base", visible: () => true },
  { href: "/admin", label: "Admin Panel", visible: (me) => me.is_admin },
];
