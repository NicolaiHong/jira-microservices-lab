import type { WorkspaceMember } from "../types";

interface MemberSelectProps {
  members: WorkspaceMember[];
  name: string;
  defaultValue?: string | null;
  disabled?: boolean;
  className?: string;
  "aria-label"?: string;
}

export function MemberSelect({
  members,
  name,
  defaultValue,
  disabled,
  className = "h-8 w-full rounded-md border border-input bg-background px-2 text-sm",
  "aria-label": ariaLabel = "Assignee",
}: MemberSelectProps) {
  const isFormerMember =
    Boolean(defaultValue) && !members.some((member) => member.userId === defaultValue);

  return (
    <select
      aria-label={ariaLabel}
      className={className}
      defaultValue={defaultValue ?? ""}
      disabled={disabled}
      name={name}
    >
      <option value="">Unassigned</option>
      {isFormerMember ? <option value={defaultValue ?? ""}>Former member</option> : null}
      {members.map((member) => (
        <option key={member.userId} value={member.userId}>
          {member.email ?? member.userId}
        </option>
      ))}
    </select>
  );
}
