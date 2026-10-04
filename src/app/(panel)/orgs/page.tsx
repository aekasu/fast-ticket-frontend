import { notFound } from "next/navigation";
import { Suspense } from "react";
import { OrgList } from "@/components/org-list";
import { canBrowseDirectory } from "@/lib/nav";
import { requireMe } from "@/lib/server/session";

export const metadata = { title: "Organizations" };

export default async function OrgsPage() {
  if (!canBrowseDirectory(await requireMe())) notFound();
  return (
    <Suspense>
      <OrgList />
    </Suspense>
  );
}
