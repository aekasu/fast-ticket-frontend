"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import type { components } from "@/lib/api/schema";
import { ApiError } from "@/lib/api/errors";
import { canManageFaqs } from "@/lib/nav";
import { createdId } from "@/lib/queries/directory";
import { kbKeys, useCategories, useFaq } from "@/lib/queries/kb";
import { useMe } from "@/lib/queries/me";
import { useSubmitCommand } from "@/lib/queries/submit";
import { field } from "./action-ui";
import { FormButtons, FormError, FormRow, formBox } from "./form-kit";

type Faq = components["schemas"]["FAQDetail"];

function FaqFormBody({ faq, presetCategory }: { faq?: Faq; presetCategory?: number }) {
  const categories = useCategories();
  const { submit, error, setError, busy } = useSubmitCommand([kbKeys.faqs, kbKeys.categories]);
  if (categories.isLoading) return <p className="text-sm text-slate-500">Loading…</p>;

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const text = (name: string) => String(form.get(name) ?? "");
    const next = {
      category_id: Number(text("category_id")),
      question: text("question").trim(),
      answer: text("answer"),
      keywords: text("keywords").trim(),
      notes: text("notes"),
      is_published: form.get("is_published") === "1",
    };
    if (faq) {
      const body: Record<string, unknown> = {};
      for (const k of Object.keys(next) as (keyof typeof next)[]) if (next[k] !== (faq[k] ?? (k === "is_published" ? false : ""))) body[k] = next[k];
      if (Object.keys(body).length === 0) return setError("No changes to save.");
      await submit("PATCH", `/api/v1/kb/faqs/${faq.id}`, body, () => `/kb/faqs/${faq.id}`);
    } else {
      await submit("POST", "/api/v1/kb/faqs", next, (r) => `/kb/faqs/${createdId(r)}`);
    }
  }

  return (
    <>
      <FormError message={error} />
      <form onSubmit={onSubmit} className={formBox}>
        <FormRow label="Category" required>
          <select name="category_id" required defaultValue={faq?.category_id ?? presetCategory ?? ""} className={field}>
            <option value="" disabled>
              — Select a category —
            </option>
            {categories.data?.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </FormRow>
        <FormRow label="Question" required>
          <input name="question" required defaultValue={faq?.question} maxLength={255} className={field} />
        </FormRow>
        <FormRow label="Answer" required>
          <textarea name="answer" required rows={10} defaultValue={faq?.answer ?? ""} className={field} />
        </FormRow>
        <FormRow label="Keywords">
          <input name="keywords" defaultValue={faq?.keywords ?? ""} className={field} />
        </FormRow>
        <FormRow label="Listing Type">
          <select name="is_published" defaultValue={faq ? (faq.is_published ? "1" : "0") : "1"} className={field}>
            <option value="1">Published</option>
            <option value="0">Internal (private)</option>
          </select>
        </FormRow>
        <FormRow label="Internal Notes">
          <textarea name="notes" rows={3} defaultValue={faq?.notes ?? ""} className={field} />
        </FormRow>
        <p className="text-xs text-slate-500">The answer is HTML. Attachments cannot be uploaded yet.</p>
        <FormButtons busy={busy} submitLabel={faq ? "Save Changes" : "Add FAQ"} cancelHref={faq ? `/kb/faqs/${faq.id}` : "/kb"} />
      </form>
    </>
  );
}

export function FaqNew() {
  const params = useSearchParams();
  const preset = /^\d+$/.test(params.get("category_id") ?? "") ? Number(params.get("category_id")) : undefined;
  return (
    <div>
      <p className="mb-2 text-sm">
        <Link href="/kb" className="text-sky-800 hover:underline">
          ← Knowledge Base
        </Link>
      </p>
      <h1 className="mb-3 text-xl font-bold text-slate-800">Add New FAQ</h1>
      <FaqFormBody presetCategory={preset} />
    </div>
  );
}

export function FaqEdit({ id }: { id: number }) {
  const { data: me } = useMe();
  const { data: faq, error, isLoading } = useFaq(id);
  if (isLoading) return <p className="text-sm text-slate-500">Loading…</p>;
  if (error instanceof ApiError && error.status === 404) return <p className="text-sm">Unknown or invalid FAQ ID.</p>;
  if (error || !faq) return <p role="alert" className="text-sm text-red-700">{error?.message ?? "Unable to load the FAQ."}</p>;
  if (me && !canManageFaqs(me)) return <p className="text-sm">Access denied. You do not have permission to manage FAQs.</p>;
  return (
    <div>
      <p className="mb-2 text-sm">
        <Link href={`/kb/faqs/${faq.id}`} className="text-sky-800 hover:underline">
          ← {faq.question}
        </Link>
      </p>
      <h1 className="mb-3 text-xl font-bold text-slate-800">Update FAQ</h1>
      <FaqFormBody faq={faq} />
    </div>
  );
}
