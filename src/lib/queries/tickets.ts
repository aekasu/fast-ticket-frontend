import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api/client";
import type { paths } from "@/lib/api/schema";
import { errorMessage } from "@/lib/api/errors";

export type TicketListQuery = NonNullable<paths["/api/v1/tickets/"]["get"]["parameters"]["query"]>;
export type QueueKey = NonNullable<TicketListQuery["queue"]>;
export type TicketSort = NonNullable<TicketListQuery["sort"]>;

export const ticketKeys = {
  all: ["tickets"] as const,
  queues: () => [...ticketKeys.all, "queues"] as const,
  list: (query: TicketListQuery) => [...ticketKeys.all, "list", query] as const,
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
