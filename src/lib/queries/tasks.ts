import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api/client";
import type { paths } from "@/lib/api/schema";
import { ApiError, errorMessage } from "@/lib/api/errors";

export type TaskListQuery = NonNullable<paths["/api/v1/tasks/"]["get"]["parameters"]["query"]>;
export type TaskSort = NonNullable<TaskListQuery["sort"]>;

/** osTicket's task tabs; the API's own queue keys (`GET /tasks/queues`). */
export type TaskQueue = "open" | "overdue" | "assigned" | "closed";

export const taskKeys = {
  all: ["tasks"] as const,
  list: (query: TaskListQuery) => [...taskKeys.all, "list", query] as const,
  counts: [...["tasks"], "counts"] as const,
  detail: (id: number) => [...taskKeys.all, "detail", id] as const,
};

export function useTaskList(query: TaskListQuery) {
  return useQuery({
    queryKey: taskKeys.list(query),
    queryFn: async () => {
      const { data, error } = await api.GET("/api/v1/tasks/", { params: { query } });
      if (!data) throw new Error(errorMessage(error));
      return data;
    },
    placeholderData: keepPreviousData,
  });
}

/** The queue tabs osTicket shows (Open, Overdue, My Tasks, Completed) with the counts the API gives. */
export function useTaskCounts() {
  const query = useQuery({
    queryKey: taskKeys.counts,
    queryFn: async () => {
      const { data, error } = await api.GET("/api/v1/tasks/queues");
      if (!data) throw new Error(errorMessage(error));
      return data.queues;
    },
  });
  const queues = query.data ?? [];
  return {
    queues,
    counts: Object.fromEntries(queues.map((q) => [q.key, q.count])) as Partial<Record<TaskQueue, number>>,
    error: query.error ?? undefined,
  };
}

export function useTask(id: number) {
  return useQuery({
    queryKey: taskKeys.detail(id),
    queryFn: async () => {
      const { data, error, response } = await api.GET("/api/v1/tasks/{task_id}", { params: { path: { task_id: id } } });
      if (!data) throw new ApiError(errorMessage(error), response.status);
      return data;
    },
    retry: false,
  });
}

export function useTaskAssignees(id: number, enabled: boolean) {
  return useQuery({
    queryKey: [...taskKeys.detail(id), "assignees"],
    enabled,
    queryFn: async () => {
      const { data, error } = await api.GET("/api/v1/tasks/{task_id}/assignees", { params: { path: { task_id: id } } });
      if (!data) throw new Error(errorMessage(error));
      return data;
    },
  });
}
