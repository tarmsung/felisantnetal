"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { NAV_ITEMS, type NavItem } from "@/lib/navigation";
import type { UserRole } from "@/types/database";

const GROUP_LABELS: Record<NavItem["group"], string> = {
  clinical: "Clinical",
  field: "Field",
  admin: "Administration",
};

const GROUP_ORDER: NavItem["group"][] = ["clinical", "field", "admin"];

export function NavLinks({
  role,
  onNavigate,
}: {
  role: UserRole;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const visible = NAV_ITEMS.filter((item) => !item.adminOnly || role === "administrator");

  return (
    <nav className="flex flex-1 flex-col gap-1 overflow-y-auto px-3 py-3">
      {GROUP_ORDER.map((group) => {
        const items = visible.filter((item) => item.group === group);
        if (items.length === 0) return null;

        return (
          <div key={group} className="flex flex-col gap-0.5 py-1.5">
            <div className="px-2 pb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              {GROUP_LABELS[group]}
            </div>
            {items.map((item) => {
              const active =
                pathname === item.href || pathname.startsWith(`${item.href}/`);
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onNavigate}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13.5px] font-medium transition-colors",
                    active
                      ? "bg-accent text-accent-foreground"
                      : "text-foreground/80 hover:bg-muted",
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span className="truncate">{item.label}</span>
                </Link>
              );
            })}
          </div>
        );
      })}
    </nav>
  );
}
