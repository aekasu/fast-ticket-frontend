import { notFound } from "next/navigation";
import { UserNew } from "@/components/user-form";
import { hasGlobal } from "@/lib/nav";
import { requireMe } from "@/lib/server/session";

export const metadata = { title: "Add User" };

export default async function NewUserPage() {
  if (!hasGlobal(await requireMe(), "user.create")) notFound();
  return <UserNew />;
}
