import { Button } from "@/components/ui/button";

export function QueryError({ resource, queries }: { resource: string; queries: { refetch: () => Promise<unknown> }[] }) {
  return (
    <div role="alert" className="flex items-center justify-between gap-3 rounded-md border border-destructive/30 bg-background p-4 text-sm">
      <p>Could not load {resource}. Please try again.</p>
      <Button onClick={() => { queries.forEach((query) => { void query.refetch(); }); }} type="button" variant="outline">Retry</Button>
    </div>
  );
}
