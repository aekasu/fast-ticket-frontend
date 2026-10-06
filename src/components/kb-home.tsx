"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { formatDateTime } from "@/lib/format";
import { nestCategories } from "@/lib/kb";
import { canManageCanned, canManageFaqs } from "@/lib/nav";
import { kbKeys, useCategories, useFaqs } from "@/lib/queries/kb";
import { useMe } from "@/lib/queries/me";
import { DeleteButton } from "./delete-button";
import { KbTabs } from "./kb-tabs";

const link = "rounded border border-slate-400 bg-white px-3 py-1.5 text-sm font-medium text-slate-800 hover:bg-slate-100";

/** osTicket's kb.php: categories with their FAQ counts on the left; the categories, or one category's FAQs, beside. */
export function KbHome() {
  const router = useRouter();
  const params = useSearchParams();
  const { data: me } = useMe();
  const categories = useCategories();
  const cid = /^\d+$/.test(params.get("cid") ?? "") ? Number(params.get("cid")) : undefined;
  const q = params.get("q")?.trim() ?? "";
  const [search, setSearch] = useState(q);
  const selected = categories.data?.find((c) => c.id === cid);
  // The API filters and searches: one category's FAQs, or the FAQs matching a search (osTicket's kb.php?q=).
  const faqs = useFaqs({ category_id: cid, q: q || undefined }, cid !== undefined || q !== "");
  const inCategory = faqs.data ?? [];
  const tree = nestCategories(categories.data ?? []);
  const total = categories.data?.reduce((sum, c) => sum + c.faq_count, 0);
  const manage = me ? canManageFaqs(me) : false;

  return (
    <div>
      <KbTabs current="faqs" showCanned={me ? canManageCanned(me) : false} />
      {(categories.error || faqs.error) && <p role="alert" className="mb-3 text-sm text-red-700">{(categories.error ?? faqs.error)?.message}</p>}

      <div className="grid gap-6 md:grid-cols-[16rem_1fr]">
        <nav aria-label="Categories" className="border border-slate-300 bg-white text-sm">
          <h2 className="border-b border-slate-300 bg-slate-100 px-3 py-2 font-semibold text-slate-800">Category</h2>
          <ul>
            <li>
              <Link href="/kb" className={`block px-3 py-1.5 hover:bg-sky-50 ${cid === undefined ? "font-bold" : "text-sky-800"}`}>
                All Categories ({total ?? "…"})
              </Link>
            </li>
            {tree.map((c) => (
              <li key={c.id}>
                <Link href={`/kb?cid=${c.id}`} style={{ paddingLeft: `${0.75 + c.depth * 1}rem` }} className={`block py-1.5 pr-3 hover:bg-sky-50 ${c.id === cid ? "font-bold" : "text-sky-800"}`}>
                  {c.name} ({c.faq_count})
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <section>
          <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
            <h1 className="text-xl font-bold text-slate-800">Frequently Asked Questions</h1>
            {manage && (
              <Link href={selected ? `/kb/faqs/new?category_id=${selected.id}` : "/kb/faqs/new"} className="rounded bg-sky-800 px-3 py-1.5 text-sm font-semibold text-white hover:bg-sky-900">
                Add New FAQ
              </Link>
            )}
          </div>

          <form
            className="mb-3 flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              const next = new URLSearchParams();
              if (search.trim()) next.set("q", search.trim());
              if (cid !== undefined && search.trim()) next.set("cid", String(cid));
              router.push(next.size ? `/kb?${next.toString()}` : "/kb");
            }}
          >
            <input type="search" aria-label="Search FAQs" value={search} onChange={(e) => setSearch(e.target.value)} maxLength={100} placeholder="Search the FAQs" className="w-72 rounded border border-slate-300 bg-white px-3 py-1.5 text-sm" />
            <button type="submit" className="rounded bg-sky-800 px-3 py-1.5 text-sm font-semibold text-white hover:bg-sky-900">
              Search
            </button>
            {q && (
              <Link href="/kb" onClick={() => setSearch("")} className="self-center text-sm text-sky-800 underline">
                Clear
              </Link>
            )}
          </form>

          {q ? (
            <>
              <h2 className="mb-2 text-lg font-semibold text-slate-800">Search results for “{q}”</h2>
              <ul className="space-y-2">
                {inCategory.map((f) => (
                  <li key={f.id} className="border border-slate-300 bg-white px-3 py-2 text-sm">
                    <Link href={`/kb/faqs/${f.id}`} className="font-medium text-sky-800 hover:underline">
                      {f.question}
                    </Link>{" "}
                    <span className="text-slate-500">- {f.is_published ? "Published" : "Internal"}</span>
                  </li>
                ))}
                {faqs.data && inCategory.length === 0 && <li className="text-sm text-slate-500">No FAQs match your search.</li>}
              </ul>
            </>
          ) : !selected ? (
            <>
              <p className="mb-3 text-sm text-slate-600">Click on the category to browse FAQs or manage its existing FAQs.</p>
              <ul className="space-y-3">
                {categories.data?.map((c) => (
                  <li key={c.id} className="border border-slate-300 bg-white p-3 text-sm">
                    <Link href={`/kb?cid=${c.id}`} className="font-semibold text-sky-800 hover:underline">
                      {c.name} ({c.faq_count})
                    </Link>{" "}
                    <span className="text-slate-500">- {c.is_public ? "Public" : "Private"}</span>
                    {c.description && <p className="mt-1 text-slate-600">{c.description}</p>}
                  </li>
                ))}
                {categories.data?.length === 0 && <li className="text-sm text-slate-500">No FAQ categories found.</li>}
              </ul>
            </>
          ) : (
            <>
              <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h2 className="text-lg font-semibold text-slate-800">
                    {selected.name} <span className="text-sm font-normal text-slate-500">({selected.is_public ? "Public" : "Private"})</span>
                  </h2>
                  <p className="text-xs text-slate-500">Last Updated {formatDateTime(selected.updated)}</p>
                  {selected.description && <p className="mt-1 text-sm text-slate-600">{selected.description}</p>}
                </div>
                {manage && (
                  <div className="flex flex-wrap items-start gap-2">
                    <Link href={`/kb/categories/${selected.id}/edit`} className={link}>
                      Edit Category
                    </Link>
                    <DeleteButton noun="category" path={`/api/v1/kb/categories/${selected.id}`} redirectTo="/kb" invalidate={[...kbKeys.categories, ...kbKeys.faqs]} />
                  </div>
                )}
              </div>
              <ul className="space-y-2">
                {inCategory.map((f) => (
                  <li key={f.id} className="border border-slate-300 bg-white px-3 py-2 text-sm">
                    <Link href={`/kb/faqs/${f.id}`} className="font-medium text-sky-800 hover:underline">
                      {f.question}
                    </Link>{" "}
                    <span className="text-slate-500">- {f.is_published ? "Published" : "Internal"}</span>
                  </li>
                ))}
                {faqs.data && inCategory.length === 0 && <li className="text-sm text-slate-500">This category does not have any FAQs.</li>}
              </ul>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
