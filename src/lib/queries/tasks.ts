import { keepPreviousData, useQueries, useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api/client";
import type { paths } from "@/lib/api/schema";
import { ApiError, errorMessage } from "@/lib/api/errors";

export type TaskListQuery = NonNullable<paths["/api/v1/tasks/"]["get"]["parameters"]["query"]>;
export type TaskSort = NonNullable<TaskListQuery["sort"]>;

// osTicket's task statuses: 1 = Open, 2 = Closed (the API filters by id; the state is on every task).
const OPEN = 1;
const CLOSED = 2;

/** osTicket's task tabs. The API has no queue counts or overdue flag, so each is a filter on the list. */
export type TaskQueue = "open" | "assigned" | "closed";

export function queueQuery(queue: TaskQueue, staffId: number | undefined): TaskListQuery {
  if (queue === "closed") return { status_id: CLOSED };
  if (queue === "assigned") return { status_id: OPEN, assignee_staff_id: staffId };
  return { status_id: OPEN };
}

export const taskKeys = {
  all: ["tasks"] as const,
  list: (query: TaskListQuery) => [...taskKeys.all, "list", query] as const,
  counts: (staffId: number | undefined) => [...taskKeys.all, "counts", staffId] as const,
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

/** The three counts osTicket shows on its tabs: Open, My Tasks, Completed. */
export function useTaskCounts(staffId: number | undefined) {
  const queues: TaskQueue[] = ["open", "assigned", "closed"];
  const results = useQueries({
    queries: queues.map((queue) => ({
      queryKey: [...taskKeys.counts(staffId), queue],
      enabled: staffId != null,
      queryFn: async () => {
        const { data, error } = await api.GET("/api/v1/tasks/", { params: { query: { ...queueQuery(queue, staffId), page_size: 1 } } });
        if (!data) throw new Error(errorMessage(error));
        return data.total ?? 0;
      },
    })),
  });
  return {
    counts: Object.fromEntries(queues.map((q, i) => [q, results[i].data])) as Record<TaskQueue, number | undefined>,
    error: results.find((r) => r.error)?.error as Error | undefined,
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
