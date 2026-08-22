import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard,
  Users2,
  CalendarDays,
  Stethoscope,
  AlertTriangle,
  CalendarX2,
  BarChart3,
  HeartHandshake,
  UsersRound,
  Settings,
  ScrollText,
} from "lucide-react";

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  /** Short line shown in the page header under the title. */
  subtitle: string;
  /** Sidebar grouping, matching the spec's "Clinical" / admin split. */
  group: "clinical" | "field" | "admin";
  /** Restrict both the nav link and the underlying page to administrators. */
  adminOnly?: boolean;
  /** Which build phase (spec section 43) implements this page for real. */
  phase: number;
}

export const NAV_ITEMS: NavItem[] = [
  {
    label: "Dashboard",
    href: "/dashboard",
    icon: LayoutDashboard,
    subtitle: "Clinic overview and today's activity",
    group: "clinical",
    phase: 1,
  },
  {
    label: "Patients",
    href: "/patients",
    icon: Users2,
    subtitle: "Register and search ANC patients",
    group: "clinical",
    phase: 2,
  },
  {
    label: "Appointments",
    href: "/appointments",
    icon: CalendarDays,
    subtitle: "Calendar of scheduled ANC visits",
    group: "clinical",
    phase: 3,
  },
  {
    label: "ANC Visits",
    href: "/visits",
    icon: Stethoscope,
    subtitle: "Record clinical observations",
    group: "clinical",
    phase: 4,
  },
  {
    label: "High Risk",
    href: "/high-risk",
    icon: AlertTriangle,
    subtitle: "Patients flagged for clinical review",
    group: "clinical",
    phase: 4,
  },
  {
    label: "Missed Visits",
    href: "/missed-visits",
    icon: CalendarX2,
    subtitle: "Overdue appointments and follow-up",
    group: "clinical",
    phase: 3,
  },
  {
    label: "Reports",
    href: "/reports",
    icon: BarChart3,
    subtitle: "Attendance, missed-visit and risk reports",
    group: "clinical",
    phase: 6,
  },
  {
    label: "Community Health Workers",
    href: "/community-health-workers",
    icon: HeartHandshake,
    subtitle: "Manage community health worker records",
    group: "field",
    phase: 2,
  },
  {
    label: "Users",
    href: "/users",
    icon: UsersRound,
    subtitle: "Manage staff accounts and roles",
    group: "admin",
    adminOnly: true,
    phase: 8,
  },
  {
    label: "Settings",
    href: "/settings",
    icon: Settings,
    subtitle: "Clinic, schedule, rules and notifications",
    group: "admin",
    adminOnly: true,
    phase: 8,
  },
  {
    label: "Audit Logs",
    href: "/audit-logs",
    icon: ScrollText,
    subtitle: "Trace who changed what, and when",
    group: "admin",
    adminOnly: true,
    phase: 8,
  },
];

export function findNavItem(pathname: string): NavItem | undefined {
  return NAV_ITEMS.find(
    (item) => pathname === item.href || pathname.startsWith(`${item.href}/`),
  );
}
