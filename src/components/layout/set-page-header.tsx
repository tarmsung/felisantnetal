"use client";

import { usePageHeader } from "@/lib/contexts/page-header-context";

/** See lib/contexts/page-header-context.tsx for why this exists. */
export function SetPageHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  usePageHeader({ title, subtitle });
  return null;
}
