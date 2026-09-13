import Link from "next/link";

import { Button } from "@/components/ui/button";
import { getApiErrorKind } from "@/lib/apiError";

interface FailedQuery {
  error?: unknown;
  refetch: () => Promise<unknown>;
}

export function QueryError({ resource, queries }: { resource: string; queries: FailedQuery[] }) {
  const kinds = queries.map((query) => getApiErrorKind(query.error));

  if (kinds.some((kind) => kind === "forbidden" || kind === "not-found")) {
    return (
      <div role="alert" className="flex items-center justify-between gap-3 rounded-md border border-destructive/30 bg-background p-4 text-sm">
        <p>This {resource} was not found, or you do not have access to it.</p>
        <Link className="font-medium underline underline-offset-4" href="/projects">Back to projects</Link>
      </div>
    );
  }

  return (
    <div role="alert" className="flex items-center justify-between gap-3 rounded-md border border-destructive/30 bg-background p-4 text-sm">
      <p>
        Could not load {resource}.{" "}
        {kinds.includes("unavailable") ? "The service is temporarily unavailable." : "Please try again."}
      </p>
      <Button onClick={() => { queries.forEach((query) => { void query.refetch(); }); }} type="button" variant="outline">Retry</Button>
    </div>
  );
}
