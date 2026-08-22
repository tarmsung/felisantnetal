import { requireUser } from "@/lib/auth/session";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { AppHeader } from "@/components/layout/app-header";

/**
 * Shared shell for every authenticated route. requireUser() redirects to
 * /login if there's no active session/profile — this is a UX nicety on
 * top of the real enforcement, which is RLS (see supabase/migrations
 * .../20260101000009_rls_policies.sql and the note at its top).
 */
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();

  return (
    <div className="flex min-h-screen w-full">
      <AppSidebar user={user} />
      <div className="flex min-h-screen flex-1 flex-col">
        <AppHeader role={user.role} />
        <main className="flex-1 p-4 md:p-7">{children}</main>
      </div>
    </div>
  );
}
