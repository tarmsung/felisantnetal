"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Users2 } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyState } from "@/components/shared/empty-state";
import { StatusBadge } from "@/components/shared/status-badge";
import { UserRoleBadge } from "@/components/users/user-role-badge";
import { ManageUserSheet } from "@/components/users/manage-user-sheet";
import { formatDisplayDate } from "@/lib/dates";
import type { UserRow } from "@/types/database";

export function UsersTable({ users, currentUserId }: { users: UserRow[]; currentUserId: string }) {
  const router = useRouter();
  // Derived by id from the (server-refreshed) `users` prop — see
  // appointment-calendar.tsx's comment (Phase 3) for why this beats
  // storing a copy of the selected row.
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const selected = users.find((u) => u.id === selectedId) ?? null;

  if (users.length === 0) {
    return <EmptyState icon={Users2} title="No staff accounts yet" />;
  }

  return (
    <>
      <div className="overflow-x-auto rounded-xl border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Last login</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((user) => (
              <TableRow
                key={user.id}
                className="cursor-pointer"
                onClick={() => {
                  setSelectedId(user.id);
                  setOpen(true);
                }}
              >
                <TableCell className="font-medium">
                  {user.full_name}
                  {user.id === currentUserId ? (
                    <span className="ml-1.5 text-xs font-normal text-muted-foreground">(you)</span>
                  ) : null}
                </TableCell>
                <TableCell className="text-muted-foreground">{user.email}</TableCell>
                <TableCell className="text-muted-foreground">{user.phone ?? "—"}</TableCell>
                <TableCell>
                  <UserRoleBadge role={user.role} />
                </TableCell>
                <TableCell>
                  <StatusBadge
                    label={user.status === "active" ? "Active" : "Inactive"}
                    tone={user.status === "active" ? "success" : "default"}
                  />
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {user.last_login_at ? formatDisplayDate(user.last_login_at) : "Never"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <ManageUserSheet
        user={selected}
        isSelf={selected?.id === currentUserId}
        open={open}
        onOpenChange={setOpen}
        onChanged={() => router.refresh()}
      />
    </>
  );
}
