import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api/client";
import { useDepartments, usePriorities, useSlas, useTopics } from "./reference";

export interface Option {
  value: number;
  label: string;
}

/** The agent directory (open to every agent): id and name, for manager and lead selects. */
export function useAgentDirectory() {
  return useQuery({
    queryKey: ["reference", "agents"],
    staleTime: 60_000,
    queryFn: async () => {
      const { data } = await api.GET("/api/v1/agents", { params: { query: { page_size: 200 } } });
      return data?.items ?? [];
    },
  });
}

/** Names for the ids an admin list or form shows, and the options for its selects. */
export function useAdminLookups() {
  const departments = useDepartments();
  const priorities = usePriorities();
  const slas = useSlas();
  const agents = useAgentDirectory();
  const topics = useTopics();

  const options = {
    departments: (departments.data ?? []).map((d): Option => ({ value: d.id, label: d.name })),
    priorities: (priorities.data ?? []).map((p): Option => ({ value: p.id, label: p.desc })),
    slas: (slas.data ?? []).map((s): Option => ({ value: s.id, label: s.name })),
    agents: (agents.data ?? []).map((a): Option => ({ value: a.id, label: a.name })),
    topics: (topics.data ?? []).map((t): Option => ({ value: t.id, label: t.topic })),
  };
  const names = Object.fromEntries(Object.entries(options).map(([k, list]) => [k, new Map(list.map((o) => [o.value, o.label]))])) as Record<keyof typeof options, Map<number, string>>;
  return { options, names, loading: departments.isLoading || priorities.isLoading || slas.isLoading || agents.isLoading || topics.isLoading };
}
export type AdminLookups = ReturnType<typeof useAdminLookups>;

/** Every agent with the fields the relation editors need (admin-only: the full staff list). */
export function useStaffList() {
  return useQuery({
    queryKey: ["admin", "staff", "all"],
    staleTime: 30_000,
    queryFn: async () => {
      const { data } = await api.GET("/api/v1/staff", { params: { query: { page: 1, page_size: 200 } } });
      return data?.items ?? [];
    },
  });
}

/** Teams, for an agent's team membership. */
export function useTeamsList() {
  return useQuery({
    queryKey: ["admin", "teams", "all"],
    staleTime: 30_000,
    queryFn: async () => {
      const { data } = await api.GET("/api/v1/teams", { params: { query: { page: 1, page_size: 200 } } });
      return data?.items ?? [];
    },
  });
}

/** Custom forms, for a help topic. */
export function useFormsList() {
  return useQuery({
    queryKey: ["admin", "forms", "all"],
    staleTime: 30_000,
    queryFn: async () => {
      const { data } = await api.GET("/api/v1/forms", { params: { query: { page: 1, page_size: 200 } } });
      return data?.items ?? [];
    },
  });
}

/** Roles cannot be listed through the API: the ids already in use by agents are the only ones known. */
export function knownRoleIds(staff: { role_id?: number | null }[], extra: number[] = []): number[] {
  return [...new Set([...staff.map((s) => s.role_id ?? 0), ...extra].filter((id) => id > 0))].sort((a, b) => a - b);
}
