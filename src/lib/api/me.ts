// TEMPORARY: GET /auth/me has no response schema (notes/BACKEND_REQUESTS.md). Replace with the generated type.
export interface Me {
  staff_id: number;
  username: string;
  name: string;
  email: string;
  is_admin: boolean;
  assigned_only: boolean;
  global_permissions: string[];
  roles: Record<string, string[]>;
  department_ids?: number[];
  team_ids?: number[];
}
