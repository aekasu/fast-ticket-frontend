import { Suspense } from "react";
import { SearchResults } from "@/components/search-results";

export const metadata = { title: "Search" };

export default function SearchPage() {
  return (
    <Suspense>
      <SearchResults />
    </Suspense>
  );
}
