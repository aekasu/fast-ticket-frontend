import { Suspense } from "react";
import { AgentDirectory } from "@/components/agent-directory";

export const metadata = { title: "Agent Directory" };

export default function DirectoryPage() {
  return (
    <Suspense>
      <AgentDirectory />
    </Suspense>
  );
}
