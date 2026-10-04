import { notFound } from "next/navigation";
import { Suspense } from "react";
import { TaskNew } from "@/components/task-new";
import { canCreateTasks } from "@/lib/nav";
import { requireMe } from "@/lib/server/session";

export const metadata = { title: "New Task" };

export default async function NewTaskPage() {
  if (!canCreateTasks(await requireMe())) notFound();
  return (
    <Suspense>
      <TaskNew />
    </Suspense>
  );
}
