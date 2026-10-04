// Fetch the backend's OpenAPI schema into openapi/openapi.json, pretty-printed with sorted keys so a
// backend contract change shows up as a small, reviewable diff.
import { writeFile } from "node:fs/promises";

const base = process.env.FASTAPI_URL ?? "http://localhost:8000";
const res = await fetch(`${base}/openapi.json`);
if (!res.ok) {
  console.error(`GET ${base}/openapi.json answered ${res.status}; is the dev backend running with API_DOCS_ENABLED=true?`);
  process.exit(1);
}

const sortKeys = (v) =>
  Array.isArray(v)
    ? v.map(sortKeys)
    : v && typeof v === "object"
      ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, sortKeys(v[k])]))
      : v;

const schema = sortKeys(await res.json());
await writeFile(new URL("../openapi/openapi.json", import.meta.url), JSON.stringify(schema, null, 2) + "\n");
console.log(`Wrote openapi/openapi.json (${Object.keys(schema.paths).length} paths) from ${base}`);
