import { notFound } from "next/navigation";
import { Suspense } from "react";
import { FaqNew } from "@/components/faq-form";
import { canManageFaqs } from "@/lib/nav";
import { requireMe } from "@/lib/server/session";

export const metadata = { title: "Add FAQ" };

export default async function NewFaqPage() {
  if (!canManageFaqs(await requireMe())) notFound();
  return (
    <Suspense>
      <FaqNew />
    </Suspense>
  );
}
