import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api/client";
import { ApiError, errorMessage } from "@/lib/api/errors";

export const kbKeys = {
  categories: ["kb", "categories"] as const,
  faqs: ["kb", "faqs"] as const,
  canned: ["kb", "canned"] as const,
};

// A knowledge base is small, so the lists are read whole (up to 200). The category counts come from the API
// (`faq_count`); the FAQ list is filtered and searched by the API (`category_id`, `q`).
export function useCategories() {
  return useQuery({
    queryKey: [...kbKeys.categories, "all"],
    queryFn: async () => {
      const { data, error } = await api.GET("/api/v1/kb/categories", { params: { query: { page: 1, page_size: 200 } } });
      if (!data) throw new Error(errorMessage(error));
      return data.items;
    },
  });
}

export function useFaqs(filter: { category_id?: number; q?: string } = {}, enabled = true) {
  return useQuery({
    queryKey: [...kbKeys.faqs, "all", filter],
    enabled,
    queryFn: async () => {
      const { data, error } = await api.GET("/api/v1/kb/faqs", { params: { query: { ...filter, page: 1, page_size: 200 } } });
      if (!data) throw new Error(errorMessage(error));
      return data.items;
    },
  });
}

export function useFaq(id: number) {
  return useQuery({
    queryKey: [...kbKeys.faqs, "detail", id],
    queryFn: async () => {
      const { data, error, response } = await api.GET("/api/v1/kb/faqs/{faq_id}", { params: { path: { faq_id: id } } });
      if (!data) throw new ApiError(errorMessage(error), response.status);
      return data;
    },
    retry: false,
  });
}

export function useCategory(id: number) {
  return useQuery({
    queryKey: [...kbKeys.categories, "detail", id],
    queryFn: async () => {
      const { data, error, response } = await api.GET("/api/v1/kb/categories/{category_id}", { params: { path: { category_id: id } } });
      if (!data) throw new ApiError(errorMessage(error), response.status);
      return data;
    },
    retry: false,
  });
}

export function useCannedList() {
  return useQuery({
    queryKey: [...kbKeys.canned, "all"],
    queryFn: async () => {
      const { data, error } = await api.GET("/api/v1/canned", { params: { query: { page: 1, page_size: 200 } } });
      if (!data) throw new Error(errorMessage(error));
      return data.items;
    },
  });
}

export function useCanned(id: number) {
  return useQuery({
    queryKey: [...kbKeys.canned, "detail", id],
    queryFn: async () => {
      const { data, error, response } = await api.GET("/api/v1/canned/{canned_id}", { params: { path: { canned_id: id } } });
      if (!data) throw new ApiError(errorMessage(error), response.status);
      return data;
    },
    retry: false,
  });
}
