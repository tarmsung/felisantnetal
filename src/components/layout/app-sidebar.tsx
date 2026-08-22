import Image from "next/image";
import { LogOut } from "lucide-react";
import { NavLinks } from "@/components/layout/nav-links";
import { Button } from "@/components/ui/button";
import { logoutAction } from "@/app/(auth)/login/actions";
import type { AuthenticatedUser } from "@/lib/auth/session";

function initials(fullName: string) {
  return fullName
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

const ROLE_LABEL: Record<AuthenticatedUser["role"], string> = {
  administrator: "Administrator",
  nurse: "Nurse",
};

export function AppSidebar({ user }: { user: AuthenticatedUser }) {
  return (
    <aside className="sticky top-0 hidden h-screen w-[252px] shrink-0 flex-col border-r border-border bg-sidebar md:flex">
      <div className="flex items-center gap-2.5 border-b border-border px-5 py-4">
        <Image
          src="/brand/felis-logo.png"
          alt="Felis Clinic"
          width={36}
          height={36}
          className="h-9 w-9 object-contain"
        />
        <div className="flex flex-col leading-tight">
          <span className="text-[15px] font-bold tracking-tight">Felis Clinic</span>
          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            ANC System
          </span>
        </div>
      </div>

      <NavLinks role={user.role} />

      <div className="flex items-center gap-2.5 border-t border-border p-3.5">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent text-[12.5px] font-bold text-accent-foreground">
          {initials(user.full_name)}
        </div>
        <div className="flex min-w-0 flex-1 flex-col leading-tight">
          <span className="truncate text-[12.5px] font-semibold">{user.full_name}</span>
          <span className="truncate text-[11px] text-muted-foreground">
            {ROLE_LABEL[user.role]}
          </span>
        </div>
        <form action={logoutAction}>
          <Button
            type="submit"
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground"
            aria-label="Sign out"
          >
            <LogOut className="h-4 w-4" />
          </Button>
        </form>
      </div>
    </aside>
  );
}
