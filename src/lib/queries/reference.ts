import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api/client";
import { errorMessage } from "@/lib/api/errors";

// Reference lists for a ticket form. Open to every agent (KNOWN_LIMITS.md); they rarely change.
const options = { staleTime: 5 * 60_000 };

export function useDepartments() {
  return useQuery({
    queryKey: ["reference", "departments"],
    ...options,
    queryFn: async () => {
      const { data, error } = await api.GET("/api/v1/departments", { params: { query: { page_size: 200 } } });
      if (!data) throw new Error(errorMessage(error));
      return data.items;
    },
  });
}

export function useTopics() {
  return useQuery({
    queryKey: ["reference", "topics"],
    ...options,
    queryFn: async () => {
      const { data, error } = await api.GET("/api/v1/topics", { params: { query: { page_size: 200 } } });
      if (!data) throw new Error(errorMessage(error));
      return data.items.filter((t) => t.is_active);
    },
  });
}

export function usePriorities() {
  return useQuery({
    queryKey: ["reference", "priorities"],
    ...options,
    queryFn: async () => {
      const { data, error } = await api.GET("/api/v1/priorities");
      if (!data) throw new Error(errorMessage(error));
      return [...data.items].sort((a, b) => a.urgency - b.urgency);
    },
  });
}

/** SLA plans are admin-only through the API: for anyone else the list is refused and the field is left out. */
export function useSlas() {
  return useQuery({
    queryKey: ["reference", "slas"],
    ...options,
    retry: false,
    queryFn: async () => {
      const { data } = await api.GET("/api/v1/slas", { params: { query: { page_size: 200 } } });
      return data?.items ?? null;
    },
  });
}
