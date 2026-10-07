"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { ApiError } from "@/lib/api/errors";
import { getJson } from "@/lib/api/raw";
import { ADMIN_MENU, type AdminItem } from "@/lib/admin/menu";
import { RESOURCES, type FieldDef, type ResourceDef, type Row } from "@/lib/admin/resources";
import { createdId } from "@/lib/queries/directory";
import { useAdminLookups, usePermissionKeys } from "@/lib/queries/admin-lookups";
import { useSubmitCommand } from "@/lib/queries/submit";
import { field } from "./action-ui";
import { DeleteButton } from "./delete-button";
import { FormButtons, FormError, FormRow, formBox } from "./form-kit";
import { DepartmentMembersEditor, ListItemsEditor, ScheduleEntriesEditor, StaffAccessEditor, TemplateMessagesEditor, TeamMembersEditor, TopicFormsEditor } from "./admin-relations";
import { FormFieldsAdmin } from "./form-fields";
import { Info } from "./info-table";
import { Pager } from "./pager";

const PAGE_SIZE = 50;
const link = "rounded border border-slate-400 bg-white px-3 py-1.5 text-sm font-medium text-slate-800 hover:bg-slate-100";

const adminKeys = (res: ResourceDef) => [["admin", res.key] as const, ["reference"] as const];

export function AdminHome() {
  return (
    <div>
      <h1 className="mb-3 text-xl font-bold text-slate-800">Admin Panel</h1>
      <p className="mb-4 text-sm text-slate-600">
        Pages marked <span className="text-slate-400">dimmed</span> exist in osTicket&apos;s Admin Panel but have no endpoint in the API yet, so they are not offered here.
      </p>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {ADMIN_MENU.map((g) => (
          <section key={g.key} className="border border-slate-300 bg-white">
            <h2 className="border-b border-slate-300 bg-slate-100 px-4 py-2 text-sm font-bold text-slate-800">{g.label}</h2>
            <ul className="space-y-1 p-4 text-sm">
              {g.items.map((i) => (
                <li key={i.slug}>
                  <Link href={`/admin/${i.slug}`} className={i.resource || i.screen ? "text-sky-800 hover:underline" : "text-slate-400 hover:underline"}>
                    {i.label}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}

export function Unavailable({ item }: { item: AdminItem }) {
  return (
    <div>
      <h1 className="mb-3 text-xl font-bold text-slate-800">{item.label}</h1>
      <p role="status" className="max-w-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-700">
        This page of osTicket&apos;s Admin Panel{item.page ? ` (${item.page})` : ""} has no endpoint in the API yet, so it is not offered here. See
        the backend requests in this project&apos;s notes.
      </p>
    </div>
  );
}

export function AdminList({ resourceKey }: { resourceKey: string }) {
  const resource = RESOURCES[resourceKey];
  const router = useRouter();
  const params = useSearchParams();
  const lk = useAdminLookups();
  const page = Math.max(1, Number(params.get("page")) || 1);
  const { data, error, isFetching } = useQuery({
    queryKey: ["admin", resource.key, "list", page],
    queryFn: () => getJson<{ items: Row[] }>(`${resource.path}?page=${page}&page_size=${PAGE_SIZE}`),
    placeholderData: keepPreviousData,
  });

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-bold text-slate-800">{resource.title}</h1>
        <span className="text-xs text-slate-500">{isFetching ? "Loading…" : ""}</span>
        {resource.canCreate !== false && (
          <Link href={`/admin/${resource.key}/new`} className="rounded bg-sky-800 px-3 py-1.5 text-sm font-semibold text-white hover:bg-sky-900">
            Add New {resource.singular.replace(/^./, (c) => c.toUpperCase())}
          </Link>
        )}
      </div>
      {error && <p role="alert" className="mb-3 text-sm text-red-700">{error.message}</p>}
      <div className="overflow-x-auto border border-slate-300 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-100 text-xs uppercase tracking-wide text-slate-600">
            <tr>
              {resource.columns.map((c) => (
                <th key={c.label} className="px-3 py-2 font-semibold">
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data?.items.map((item) => (
              <tr key={String(item.id)} className="border-t border-slate-200 hover:bg-sky-50">
                {resource.columns.map((c, i) => (
                  <td key={c.label} className="whitespace-nowrap px-3 py-2">
                    {i === 0 && !resource.listOnly ? (
                      <Link href={`/admin/${resource.key}/${item.id}`} className="font-medium text-sky-800 hover:underline">
                        {c.value(item, lk) || "—"}
                      </Link>
                    ) : (
                      c.value(item, lk)
                    )}
                  </td>
                ))}
              </tr>
            ))}
            {data && data.items.length === 0 && (
              <tr>
                <td colSpan={resource.columns.length} className="px-3 py-6 text-center text-slate-500">
                  Query returned 0 results.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {resource.listNote && <p className="mt-2 text-xs text-slate-500">{resource.listNote}</p>}
      <Pager page={page} hasNext={(data?.items.length ?? 0) === PAGE_SIZE} onPage={(p) => router.push(`/admin/${resource.key}?page=${p}`)} />
    </div>
  );
}

export function AdminView({ resourceKey, id }: { resourceKey: string; id: number }) {
  const resource = RESOURCES[resourceKey];
  const lk = useAdminLookups();
  const { data, error, isLoading } = useQuery({
    queryKey: ["admin", resource.key, "detail", id],
    queryFn: () => getJson(`${resource.path}/${id}`),
    retry: false,
  });

  if (isLoading || lk.loading) return <p className="text-sm text-slate-500">Loading…</p>;
  if (error instanceof ApiError && error.status === 404) {
    return (
      <div>
        <p role="alert" className="mb-3 border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800">
          Unknown or invalid {resource.singular} ID.
        </p>
        <Link href={`/admin/${resource.key}`} className="text-sm text-sky-800 underline">
          Back to {resource.title.toLowerCase()}
        </Link>
      </div>
    );
  }
  if (error || !data) return <p role="alert" className="text-sm text-red-700">{error?.message ?? "Unable to load."}</p>;

  const rows = resource.info.map(([label, value]) => [label, value(data, lk)] as [string, string]);
  const half = Math.ceil(rows.length / 2);
  const deletable = resource.canDelete ? resource.canDelete(data) : true;

  return (
    <div>
      <p className="mb-2 text-sm">
        <Link href={`/admin/${resource.key}`} className="text-sky-800 hover:underline">
          ← {resource.title}
        </Link>
      </p>
      <h1 className="mb-3 text-xl font-bold text-slate-800">{resource.name(data)}</h1>
      <div className="mb-4 flex flex-wrap items-start gap-2">
        <Link href={`/admin/${resource.key}/${id}/edit`} className={link}>
          Update
        </Link>
        {deletable && (
          <DeleteButton noun={resource.singular} path={`${resource.path}/${id}`} redirectTo={`/admin/${resource.key}`} invalidate={["admin", resource.key]} />
        )}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Info rows={rows.slice(0, half)} />
        <Info rows={rows.slice(half)} />
      </div>
      {resource.key === "teams" && <TeamMembersEditor id={id} data={data} />}
      {resource.key === "departments" && <DepartmentMembersEditor id={id} data={data} />}
      {resource.key === "staff" && <StaffAccessEditor id={id} data={data} />}
      {resource.key === "schedules" && <ScheduleEntriesEditor id={id} data={data} />}
      {resource.key === "templates" && <TemplateMessagesEditor id={id} data={data} />}
      {resource.key === "lists" && <ListItemsEditor id={id} data={data} />}
      {resource.key === "topics" && <TopicFormsEditor id={id} data={data} />}
      {resource.key === "forms" && <FormFieldsAdmin formId={id} fields={(data.fields as never[]) ?? []} />}
      {resource.sections?.map((section) => {
        const sectionRows = section.rows(data, lk);
        return (
          <section key={section.title} className="mt-6">
            <h2 className="border-b border-slate-300 pb-1 text-sm font-semibold text-slate-800">
              {section.title} ({sectionRows.length})
            </h2>
            <table className="mt-2 w-full border border-slate-300 bg-white text-left text-sm">
              <thead className="bg-slate-100 text-xs uppercase tracking-wide text-slate-600">
                <tr>
                  {section.headers.map((h) => (
                    <th key={h} className="px-3 py-2 font-semibold">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sectionRows.map((r, i) => (
                  <tr key={i} className="border-t border-slate-200">
                    {r.map((c, j) => (
                      <td key={j} className="px-3 py-2">
                        {c}
                      </td>
                    ))}
                  </tr>
                ))}
                {sectionRows.length === 0 && (
                  <tr>
                    <td colSpan={section.headers.length} className="px-3 py-3 text-center text-slate-500">
                      None.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </section>
        );
      })}
    </div>
  );
}

/** A role's permissions: the role-kind keys of `GET /permissions`, as checkboxes grouped by their prefix. */
function PermissionChecks({ name, held }: { name: string; held: string[] }) {
  const keys = usePermissionKeys().data?.filter((p) => p.kind === "role").map((p) => p.key) ?? [];
  const groups = [...new Set(keys.map((k) => k.split(".")[0]))];
  return (
    <div className="space-y-2" role="group" aria-label="Permissions">
      {groups.map((g) => (
        <fieldset key={g} className="flex flex-wrap gap-x-4 gap-y-1">
          <legend className="text-xs font-semibold uppercase tracking-wide text-slate-600">{g}</legend>
          {keys.filter((k) => k.startsWith(`${g}.`)).map((k) => (
            <label key={k} className="flex items-center gap-1 text-sm">
              <input type="checkbox" name={`${name}:${k}`} defaultChecked={held.includes(k)} /> {k.slice(g.length + 1)}
            </label>
          ))}
        </fieldset>
      ))}
    </div>
  );
}

function FieldInput({ f, data, lk }: { f: FieldDef; data?: Row; lk: ReturnType<typeof useAdminLookups> }) {
  const current = data?.[f.name];
  if (f.kind === "bool") {
    return (
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name={f.name} defaultChecked={data ? Boolean(current) : Boolean(f.defaultChecked)} />
        {f.label}
      </label>
    );
  }
  if (f.kind === "permissions") {
    return (
      <div>
        <PermissionChecks name={f.name} held={(current as string[]) ?? []} />
        {f.help && <p className="mt-1 text-xs text-slate-500">{f.help}</p>}
      </div>
    );
  }
  const common = { name: f.name, required: f.required, "aria-label": f.label, className: field };
  let input: React.ReactNode;
  if (f.kind === "textarea") input = <textarea {...common} rows={4} defaultValue={s(current)} />;
  else if (f.kind === "select") {
    const options = f.optionsFrom ? lk.options[f.optionsFrom].map((o) => ({ value: String(o.value), label: o.label })) : (f.options ?? []);
    const value = current == null || current === 0 ? "" : String(current);
    input = (
      <select {...common} defaultValue={value}>
        <option value="">{f.options ? "— Default —" : "— None —"}</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    );
  } else if (f.kind === "password") input = <input {...common} type="password" autoComplete="new-password" />;
  else if (f.kind === "number") input = <input {...common} type="number" defaultValue={s(current)} />;
  else input = <input {...common} type={f.kind === "email" ? "email" : "text"} defaultValue={s(current)} autoComplete="off" />;
  return (
    <div>
      {input}
      {f.help && <p className="mt-1 text-xs text-slate-500">{f.help}</p>}
    </div>
  );
}

const s = (v: unknown) => (v == null ? "" : String(v));

function AdminFormBody({ resource, data }: { resource: ResourceDef; data?: Row }) {
  const lk = useAdminLookups();
  const { submit, error, setError, busy } = useSubmitCommand(adminKeys(resource));
  const fields = resource.fields.filter((f) => (data ? f.on !== "create" : f.on !== "edit"));
  if (lk.loading) return <p className="text-sm text-slate-500">Loading…</p>;

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const body: Record<string, unknown> = {};
    for (const f of fields) {
      if (f.kind === "permissions") {
        const chosen = [...form.keys()].filter((k) => k.startsWith(`${f.name}:`)).map((k) => k.slice(f.name.length + 1)).sort();
        const cur = [...(((data?.[f.name] as string[]) ?? []))].sort();
        if (!data || JSON.stringify(chosen) !== JSON.stringify(cur)) body[f.name] = chosen;
        continue;
      }
      const raw = f.kind === "bool" ? form.get(f.name) === "on" : String(form.get(f.name) ?? "");
      let next: unknown;
      if (f.kind === "bool") next = raw;
      else if (f.kind === "number") next = raw === "" ? undefined : Number(raw);
      else if (f.kind === "select" && f.optionsFrom) next = raw === "" ? (f.none ?? null) : Number(raw);
      else next = typeof raw === "string" ? (f.kind === "textarea" ? raw : raw.trim()) : raw;

      if (data) {
        const cur = data[f.name];
        const same =
          f.kind === "select" && f.optionsFrom
            ? (Number(cur) || null) === (Number(next) || null)
            : f.kind === "password"
              ? next === ""
              : (cur ?? (f.kind === "bool" ? false : "")) === next || (next === undefined && cur == null);
        if (!same) body[f.name] = next;
      } else if (next !== undefined && next !== "" && !(f.kind === "select" && next === (f.none ?? null) && f.optionsFrom)) {
        body[f.name] = next;
      }
    }
    if (data && Object.keys(body).length === 0) return setError("No changes to save.");
    if (!data && resource.createDefaults) Object.assign(body, resource.createDefaults);
    const id = data?.id;
    await submit(data ? "PATCH" : "POST", data ? `${resource.path}/${id}` : resource.path, body, (r) => `/admin/${resource.key}/${data ? id : createdId(r)}`);
  }

  return (
    <>
      <FormError message={error} />
      <form onSubmit={onSubmit} className={formBox}>
        {fields.map((f) =>
          f.kind === "bool" ? (
            <div key={f.name + f.on}>
              <FieldInput f={f} data={data} lk={lk} />
            </div>
          ) : (
            <FormRow key={f.name + f.on} label={f.label} required={f.required && !(data && f.on === undefined && f.kind === "password")}>
              <FieldInput f={f} data={data} lk={lk} />
            </FormRow>
          ),
        )}
        <FormButtons busy={busy} submitLabel={data ? "Save Changes" : `Add ${resource.singular.replace(/^./, (c) => c.toUpperCase())}`} cancelHref={data ? `/admin/${resource.key}/${data.id}` : `/admin/${resource.key}`} />
      </form>
    </>
  );
}

export function AdminNew({ resourceKey }: { resourceKey: string }) {
  const resource = RESOURCES[resourceKey];
  return (
    <div>
      <p className="mb-2 text-sm">
        <Link href={`/admin/${resource.key}`} className="text-sky-800 hover:underline">
          ← {resource.title}
        </Link>
      </p>
      <h1 className="mb-3 text-xl font-bold text-slate-800">Add New {resource.singular.replace(/^./, (c) => c.toUpperCase())}</h1>
      <AdminFormBody resource={resource} />
    </div>
  );
}

export function AdminEdit({ resourceKey, id }: { resourceKey: string; id: number }) {
  const resource = RESOURCES[resourceKey];
  const { data, error, isLoading } = useQuery({
    queryKey: ["admin", resource.key, "detail", id],
    queryFn: () => getJson(`${resource.path}/${id}`),
    retry: false,
  });
  if (isLoading) return <p className="text-sm text-slate-500">Loading…</p>;
  if (error instanceof ApiError && error.status === 404) return <p className="text-sm">Unknown or invalid {resource.singular} ID.</p>;
  if (error || !data) return <p role="alert" className="text-sm text-red-700">{error?.message ?? "Unable to load."}</p>;
  return (
    <div>
      <p className="mb-2 text-sm">
        <Link href={`/admin/${resource.key}/${id}`} className="text-sky-800 hover:underline">
          ← {resource.name(data)}
        </Link>
      </p>
      <h1 className="mb-3 text-xl font-bold text-slate-800">Update {resource.name(data)}</h1>
      <AdminFormBody resource={resource} data={data} />
    </div>
  );
}
