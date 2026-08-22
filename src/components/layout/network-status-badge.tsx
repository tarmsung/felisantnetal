"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * Real connectivity indicator (navigator.onLine + online/offline events),
 * not a fabricated "synced Nx ago" placeholder — the spec explicitly
 * warns against fake dashboard/status data (section 44). Low-end Android
 * handsets on shaky rural connectivity (section 18) are exactly the
 * audience this is for; a genuine offline queue is future work, but
 * knowing you're offline right now is useful today.
 *
 * The initial state is always `true` — matching what the server renders,
 * since `navigator` doesn't exist there — and only corrected once
 * mounted on the client. Reading `navigator.onLine` in the useState
 * initializer instead looks tempting (and avoids the eslint
 * react-hooks/set-state-in-effect warning below), but it's wrong: the
 * client's real value can differ from the server's forced default,
 * which React then reports as a hydration mismatch. Synchronizing with
 * a browser-only API on mount is exactly the case that lint rule can't
 * distinguish from a genuine anti-pattern.
 */
export function NetworkStatusBadge() {
  const [online, setOnline] = useState(true);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- see comment above
    setOnline(navigator.onLine);
    const handleOnline = () => setOnline(true);
    const handleOffline = () => setOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  return (
    <div
      className={cn(
        "flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11.5px] font-semibold",
        online
          ? "border-[#C8EBDA] bg-accent text-success"
          : "border-warning/30 bg-warning/10 text-warning",
      )}
    >
      <span
        className={cn(
          "h-[7px] w-[7px] rounded-full",
          online ? "bg-success" : "bg-warning",
        )}
      />
      {online ? "Online" : "Offline — changes may not save"}
    </div>
  );
}
