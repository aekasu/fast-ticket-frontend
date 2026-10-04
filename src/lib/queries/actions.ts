import { useMutation, useQueryClient } from "@tanstack/react-query";
import { runCommand } from "./commands";

/**
 * An action on one resource (ticket, task, …): POST {basePath}/{action}, or PATCH {basePath} for an edit (empty
 * action), then refetch everything under `invalidate`.
 * Whether it worked or osTicket refused, what is on screen may be stale.
 */
export function useResourceAction(basePath: string, invalidate: readonly unknown[]) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (variables: { action: string; body?: Record<string, unknown>; key: string }) =>
      variables.action
        ? runCommand({ method: "POST", path: `${basePath}/${variables.action}`, body: variables.body ?? {}, key: variables.key })
        : runCommand({ method: "PATCH", path: basePath, body: variables.body ?? {}, key: variables.key }),
    onSettled: () => queryClient.invalidateQueries({ queryKey: invalidate }),
  });
}
