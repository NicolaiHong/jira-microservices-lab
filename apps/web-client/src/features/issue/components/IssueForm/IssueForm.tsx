import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function IssueForm() {
  return (
    <form className="flex flex-col gap-3">
      <Input disabled placeholder="Issue title" />
      <Button disabled type="button">
        Create issue
      </Button>
    </form>
  );
}
