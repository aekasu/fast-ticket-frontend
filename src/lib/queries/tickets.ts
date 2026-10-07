import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api/client";
import type { paths } from "@/lib/api/schema";
import { ApiError, errorMessage } from "@/lib/api/errors";

export type TicketListQuery = NonNullable<paths["/api/v1/tickets/"]["get"]["parameters"]["query"]>;
export type QueueKey = NonNullable<TicketListQuery["queue"]>;
export type TicketSort = NonNullable<TicketListQuery["sort"]>;

export const ticketKeys = {
  all: ["tickets"] as const,
  queues: () => [...ticketKeys.all, "queues"] as const,
  list: (query: TicketListQuery) => [...ticketKeys.all, "list", query] as const,
  detail: (id: number) => [...ticketKeys.all, "detail", id] as const,
};

export function useQueueCounts() {
  return useQuery({
    queryKey: ticketKeys.queues(),
    queryFn: async () => {
      const { data, error } = await api.GET("/api/v1/tickets/queues");
      if (!data) throw new Error(errorMessage(error));
      return data.queues;
    },
  });
}

export function useTicketList(query: TicketListQuery) {
  return useQuery({
    queryKey: ticketKeys.list(query),
    queryFn: async () => {
      const { data, error } = await api.GET("/api/v1/tickets/", { params: { query } });
      if (!data) throw new Error(errorMessage(error));
      return data;
    },
    placeholderData: keepPreviousData,
  });
}

export function useTicket(id: number) {
  return useQuery({
    queryKey: ticketKeys.detail(id),
    queryFn: async () => {
      const { data, error, response } = await api.GET("/api/v1/tickets/{ticket_id}", { params: { path: { ticket_id: id } } });
      if (!data) throw new ApiError(errorMessage(error), response.status);
      return data;
    },
    // A 404 means gone or not yours; retrying will not change that.
    retry: false,
  });
}

/** The ticket owner's email and organization. Needs the user directory, so a refusal is not an error here. */
export function useTicketOwner(userId: number | null | undefined) {
  return useQuery({
    queryKey: ["users", "detail", userId],
    enabled: userId != null,
    queryFn: async () => {
      const { data } = await api.GET("/api/v1/users/{user_id}", { params: { path: { user_id: userId! } } });
      return data ?? null;
    },
  });
}

export function useAssignees(ticketId: number, enabled: boolean) {
  return useQuery({
    queryKey: [...ticketKeys.detail(ticketId), "assignees"],
    enabled,
    queryFn: async () => {
      const { data, error } = await api.GET("/api/v1/tickets/{ticket_id}/assignees", { params: { path: { ticket_id: ticketId } } });
      if (!data) throw new Error(errorMessage(error));
      return data;
    },
  });
}

/** The referrals on a ticket (who it was referred to), for the agents who may assign. */
export function useReferrals(ticketId: number, enabled: boolean) {
  return useQuery({
    queryKey: [...ticketKeys.detail(ticketId), "referrals"],
    enabled,
    queryFn: async () => {
      const { data, error } = await api.GET("/api/v1/tickets/{ticket_id}/referrals", { params: { path: { ticket_id: ticketId } } });
      if (!data) throw new Error(errorMessage(error));
      return data.referrals;
    },
  });
}

/** Linked or merged tickets: the relation of this ticket to others (parent, children). */
export function useRelated(ticketId: number) {
  return useQuery({
    queryKey: [...ticketKeys.detail(ticketId), "related"],
    queryFn: async () => {
      const { data, error } = await api.GET("/api/v1/tickets/{ticket_id}/related", { params: { path: { ticket_id: ticketId } } });
      if (!data) throw new Error(errorMessage(error));
      return data;
    },
  });
}
