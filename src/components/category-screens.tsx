"use client";

import Link from "next/link";
import type { components } from "@/lib/api/schema";
import { ApiError } from "@/lib/api/errors";
import { formatDateTime } from "@/lib/format";
import { nestCategories } from "@/lib/kb";
import { canManageCanned, canManageFaqs } from "@/lib/nav";
import { createdId } from "@/lib/queries/directory";
import { kbKeys, useCategories, useCategory } from "@/lib/queries/kb";
import { useMe } from "@/lib/queries/me";
import { useSubmitCommand } from "@/lib/queries/submit";
import { field } from "./action-ui";
import { FormButtons, FormError, FormRow, formBox } from "./form-kit";
import { KbTabs } from "./kb-tabs";

type Category = components["schemas"]["CategoryDetail"];

export function CategoryList() {
  const { data: me } = useMe();
  const categories = useCategories();
  return (
    <div>
      <KbTabs current="categories" showCanned={me ? canManageCanned(me) : false} />
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-bold text-slate-800">FAQ Categories</h1>
        {me && canManageFaqs(me) && (
          <Link href="/kb/categories/new" className="rounded bg-sky-800 px-3 py-1.5 text-sm font-semibold text-white hover:bg-sky-900">
            Add New Category
          </Link>
        )}
      </div>
      {categories.error && <p role="alert" className="mb-3 text-sm text-red-700">{categories.error.message}</p>}
      <div className="overflow-x-auto border border-slate-300 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-100 text-xs uppercase tracking-wide text-slate-600">
            <tr>
              {["Name", "Type", "FAQs", "Last Updated"].map((h) => (
                <th key={h} className="px-3 py-2 font-semibold">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {nestCategories(categories.data ?? []).map((c) => (
              <tr key={c.id} className="border-t border-slate-200 hover:bg-sky-50">
                <td className="py-2 pr-3" style={{ paddingLeft: `${0.75 + c.depth * 1.25}rem` }}>
                  <Link href={`/kb?cid=${c.id}`} className="font-medium text-sky-800 hover:underline">
                    {c.name}
                  </Link>
                </td>
                <td className="px-3 py-2">{c.is_public ? "Public" : "Private"}</td>
                <td className="px-3 py-2">{c.faq_count}</td>
                <td className="whitespace-nowrap px-3 py-2">{formatDateTime(c.updated)}</td>
              </tr>
            ))}
            {categories.data?.length === 0 && (
              <tr>
                <td colSpan={4} className="px-3 py-6 text-center text-slate-500">
                  No FAQ categories found!
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function CategoryFormBody({ category }: { category?: Category }) {
  const { submit, error, setError, busy } = useSubmitCommand([kbKeys.categories, kbKeys.faqs]);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const text = (name: string) => String(form.get(name) ?? "");
    const next = { name: text("name").trim(), description: text("description"), notes: text("notes"), is_public: text("is_public") === "1" };
    if (category) {
      const body: Record<string, unknown> = {};
      for (const k of Object.keys(next) as (keyof typeof next)[]) if (next[k] !== (category[k] ?? (k === "is_public" ? false : ""))) body[k] = next[k];
      if (Object.keys(body).length === 0) return setError("No changes to save.");
      await submit("PATCH", `/api/v1/kb/categories/${category.id}`, body, () => `/kb?cid=${category.id}`);
    } else {
      await submit("POST", "/api/v1/kb/categories", next, (r) => `/kb?cid=${createdId(r)}`);
    }
  }

  return (
    <>
      <FormError message={error} />
      <form onSubmit={onSubmit} className={formBox}>
        <FormRow label="Category Type" required>
          <select name="is_public" defaultValue={category ? (category.is_public ? "1" : "0") : "1"} className={field}>
            <option value="1">Public (publish)</option>
            <option value="0">Private (internal)</option>
          </select>
        </FormRow>
        <FormRow label="Name" required>
          <input name="name" required defaultValue={category?.name} maxLength={255} className={field} />
        </FormRow>
        <FormRow label="Category Description" required>
          <textarea name="description" required rows={4} defaultValue={category?.description ?? ""} className={field} />
        </FormRow>
        <FormRow label="Internal Notes">
          <textarea name="notes" rows={3} defaultValue={category?.notes ?? ""} className={field} />
        </FormRow>
        <FormButtons busy={busy} submitLabel={category ? "Save Changes" : "Add Category"} cancelHref={category ? `/kb?cid=${category.id}` : "/kb/categories"} />
      </form>
    </>
  );
}

export function CategoryNew() {
  return (
    <div>
      <p className="mb-2 text-sm">
        <Link href="/kb/categories" className="text-sky-800 hover:underline">
          ← Categories
        </Link>
      </p>
      <h1 className="mb-3 text-xl font-bold text-slate-800">Add New Category</h1>
      <CategoryFormBody />
    </div>
  );
}

export function CategoryEdit({ id }: { id: number }) {
  const { data: me } = useMe();
  const { data: category, error, isLoading } = useCategory(id);
  if (isLoading) return <p className="text-sm text-slate-500">Loading…</p>;
  if (error instanceof ApiError && error.status === 404) return <p className="text-sm">Unknown or invalid category ID.</p>;
  if (error || !category) return <p role="alert" className="text-sm text-red-700">{error?.message ?? "Unable to load the category."}</p>;
  if (me && !canManageFaqs(me)) return <p className="text-sm">Access denied. You do not have permission to manage FAQs.</p>;
  return (
    <div>
      <p className="mb-2 text-sm">
        <Link href={`/kb?cid=${category.id}`} className="text-sky-800 hover:underline">
          ← {category.name}
        </Link>
      </p>
      <h1 className="mb-3 text-xl font-bold text-slate-800">Update Category</h1>
      <CategoryFormBody category={category} />
    </div>
  );
}
