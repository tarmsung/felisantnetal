import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth/session";
import { listUsers } from "@/lib/services/userService";
import { UsersTable } from "@/components/users/users-table";
import { AddUserDialog } from "@/components/users/add-user-dialog";

export const metadata: Metadata = { title: "Users" };

export default async function UsersPage() {
  const admin = await requireAdmin();
  const users = await listUsers();

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-2xl text-sm text-muted-foreground">
          Staff accounts are created here by an administrator — there is no self-registration
          (spec section 35).
        </p>
        <AddUserDialog />
      </div>

      <UsersTable users={users} currentUserId={admin.id} />
    </div>
  );
}
