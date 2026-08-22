"use client";

import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { createChwAction, type CreateChwActionState } from "@/app/(app)/community-health-workers/actions";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Saving…" : "Add"}
    </Button>
  );
}

export function AddChwDialog() {
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState<CreateChwActionState, FormData>(
    createChwAction,
    {},
  );

  useEffect(() => {
    // Closing the dialog in response to the server action succeeding is
    // a real side effect (reacting to an external result), not derived
    // render-time state — there's no way to compute "should be open"
    // purely from props/state without also losing the ability to
    // reopen the dialog for a second add after one success.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (state.success) setOpen(false);
  }, [state.success]);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
      }}
    >
      <Button onClick={() => setOpen(true)}>
        <Plus className="h-4 w-4" />
        Add community health worker
      </Button>
      <DialogContent>
        <form action={formAction} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>Add community health worker</DialogTitle>
            <DialogDescription>
              They&apos;ll be selectable during patient registration.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-2">
            <Label htmlFor="chw_full_name">Full name</Label>
            <Input id="chw_full_name" name="full_name" required autoFocus />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="chw_phone">Phone</Label>
            <Input id="chw_phone" name="phone" type="tel" />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="chw_area">Area</Label>
            <Input id="chw_area" name="area" placeholder="e.g. Ward 12" />
          </div>

          {state.error ? (
            <p role="alert" className="text-sm text-destructive">
              {state.error}
            </p>
          ) : null}

          <DialogFooter>
            <SubmitButton />
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
