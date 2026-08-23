"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { updateAncScheduleTemplateAction } from "@/app/(app)/settings/actions";
import type { AncScheduleTemplateRow } from "@/types/database";

export function AncScheduleTable({ templates }: { templates: AncScheduleTemplateRow[] }) {
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-muted-foreground">
        The scheduling engine (Appointments) suggests a date for a visit only once its recommended
        week is set here <em>and</em> the patient&apos;s LMP is on file — leave it blank and staff
        pick the date manually, with no guess offered.
      </p>
      <div className="overflow-x-auto rounded-xl border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Visit</TableHead>
              <TableHead>Recommended week (LMP+)</TableHead>
              <TableHead>Notes</TableHead>
              <TableHead>Active</TableHead>
              <TableHead className="text-right">&nbsp;</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {templates.map((template) => (
              <AncScheduleRow key={template.id} template={template} />
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function AncScheduleRow({ template }: { template: AncScheduleTemplateRow }) {
  const [pending, startTransition] = useTransition();
  const [week, setWeek] = useState(
    template.recommended_gestational_week != null ? String(template.recommended_gestational_week) : "",
  );
  const [notes, setNotes] = useState(template.notes ?? "");
  const [isActive, setIsActive] = useState(template.is_active);

  const dirty =
    week !== (template.recommended_gestational_week != null ? String(template.recommended_gestational_week) : "") ||
    notes !== (template.notes ?? "") ||
    isActive !== template.is_active;

  function save() {
    startTransition(async () => {
      const result = await updateAncScheduleTemplateAction(template.id, {
        recommended_gestational_week: week,
        notes,
        is_active: isActive,
      });
      if (result.status === "error") {
        toast.error(result.message ?? "Failed to save.");
        return;
      }
      toast.success(`Visit ${template.visit_number} updated.`);
    });
  }

  return (
    <TableRow>
      <TableCell className="font-medium">{template.label}</TableCell>
      <TableCell>
        <Input
          type="number"
          min={1}
          max={45}
          className="w-24"
          value={week}
          onChange={(e) => setWeek(e.target.value)}
          placeholder="Not set"
        />
      </TableCell>
      <TableCell>
        <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional" />
      </TableCell>
      <TableCell>
        <Switch checked={isActive} onCheckedChange={setIsActive} />
      </TableCell>
      <TableCell className="text-right">
        <Button size="sm" variant="outline" onClick={save} disabled={pending || !dirty}>
          {pending ? "Saving…" : "Save"}
        </Button>
      </TableCell>
    </TableRow>
  );
}
