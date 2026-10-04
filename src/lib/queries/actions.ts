import { useMutation, useQueryClient } from "@tanstack/react-query";
import { runCommand } from "./commands";

/**
 * An action on one resource (ticket, task, …), then a refetch of everything under `invalidate`.
 * By default `action` is POSTed to `{basePath}/{action}`, and an empty action PATCHes the resource itself (an edit).
 * `method` overrides that, for a sub-resource such as `collaborators/12` (PATCH to change it, DELETE to remove it).
 */
export function useResourceAction(basePath: string, invalidate: readonly unknown[]) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (variables: { action: string; body?: Record<string, unknown>; key: string; method?: "POST" | "PATCH" | "DELETE" }) =>
      runCommand({
        method: variables.method ?? (variables.action ? "POST" : "PATCH"),
        path: variables.action ? `${basePath}/${variables.action}` : basePath,
        body: variables.method === "DELETE" ? undefined : (variables.body ?? {}),
        key: variables.key,
      }),
    // Whether it worked or osTicket refused, what is on screen may be stale.
    onSettled: () => queryClient.invalidateQueries({ queryKey: invalidate }),
  });
}
