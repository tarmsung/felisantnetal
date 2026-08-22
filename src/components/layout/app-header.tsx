"use client";

import { usePathname } from "next/navigation";
import { findNavItem } from "@/lib/navigation";
import { usePageHeaderContext } from "@/lib/contexts/page-header-context";
import { MobileNav } from "@/components/layout/mobile-nav";
import { NetworkStatusBadge } from "@/components/layout/network-status-badge";
import type { UserRole } from "@/types/database";

export function AppHeader({ role }: { role: UserRole }) {
  const pathname = usePathname();
  const navItem = findNavItem(pathname);
  const { override } = usePageHeaderContext();

  const title = override?.title ?? navItem?.label ?? "Felis Clinic";
  const subtitle = override?.subtitle ?? navItem?.subtitle ?? "";

  return (
    <header className="sticky top-0 z-10 flex h-16 items-center gap-4 border-b border-border bg-card px-4 md:px-7">
      <MobileNav role={role} />

      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <h1 className="truncate text-[16px] font-semibold tracking-tight">{title}</h1>
        <p className="truncate text-[11.5px] text-muted-foreground">{subtitle}</p>
      </div>

      <NetworkStatusBadge />
    </header>
  );
}
