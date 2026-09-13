"use client";

import { FormEvent } from "react";
import { UserPlusIcon } from "lucide-react";
import { toast } from "sonner";
import { QueryError } from "@/components/shared/QueryError";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { toastApiError } from "@/lib/apiError";
import { useManageWorkspaceMembers, useWorkspaceMembers } from "../hooks/useProjects";
import type { WorkspaceMember, WorkspaceRole } from "../types";

const selectClass = "h-8 rounded-md border border-input bg-background px-2 text-sm";

export function WorkspaceMembers({
  workspaceId,
  actorRole,
}: {
  workspaceId: string;
  actorRole: WorkspaceRole;
}) {
  const members = useWorkspaceMembers(workspaceId);
  const { add, changeRole, remove } = useManageWorkspaceMembers(workspaceId);
  const canManage = actorRole === "OWNER" || actorRole === "ADMIN";
  // Only an owner can grant or change owner memberships (WS-002).
  const assignableRoles: WorkspaceRole[] =
    actorRole === "OWNER" ? ["MEMBER", "ADMIN", "OWNER"] : ["MEMBER", "ADMIN"];
  const canManageMember = (member: WorkspaceMember) =>
    canManage && (actorRole === "OWNER" || member.role !== "OWNER");

  async function submitAdd(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    try {
      await add.mutateAsync({
        email: String(form.get("email") ?? "").trim(),
        role: String(form.get("role") ?? "MEMBER") as WorkspaceRole,
      });
      formElement.reset();
      toast.success("Member added");
    } catch (error) {
      toastApiError(error, "Could not add member");
    }
  }

  async function updateRole(member: WorkspaceMember, role: WorkspaceRole) {
    try {
      await changeRole.mutateAsync({ userId: member.userId, role });
      toast.success("Role updated");
    } catch (error) {
      toastApiError(error, "Could not change role");
    }
  }

  async function removeMember(member: WorkspaceMember) {
    if (!window.confirm(`Remove ${member.email ?? member.userId} from this workspace?`)) {
      return;
    }
    try {
      await remove.mutateAsync(member.userId);
      toast.success("Member removed");
    } catch (error) {
      toastApiError(error, "Could not remove member");
    }
  }

  return (
    <Card className="border-foreground/15 bg-background/85">
      <CardHeader><p className="eyebrow">People</p><CardTitle className="mt-1">Workspace members</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        {canManage ? (
          <form className="grid gap-2 sm:grid-cols-[1fr_130px_auto]" onSubmit={submitAdd}>
            <Input aria-label="Member email" name="email" placeholder="teammate@example.com" required type="email" />
            <select aria-label="New member role" className={selectClass} defaultValue="MEMBER" name="role">
              {assignableRoles.map((role) => <option key={role} value={role}>{role}</option>)}
            </select>
            <Button disabled={add.isPending} type="submit"><UserPlusIcon /> Add member</Button>
          </form>
        ) : null}
        {members.isPending ? <p className="text-sm text-muted-foreground">Loading members…</p> : null}
        {members.isError ? <QueryError resource="members" queries={[members]} /> : null}
        <ul className="divide-y divide-border">
          {members.data?.map((member) => (
            <li className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm" key={member.userId}>
              <span className="min-w-0 truncate">{member.email ?? member.userId}</span>
              {canManageMember(member) ? (
                <span className="flex items-center gap-2">
                  <select
                    aria-label={`Role for ${member.email ?? member.userId}`}
                    className={selectClass}
                    disabled={changeRole.isPending}
                    onChange={(event) => void updateRole(member, event.target.value as WorkspaceRole)}
                    value={member.role}
                  >
                    {assignableRoles.map((role) => <option key={role} value={role}>{role}</option>)}
                  </select>
                  <Button disabled={remove.isPending} onClick={() => void removeMember(member)} size="sm" type="button" variant="outline">Remove</Button>
                </span>
              ) : (
                <span className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">{member.role}</span>
              )}
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
