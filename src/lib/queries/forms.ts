import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api/client";
import type { FieldDef } from "@/lib/custom-fields";

export type FormType = "T" | "U" | "O" | "A";

/**
 * The field definitions of the ticket (T), user (U), organization (O) or task (A) form. Forms are admin-only through
 * the API, so for anyone else this resolves to `null`: custom fields can then be shown (from the answers) but not typed.
 */
export function useFormDefinition(type: FormType) {
  return useQuery({
    queryKey: ["forms", "definition", type],
    staleTime: 30_000,
    retry: false,
    queryFn: async (): Promise<FieldDef[] | null> => {
      const list = await api.GET("/api/v1/forms");
      if (!list.data) return null;
      const form = list.data.items.find((f) => f.type === type);
      if (!form) return null;
      const detail = await api.GET("/api/v1/forms/{form_id}", { params: { path: { form_id: form.id } } });
      return (detail.data?.fields as unknown as FieldDef[] | undefined) ?? null;
    },
  });
}
