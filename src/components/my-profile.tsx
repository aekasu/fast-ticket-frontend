"use client";

import { useMe } from "@/lib/queries/me";
import { useDepartments } from "@/lib/queries/reference";
import { DashboardTabs } from "./dashboard-tabs";
import { Info } from "./info-table";
import { MyProfileForm } from "./my-profile-form";

/** The agent's own account: osTicket's profile.php form, then what the role system grants. */
export function MyProfile() {
  const { data: me, error, isLoading } = useMe();
  const departments = useDepartments();
  const deptName = (id: string | number) => departments.data?.find((d) => d.id === Number(id))?.name ?? `#${id}`;

  return (
    <div>
      <DashboardTabs current="profile" />
      <h1 className="mb-3 text-xl font-bold text-slate-800">My Account Profile</h1>
      {isLoading && <p className="text-sm text-slate-500">Loading…</p>}
      {error && <p role="alert" className="text-sm text-red-700">{error.message}</p>}
      <div className="mb-6">
        <MyProfileForm />
      </div>
      {me && (
        <>
          <div className="grid gap-4 lg:grid-cols-2">
            <Info
              rows={[
                ["Name", me.name],
                ["Email Address", me.email],
                ["Username", me.username],
                ["Account type", me.is_admin ? "Administrator" : "Agent"],
                ["Ticket access", me.assigned_only ? "Only tickets assigned to you" : "All tickets in your departments"],
              ]}
            />
            <Info
              rows={[
                ["Departments", me.department_ids?.map(deptName).join(", ") ?? ""],
                ["Teams", String(me.team_ids?.length ?? 0)],
                ["Global permissions", me.global_permissions.join(", ") || "None"],
              ]}
            />
          </div>

          <h2 className="mt-6 border-b border-slate-300 pb-1 text-sm font-semibold text-slate-800">Role permissions by department</h2>
          <table className="mt-2 w-full border border-slate-300 bg-white text-left text-sm">
            <thead className="bg-slate-100 text-xs uppercase tracking-wide text-slate-600">
              <tr>
                <th className="px-3 py-2 font-semibold">Department</th>
                <th className="px-3 py-2 font-semibold">Permissions</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(me.roles).map(([dept, permissions]) => (
                <tr key={dept} className="border-t border-slate-200 align-top">
                  <td className="whitespace-nowrap px-3 py-2">{deptName(dept)}</td>
                  <td className="px-3 py-2 text-slate-700">{permissions.join(", ")}</td>
                </tr>
              ))}
              {Object.keys(me.roles).length === 0 && (
                <tr>
                  <td colSpan={2} className="px-3 py-3 text-center text-slate-500">
                    No roles.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}
