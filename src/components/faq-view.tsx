"use client";

import Link from "next/link";
import { ApiError } from "@/lib/api/errors";
import { formatDateTime } from "@/lib/format";
import { canManageFaqs } from "@/lib/nav";
import { kbKeys, useCategories, useFaq } from "@/lib/queries/kb";
import { useMe } from "@/lib/queries/me";
import { DeleteButton } from "./delete-button";
import { SafeHtml } from "./safe-html";

export function FaqView({ id }: { id: number }) {
  const { data: me } = useMe();
  const { data: faq, error, isLoading } = useFaq(id);
  const categories = useCategories();

  if (isLoading) return <p className="text-sm text-slate-500">Loading…</p>;
  if (error instanceof ApiError && error.status === 404) {
    return (
      <div>
        <p role="alert" className="mb-3 border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800">
          Unknown or invalid FAQ ID.
        </p>
        <Link href="/kb" className="text-sm text-sky-800 underline">
          Back to the knowledge base
        </Link>
      </div>
    );
  }
  if (error || !faq) return <p role="alert" className="text-sm text-red-700">{error?.message ?? "Unable to load the FAQ."}</p>;

  const category = categories.data?.find((c) => c.id === faq.category_id);
  return (
    <div>
      <p className="mb-2 text-sm">
        <Link href="/kb" className="text-sky-800 hover:underline">
          All Categories
        </Link>
        {" » "}
        <Link href={`/kb?cid=${faq.category_id}`} className="text-sky-800 hover:underline">
          {category?.name ?? "…"}
        </Link>
        {category && <span className="text-slate-500"> ({category.is_public ? "Public" : "Private"})</span>}
      </p>
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <h1 className="text-xl font-bold text-slate-800">{faq.question}</h1>
        {me && canManageFaqs(me) && (
          <div className="flex flex-wrap items-start gap-2">
            <Link href={`/kb/faqs/${faq.id}/edit`} className="rounded border border-slate-400 bg-white px-3 py-1.5 text-sm font-medium text-slate-800 hover:bg-slate-100">
              Edit FAQ
            </Link>
            <DeleteButton noun="FAQ" path={`/api/v1/kb/faqs/${faq.id}`} redirectTo={`/kb?cid=${faq.category_id}`} invalidate={kbKeys.faqs} />
          </div>
        )}
      </div>
      <p className="mb-3 text-xs text-slate-500">
        {faq.is_published ? "Published" : "Internal"} · Last Updated {formatDateTime(faq.updated)}
      </p>
      <div className="border border-slate-300 bg-white p-4 text-sm">
        <SafeHtml html={faq.answer ?? ""} />
      </div>
      {faq.keywords && <p className="mt-3 text-xs text-slate-500">Keywords: {faq.keywords}</p>}
      {faq.notes && (
        <p className="mt-2 border border-amber-200 bg-amber-50 px-3 py-2 text-sm">
          <strong>Internal notes:</strong> {faq.notes}
        </p>
      )}
    </div>
  );
}
