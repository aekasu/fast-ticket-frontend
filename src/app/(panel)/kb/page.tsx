import { Suspense } from "react";
import { KbHome } from "@/components/kb-home";

export const metadata = { title: "Knowledge Base" };

export default function KbPage() {
  return (
    <Suspense>
      <KbHome />
    </Suspense>
  );
}
