"use client";

import { createContext, useContext, useEffect, useState } from "react";

export interface HeaderOverride {
  title: string;
  subtitle?: string;
}

interface PageHeaderContextValue {
  override: HeaderOverride | null;
  setOverride: (override: HeaderOverride | null) => void;
}

const PageHeaderContext = createContext<PageHeaderContextValue | null>(null);

export function PageHeaderProvider({ children }: { children: React.ReactNode }) {
  const [override, setOverride] = useState<HeaderOverride | null>(null);
  return (
    <PageHeaderContext.Provider value={{ override, setOverride }}>
      {children}
    </PageHeaderContext.Provider>
  );
}

export function usePageHeaderContext(): PageHeaderContextValue {
  const ctx = useContext(PageHeaderContext);
  if (!ctx) {
    throw new Error("usePageHeaderContext must be used within PageHeaderProvider");
  }
  return ctx;
}

/**
 * Lets a page override the header's title/subtitle for routes the
 * static nav config (lib/navigation.ts) can't know about ahead of time
 * — a patient's name on their profile page, "Register Patient" on the
 * new-patient form, etc. Render <SetPageHeader .../> (a thin wrapper
 * around this) from the page; it clears itself on unmount so navigating
 * away falls back to the nav-config-derived title.
 */
export function usePageHeader(override: HeaderOverride | null) {
  const { setOverride } = usePageHeaderContext();
  const title = override?.title;
  const subtitle = override?.subtitle;

  useEffect(() => {
    setOverride(title ? { title, subtitle } : null);
    return () => setOverride(null);
  }, [title, subtitle, setOverride]);
}
