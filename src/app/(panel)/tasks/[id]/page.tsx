import { notFound } from "next/navigation";
import { TaskView } from "@/components/task-view";

export const metadata = { title: "Task" };

export default async function TaskPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^\d+$/.test(id)) notFound();
  return <TaskView id={Number(id)} />;
}
