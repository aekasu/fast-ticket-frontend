import { notFound } from "next/navigation";
import { Suspense } from "react";
import { UserList } from "@/components/user-list";
import { canBrowseDirectory } from "@/lib/nav";
import { requireMe } from "@/lib/server/session";

export const metadata = { title: "User Directory" };

export default async function UsersPage() {
  if (!canBrowseDirectory(await requireMe())) notFound();
  return (
    <Suspense>
      <UserList />
    </Suspense>
  );
}
