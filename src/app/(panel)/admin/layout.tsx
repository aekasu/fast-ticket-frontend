import { notFound } from "next/navigation";
import { AdminNav } from "@/components/admin-nav";
import { requireMe } from "@/lib/server/session";

// The whole Admin Panel is for administrators; for anyone else it is simply not there.
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  if (!(await requireMe()).is_admin) notFound();
  return (
    <div>
      <AdminNav />
      {children}
    </div>
  );
}
