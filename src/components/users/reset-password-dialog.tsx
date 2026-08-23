"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Copy, Check } from "lucide-react";
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
import { resetPasswordAction } from "@/app/(app)/users/actions";
import { generateTemporaryPassword } from "@/lib/generatePassword";

export function ResetPasswordDialog({
  userId,
  userName,
  open,
  onOpenChange,
}: {
  userId: string;
  userName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | undefined>();
  const [password, setPassword] = useState(() => generateTemporaryPassword());
  const [done, setDone] = useState(false);
  const [copied, setCopied] = useState(false);

  function reset() {
    setError(undefined);
    startTransition(async () => {
      const result = await resetPasswordAction(userId, { new_password: password });
      if (result.status === "error") {
        setError(result.message);
        return;
      }
      setDone(true);
    });
  }

  async function copyPassword() {
    await navigator.clipboard.writeText(password);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handleOpenChange(next: boolean) {
    onOpenChange(next);
    if (!next) {
      // Reset local state for the next time this dialog opens, since it
      // isn't remounted (no key) the way the create-user flow is.
      setDone(false);
      setPassword(generateTemporaryPassword());
      setError(undefined);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        {done ? (
          <>
            <DialogHeader>
              <DialogTitle>Password reset</DialogTitle>
              <DialogDescription>
                Share this with {userName} — it won&apos;t be shown again.
              </DialogDescription>
            </DialogHeader>
            <div className="flex items-center gap-2">
              <p className="flex-1 rounded-md border border-border bg-muted/40 px-3 py-2 font-mono text-sm">
                {password}
              </p>
              <Button type="button" variant="outline" size="icon" onClick={copyPassword} aria-label="Copy password">
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
            <DialogFooter>
              <Button
                onClick={() => {
                  toast.success("Password reset.");
                  handleOpenChange(false);
                }}
              >
                Done
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Reset password</DialogTitle>
              <DialogDescription>Sets a new temporary password for {userName} immediately.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-2">
              <Label htmlFor="reset-password-value">New temporary password</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="reset-password-value"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="font-mono"
                />
                <Button type="button" variant="outline" onClick={() => setPassword(generateTemporaryPassword())}>
                  Generate
                </Button>
              </div>
              {error ? (
                <p role="alert" className="text-sm text-destructive">
                  {error}
                </p>
              ) : null}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={pending}>
                Cancel
              </Button>
              <Button onClick={reset} disabled={pending || password.length < 8}>
                {pending ? "Resetting…" : "Reset password"}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
