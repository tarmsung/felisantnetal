import type { Metadata } from "next";
import { requireUser } from "@/lib/auth/session";
import { listAllCommunityHealthWorkers } from "@/lib/services/chwService";
import { AddChwDialog } from "@/components/chw/add-chw-dialog";
import { StatusBadge } from "@/components/shared/status-badge";
import { EmptyState } from "@/components/shared/empty-state";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { HeartHandshake } from "lucide-react";

export const metadata: Metadata = { title: "Community Health Workers" };

export default async function CommunityHealthWorkersPage() {
  const user = await requireUser();
  const chws = await listAllCommunityHealthWorkers();

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-2xl text-sm text-muted-foreground">
          Community health workers are referenced during patient
          registration and don&apos;t sign in to this system themselves.
        </p>
        {user.role === "administrator" ? <AddChwDialog /> : null}
      </div>

      {chws.length === 0 ? (
        <EmptyState
          icon={HeartHandshake}
          title="No community health workers yet"
          description={
            user.role === "administrator"
              ? "Add at least one before registering patients — every patient record links to a community health worker."
              : "Ask a clinic administrator to add one before you can register patients."
          }
        />
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Area</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {chws.map((chw) => (
                <TableRow key={chw.id}>
                  <TableCell className="font-medium">{chw.full_name}</TableCell>
                  <TableCell className="text-muted-foreground">{chw.area ?? "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{chw.phone ?? "—"}</TableCell>
                  <TableCell>
                    <StatusBadge
                      label={chw.status === "active" ? "Active" : "Inactive"}
                      tone={chw.status === "active" ? "success" : "default"}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
