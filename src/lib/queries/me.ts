import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api/client";
import type { Me } from "@/lib/api/me";
import { errorMessage } from "@/lib/api/errors";

export function useMe() {
  return useQuery({
    queryKey: ["me"],
    queryFn: async () => {
      const { data, error } = await api.GET("/api/v1/auth/me");
      if (!data) throw new Error(errorMessage(error));
      return data;
    },
  });
}

/** What the agent's role grants in a department. The server enforces the same rule; this only hides buttons. */
export function can(me: Me | undefined, deptId: number | null | undefined, permission: string): boolean {
  if (!me) return false;
  if (me.is_admin) return true;
  return deptId != null && (me.roles[String(deptId)] ?? []).includes(permission);
}

/** Whether any department's role (or being an administrator) grants the permission: for controls shown before a department is chosen. */
export function canAnywhere(me: Me | undefined, permission: string): boolean {
  if (!me) return false;
  return me.is_admin || Object.values(me.roles).some((perms) => perms.includes(permission));
}
