"use client";

import { useEffect } from "react";
import { SearchUnavailable } from "@/components/search/search-unavailable";
import { Button } from "@/components/ui/button";
import { SEARCH_UNAVAILABLE_RETRY_LABEL } from "@/lib/search-unavailable-copy";

export default function SearchError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[search] page render failed");
  }, []);

  return (
    <div className="container" style={{ paddingTop: 36, paddingBottom: 80 }}>
      <SearchUnavailable
        retryAction={
          <Button type="button" variant="primary" onClick={reset}>
            {SEARCH_UNAVAILABLE_RETRY_LABEL}
          </Button>
        }
      />
    </div>
  );
}
