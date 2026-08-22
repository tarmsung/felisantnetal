"use client";

import { useState } from "react";
import Image from "next/image";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { NavLinks } from "@/components/layout/nav-links";
import type { UserRole } from "@/types/database";

export function MobileNav({ role }: { role: UserRole }) {
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        render={<Button variant="ghost" size="icon" className="md:hidden" />}
        aria-label="Open navigation menu"
      >
        <Menu className="h-5 w-5" />
      </SheetTrigger>
      <SheetContent side="left" className="w-[272px] p-0">
        <SheetHeader className="border-b border-border px-5 py-4">
          <SheetTitle className="flex items-center gap-2.5 text-left">
            <Image
              src="/brand/felis-logo.png"
              alt="Felis Clinic"
              width={32}
              height={32}
              className="h-8 w-8 object-contain"
            />
            <span className="flex flex-col leading-tight">
              <span className="text-[15px] font-bold tracking-tight">
                Felis Clinic
              </span>
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                ANC System
              </span>
            </span>
          </SheetTitle>
        </SheetHeader>
        <NavLinks role={role} onNavigate={() => setOpen(false)} />
      </SheetContent>
    </Sheet>
  );
}
