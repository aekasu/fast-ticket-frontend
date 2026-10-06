import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api/client";
import { ApiError, errorMessage } from "@/lib/api/errors";
import type { paths } from "@/lib/api/schema";

export const directoryKeys = {
  users: ["users"] as const,
  orgs: ["orgs"] as const,
};

export type UserListQuery = NonNullable<paths["/api/v1/users"]["get"]["parameters"]["query"]>;
export type UserSort = NonNullable<UserListQuery["sort"]>;
export type OrgListQuery = NonNullable<paths["/api/v1/orgs"]["get"]["parameters"]["query"]>;
export type OrgSort = NonNullable<OrgListQuery["sort"]>;

/** osTicket's directory Status, as the API's `account_status` names it. */
export const ACCOUNT_STATUS_LABEL: Record<string, string> = {
  guest: "Guest",
  active: "Active (Registered)",
  pending: "Locked (Pending Activation)",
  locked: "Locked (Administrative)",
};

export function useUsers(query: UserListQuery) {
  return useQuery({
    queryKey: [...directoryKeys.users, "list", query],
    queryFn: async () => {
      const { data, error } = await api.GET("/api/v1/users", { params: { query } });
      if (!data) throw new Error(errorMessage(error));
      return data;
    },
    placeholderData: keepPreviousData,
  });
}

export function useUser(id: number) {
  return useQuery({
    queryKey: [...directoryKeys.users, "detail", id],
    queryFn: async () => {
      const { data, error, response } = await api.GET("/api/v1/users/{user_id}", { params: { path: { user_id: id } } });
      if (!data) throw new ApiError(errorMessage(error), response.status);
      return data;
    },
    retry: false,
  });
}

export function useOrgs(query: OrgListQuery) {
  return useQuery({
    queryKey: [...directoryKeys.orgs, "list", query],
    queryFn: async () => {
      const { data, error } = await api.GET("/api/v1/orgs", { params: { query } });
      if (!data) throw new Error(errorMessage(error));
      return data;
    },
    placeholderData: keepPreviousData,
  });
}

export function useOrg(id: number) {
  return useQuery({
    queryKey: [...directoryKeys.orgs, "detail", id],
    queryFn: async () => {
      const { data, error, response } = await api.GET("/api/v1/orgs/{org_id}", { params: { path: { org_id: id } } });
      if (!data) throw new ApiError(errorMessage(error), response.status);
      return data;
    },
    retry: false,
  });
}

/** Every organization, for a select. */
export function useAllOrgs() {
  return useQuery({
    queryKey: [...directoryKeys.orgs, "all"],
    staleTime: 60_000,
    queryFn: async () => {
      const { data } = await api.GET("/api/v1/orgs", { params: { query: { page: 1, page_size: 200 } } });
      return data?.items ?? [];
    },
  });
}

/** A new resource's id from a create command's result: its first positive integer. */
export function createdId(result: Record<string, unknown>): number | undefined {
  return Object.values(result).find((v): v is number => typeof v === "number" && Number.isInteger(v) && v > 0);
}

/**
 * Everyone in the user directory (up to 200), for picking an owner or a collaborator. Listing users needs the
 * `user.dir` permission: for an agent without it this is `null`, and the screens say so.
 */
export function useUserOptions(enabled = true) {
  return useQuery({
    queryKey: [...directoryKeys.users, "options"],
    enabled,
    staleTime: 30_000,
    queryFn: async () => {
      const { data } = await api.GET("/api/v1/users", { params: { query: { page: 1, page_size: 200 } } });
      return data?.items ?? null;
    },
  });
}
