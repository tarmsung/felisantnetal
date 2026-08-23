"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { KeyRound } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { UserRoleBadge } from "@/components/users/user-role-badge";
import { ResetPasswordDialog } from "@/components/users/reset-password-dialog";
import { updateUserRoleAction, updateUserStatusAction } from "@/app/(app)/users/actions";
import { formatDisplayDate } from "@/lib/dates";
import type { UserRole, UserRow } from "@/types/database";

const ROLE_OPTIONS: { value: UserRole; label: string }[] = [
  { value: "nurse", label: "Nurse" },
  { value: "administrator", label: "Administrator" },
];

export function ManageUserSheet({
  user,
  isSelf,
  open,
  onOpenChange,
  onChanged,
}: {
  user: UserRow | null;
  isSelf: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onChanged?: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [resetOpen, setResetOpen] = useState(false);

  if (!user) return null;

  function handleRoleChange(role: string | null) {
    if (!user || !role) return;
    startTransition(async () => {
      const result = await updateUserRoleAction(user.id, { role: role as UserRole });
      if (result.status === "error") {
        toast.error(result.message ?? "Failed to update role.");
        return;
      }
      toast.success("Role updated.");
      onChanged?.();
    });
  }

  function handleStatusChange(active: boolean) {
    if (!user) return;
    startTransition(async () => {
      const result = await updateUserStatusAction(user.id, { status: active ? "active" : "inactive" });
      if (result.status === "error") {
        toast.error(result.message ?? "Failed to update status.");
        return;
      }
      toast.success(active ? "Account activated." : "Account deactivated.");
      onChanged?.();
    });
  }

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="flex flex-col gap-5 overflow-y-auto sm:max-w-md">
          <SheetHeader>
            <SheetTitle>{user.full_name}</SheetTitle>
            <SheetDescription>{user.email}</SheetDescription>
          </SheetHeader>

          <div className="flex flex-col gap-5 px-4">
            <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-sm">
              <dt className="text-muted-foreground">Phone</dt>
              <dd>{user.phone ?? "—"}</dd>
              <dt className="text-muted-foreground">Joined</dt>
              <dd>{formatDisplayDate(user.created_at)}</dd>
              <dt className="text-muted-foreground">Last login</dt>
              <dd>{user.last_login_at ? formatDisplayDate(user.last_login_at) : "Never"}</dd>
            </dl>

            <div className="grid gap-2">
              <Label>Role</Label>
              {isSelf ? (
                <div className="flex items-center gap-2">
                  <UserRoleBadge role={user.role} />
                  <span className="text-xs text-muted-foreground">You can&apos;t change your own role.</span>
                </div>
              ) : (
                <Select value={user.role} onValueChange={handleRoleChange} disabled={pending}>
                  <SelectTrigger>
                    <SelectValue>
                      {(value: string) => ROLE_OPTIONS.find((o) => o.value === value)?.label ?? "Nurse"}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {ROLE_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            <div className="flex items-center justify-between rounded-lg border border-border p-3">
              <div className="flex flex-col">
                <span className="text-sm font-medium">Active</span>
                <span className="text-xs text-muted-foreground">
                  {isSelf ? "You can't deactivate your own account." : "Inactive staff can't sign in."}
                </span>
              </div>
              <Switch
                checked={user.status === "active"}
                onCheckedChange={handleStatusChange}
                disabled={pending || isSelf}
              />
            </div>
          </div>

          <SheetFooter className="mt-auto">
            <Button variant="outline" onClick={() => setResetOpen(true)}>
              <KeyRound className="h-4 w-4" />
              Reset password
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <ResetPasswordDialog userId={user.id} userName={user.full_name} open={resetOpen} onOpenChange={setResetOpen} />
    </>
  );
}
