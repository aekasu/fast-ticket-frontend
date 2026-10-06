/** Categories in tree order (each parent followed by its children), with their depth. A category whose parent is not in the list is a root. */
export function nestCategories<T extends { id: number; parent_id?: number | null }>(items: T[]): (T & { depth: number })[] {
  const ids = new Set(items.map((c) => c.id));
  const children = new Map<number, T[]>();
  const roots: T[] = [];
  for (const c of items) {
    if (c.parent_id && ids.has(c.parent_id) && c.parent_id !== c.id) children.set(c.parent_id, [...(children.get(c.parent_id) ?? []), c]);
    else roots.push(c);
  }
  const out: (T & { depth: number })[] = [];
  const seen = new Set<number>();
  const walk = (c: T, depth: number) => {
    if (seen.has(c.id)) return; // a cycle in the data must not loop
    seen.add(c.id);
    out.push({ ...c, depth });
    for (const child of children.get(c.id) ?? []) walk(child, depth + 1);
  };
  roots.forEach((c) => walk(c, 0));
  items.forEach((c) => walk(c, 0)); // anything unreachable (a cycle) is still listed
  return out;
}
