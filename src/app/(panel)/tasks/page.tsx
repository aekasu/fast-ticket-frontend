import { Suspense } from "react";
import { TaskList } from "@/components/task-list";

export const metadata = { title: "Tasks" };

export default function TasksPage() {
  return (
    <Suspense>
      <TaskList />
    </Suspense>
  );
}
