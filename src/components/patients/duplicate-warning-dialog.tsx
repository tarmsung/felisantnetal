"use client";

import { AlertTriangle } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { formatDisplayDate } from "@/lib/dates";
import type { PatientDuplicateMatch } from "@/app/(app)/patients/new/actions";

interface DuplicateWarningDialogProps {
  matches: PatientDuplicateMatch[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  pending?: boolean;
}

/**
 * Spec section 5: "Display a warning rather than silently creating
 * duplicates." This never blocks registration outright — a nurse who
 * has looked at the matches and is confident this is a genuinely new
 * patient can still proceed.
 */
export function DuplicateWarningDialog({
  matches,
  open,
  onOpenChange,
  onConfirm,
  pending,
}: DuplicateWarningDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="sm:max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-4.5 w-4.5 text-warning" />
            Possible existing patient
          </AlertDialogTitle>
          <AlertDialogDescription>
            {matches.length === 1
              ? "A patient already on file matches this National ID, phone number, or name and date of birth:"
              : `${matches.length} patients already on file match this National ID, phone number, or name and date of birth:`}
          </AlertDialogDescription>
        </AlertDialogHeader>

        <ul className="flex max-h-64 flex-col gap-2 overflow-y-auto rounded-lg border border-border bg-muted/40 p-2">
          {matches.map((match) => (
            <li
              key={match.id}
              className="flex flex-col gap-0.5 rounded-md bg-card px-3 py-2 text-sm"
            >
              <span className="font-medium">{match.full_name}</span>
              <span className="text-xs text-muted-foreground">
                {match.patient_number}
                {match.national_id ? ` · ID ${match.national_id}` : ""}
                {match.phone ? ` · ${match.phone}` : ""}
                {match.date_of_birth ? ` · DOB ${formatDisplayDate(match.date_of_birth)}` : ""}
              </span>
            </li>
          ))}
        </ul>

        <AlertDialogFooter>
          <AlertDialogCancel>Go back and check</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm} disabled={pending}>
            {pending ? "Registering…" : "Register anyway"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
