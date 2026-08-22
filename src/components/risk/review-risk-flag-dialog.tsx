"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { reviewRiskFlagAction } from "@/app/(app)/high-risk/actions";

const STATUS_OPTIONS: Array<{ value: "reviewed" | "resolved"; label: string; hint: string }> = [
  { value: "reviewed", label: "Reviewed", hint: "Looked at, no further action needed right now" },
  { value: "resolved", label: "Resolved", hint: "The concern has been addressed" },
];

export function ReviewRiskFlagDialog({
  flagId,
  patientId,
  flagReason,
  open,
  onOpenChange,
  onDone,
}: {
  flagId: string;
  patientId: string;
  flagReason: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDone?: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | undefined>();
  const [status, setStatus] = useState<"reviewed" | "resolved">("reviewed");
  const [notes, setNotes] = useState("");

  function submit() {
    setError(undefined);
    startTransition(async () => {
      const result = await reviewRiskFlagAction(flagId, patientId, {
        status,
        review_notes: notes,
      });
      if (result.status === "error") {
        setError(result.message);
        return;
      }
      toast.success(status === "resolved" ? "Flag marked resolved." : "Flag marked reviewed.");
      onOpenChange(false);
      onDone?.();
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Review risk flag</DialogTitle>
          <DialogDescription>{flagReason}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="grid gap-2">
            <Label>Outcome</Label>
            <Select value={status} onValueChange={(v) => setStatus(v as "reviewed" | "resolved")}>
              <SelectTrigger>
                <SelectValue>
                  {(value: string) => STATUS_OPTIONS.find((o) => o.value === value)?.label ?? "Reviewed"}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {STATUS_OPTIONS.find((o) => o.value === status)?.hint}
            </p>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="review-notes">Notes</Label>
            <Textarea
              id="review-notes"
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="What was checked, and what was decided"
            />
          </div>
          {error ? (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          ) : null}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={pending}>
            {pending ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
