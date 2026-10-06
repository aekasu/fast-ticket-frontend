import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api/client";
import { errorMessage } from "@/lib/api/errors";
import type { FieldDef } from "@/lib/custom-fields";

export type FormType = "T" | "U" | "O" | "A";

const KIND = { T: "ticket", U: "user", O: "organization", A: "task" } as const;

/**
 * The field definitions of the ticket (T), user (U), organization (O) or task (A) form, for any agent: the core form's
 * fields and then, for a ticket, those of the help topic's forms. Re-read when the topic changes.
 */
export function useFormDefinition(type: FormType, topicId?: number | null) {
  return useQuery({
    queryKey: ["forms", "definition", type, topicId ?? null],
    staleTime: 30_000,
    retry: false,
    placeholderData: keepPreviousData, // typed answers survive a topic change
    queryFn: async (): Promise<FieldDef[]> => {
      const { data, error } = await api.GET("/api/v1/forms/for/{kind}", {
        params: { path: { kind: KIND[type] }, query: type === "T" && topicId ? { topic_id: topicId } : {} },
      });
      if (!data) throw new Error(errorMessage(error));
      return data.forms.flatMap((f) => f.fields) as FieldDef[];
    },
  });
}
