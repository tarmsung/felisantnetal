import { Construction } from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";

/**
 * Placeholder for a module whose route/nav entry exists (so the
 * information architecture from spec section 19 is fully navigable
 * today) but whose real implementation lands in a later build phase.
 * Every one of these disappears as its phase is completed — see
 * lib/navigation.ts for the phase number, and the project README for
 * the phase plan.
 */
export function ComingSoon({
  moduleName,
  phase,
}: {
  moduleName: string;
  phase: number;
}) {
  return (
    <EmptyState
      icon={Construction}
      title={`${moduleName} is scheduled for Phase ${phase}`}
      description="This section of the navigation is in place, but the module hasn't been built yet — it'll replace this placeholder in an upcoming checkpoint."
    />
  );
}
