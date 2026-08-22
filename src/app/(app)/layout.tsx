import { requireUser } from "@/lib/auth/session";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { AppHeader } from "@/components/layout/app-header";
import { PageHeaderProvider } from "@/lib/contexts/page-header-context";

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
    <PageHeaderProvider>
      <div className="flex min-h-screen w-full">
        <AppSidebar user={user} />
        {/* min-w-0 overrides the flex default of min-width: auto, which
            otherwise lets this column grow to fit whatever its widest
            descendant wants to be (a table cell with a long, unbroken
            reason/notes string, say) instead of holding to the space the
            sidebar row actually gives it — the classic "flexbox ignores
            my overflow-x-auto wrapper" bug. Found live (Phase 6): a
            table cell with a long risk-flag reason forced this whole
            column, and the page, to scroll horizontally instead of just
            that one table scrolling within its own border. */}
        <div className="flex min-h-screen min-w-0 flex-1 flex-col">
          <AppHeader role={user.role} />
          <main className="min-w-0 flex-1 p-4 md:p-7">{children}</main>
        </div>
      </div>
    </PageHeaderProvider>
  );
}
