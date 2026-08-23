"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Plus, Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { createUserAction } from "@/app/(app)/users/actions";
import { generateTemporaryPassword } from "@/lib/generatePassword";
import type { UserRole } from "@/types/database";

const ROLE_OPTIONS: { value: UserRole; label: string }[] = [
  { value: "nurse", label: "Nurse" },
  { value: "administrator", label: "Administrator" },
];

/** Self-triggering dialog, same shell+remount pattern as AddAppointmentDialog/RecordVisitDialog. */
export function AddUserDialog() {
  const [open, setOpen] = useState(false);
  const [sessionId, setSessionId] = useState(0);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button
        onClick={() => {
          setSessionId((n) => n + 1);
          setOpen(true);
        }}
      >
        <Plus className="h-4 w-4" />
        Add user
      </Button>
      <DialogContent>
        <AddUserForm key={sessionId} onClose={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}

function AddUserForm({ onClose }: { onClose: () => void }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | undefined>();
  const [created, setCreated] = useState<{ email: string; password: string } | undefined>();
  const [copied, setCopied] = useState(false);

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState<UserRole>("nurse");
  const [password, setPassword] = useState(generateTemporaryPassword());

  function submit() {
    setError(undefined);
    startTransition(async () => {
      const result = await createUserAction({
        full_name: fullName,
        email,
        phone,
        role,
        temporary_password: password,
      });
      if (result.status === "error") {
        setError(result.message);
        return;
      }
      setCreated({ email, password });
    });
  }

  async function copyPassword() {
    await navigator.clipboard.writeText(created?.password ?? password);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (created) {
    return (
      <>
        <DialogHeader>
          <DialogTitle>Account created</DialogTitle>
          <DialogDescription>
            Share these credentials with {created.email} — the password won&apos;t be shown again.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <div className="grid gap-1.5">
            <Label className="text-xs">Email</Label>
            <p className="rounded-md border border-border bg-muted/40 px-3 py-2 text-sm">{created.email}</p>
          </div>
          <div className="grid gap-1.5">
            <Label className="text-xs">Temporary password</Label>
            <div className="flex items-center gap-2">
              <p className="flex-1 rounded-md border border-border bg-muted/40 px-3 py-2 font-mono text-sm">
                {created.password}
              </p>
              <Button type="button" variant="outline" size="icon" onClick={copyPassword} aria-label="Copy password">
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button
            onClick={() => {
              toast.success("Account created.");
              onClose();
            }}
          >
            Done
          </Button>
        </DialogFooter>
      </>
    );
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>Add staff account</DialogTitle>
        <DialogDescription>
          Accounts are created by a clinic administrator (no self-registration) — share the
          temporary password with them directly once created.
        </DialogDescription>
      </DialogHeader>

      <div className="flex flex-col gap-4">
        <div className="grid gap-2">
          <Label htmlFor="new-user-name">Full name</Label>
          <Input id="new-user-name" value={fullName} onChange={(e) => setFullName(e.target.value)} autoFocus />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="grid gap-2">
            <Label htmlFor="new-user-email">Email</Label>
            <Input id="new-user-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="new-user-phone">Phone</Label>
            <Input id="new-user-phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Optional" />
          </div>
        </div>
        <div className="grid gap-2">
          <Label>Role</Label>
          <Select value={role} onValueChange={(v) => setRole(v as UserRole)}>
            <SelectTrigger>
              <SelectValue>{(value: string) => ROLE_OPTIONS.find((o) => o.value === value)?.label ?? "Nurse"}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {ROLE_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="new-user-password">Temporary password</Label>
          <div className="flex items-center gap-2">
            <Input
              id="new-user-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="font-mono"
            />
            <Button type="button" variant="outline" onClick={() => setPassword(generateTemporaryPassword())}>
              Generate
            </Button>
          </div>
        </div>
        {error ? (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        ) : null}
      </div>

      <DialogFooter>
        <Button variant="outline" onClick={onClose} disabled={pending}>
          Cancel
        </Button>
        <Button onClick={submit} disabled={pending || !fullName.trim() || !email.trim() || password.length < 8}>
          {pending ? "Creating…" : "Create account"}
        </Button>
      </DialogFooter>
    </>
  );
}
