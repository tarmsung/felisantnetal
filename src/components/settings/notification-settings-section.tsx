"use client";

import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import {
  updateNotificationTemplateAction,
  updateNotificationSettingsAction,
  getWhatsAppConnectionStatusAction,
  logoutWhatsAppConnectionAction,
} from "@/app/(app)/settings/actions";
import type { NotificationSettingsRow, NotificationTemplateRow } from "@/types/database";
import type { WhatsAppConnectionStatus } from "@/lib/services/notifications/whatsappStatus";

const PROVIDER_OPTIONS: { value: "console" | "baileys"; label: string }[] = [
  { value: "console", label: "Console (development only — logs instead of sending)" },
  { value: "baileys", label: "WhatsApp (Baileys, via whatsapp-service)" },
];

export function NotificationSettingsSection({
  templates,
  settings,
}: {
  templates: NotificationTemplateRow[];
  settings: NotificationSettingsRow | null;
}) {
  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">
        Message wording, delivery timing, and the WhatsApp connection itself (Phase 5). See{" "}
        <code>whatsapp-service/README.md</code> for the ban-risk disclosure and pairing steps before
        switching the provider below to WhatsApp.
      </p>
      {settings?.whatsapp_provider === "baileys" ? <WhatsAppConnectionCard /> : null}
      {templates.map((template) => (
        <TemplateCard key={template.id} template={template} />
      ))}
      <DeliverySettingsCard settings={settings} />
    </div>
  );
}

function WhatsAppConnectionCard() {
  const [status, setStatus] = useState<WhatsAppConnectionStatus | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    let cancelled = false;
    async function poll() {
      const result = await getWhatsAppConnectionStatusAction();
      if (!cancelled) setStatus(result);
    }
    poll();
    // Only worth polling while unpaired (waiting for a QR scan) — once
    // connected, this card only changes when an admin explicitly logs
    // out, which already refetches itself below.
    const interval = status?.connected ? null : setInterval(poll, 4000);
    return () => {
      cancelled = true;
      if (interval) clearInterval(interval);
    };
  }, [status?.connected]);

  function handleLogout() {
    startTransition(async () => {
      const result = await logoutWhatsAppConnectionAction();
      if (result.status === "error") {
        toast.error(result.message ?? "Failed to log out.");
        return;
      }
      toast.success("Logged out — scan a new QR code to re-pair.");
      setStatus(await getWhatsAppConnectionStatusAction());
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>WhatsApp connection</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {status === null ? (
          <p className="text-sm text-muted-foreground">Checking…</p>
        ) : !status.reachable ? (
          <p role="alert" className="text-sm text-destructive">
            {status.error ?? "Could not reach the WhatsApp service."} Confirm WHATSAPP_SERVICE_URL /
            WHATSAPP_SERVICE_API_KEY are set and the service is running (see{" "}
            <code>whatsapp-service/README.md</code>).
          </p>
        ) : status.connected ? (
          <>
            <p className="text-sm text-emerald-600 dark:text-emerald-400">
              ● Connected — reminders will send through this WhatsApp number.
            </p>
            <div>
              <Button size="sm" variant="outline" onClick={handleLogout} disabled={pending}>
                {pending ? "Logging out…" : "Log out / re-pair"}
              </Button>
            </div>
          </>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">
              Not paired. On the clinic&apos;s phone: WhatsApp → Linked Devices → Link a Device →
              scan this code.
            </p>
            {status.qr ? (
              // eslint-disable-next-line @next/next/no-img-element -- a data: URL, not an optimizable remote image
              <img src={status.qr} alt="WhatsApp pairing QR code" className="h-56 w-56 rounded-md border border-border" />
            ) : (
              <p className="text-sm text-muted-foreground">Waiting for a QR code from the service…</p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

function TemplateCard({ template }: { template: NotificationTemplateRow }) {
  const [pending, startTransition] = useTransition();
  const [body, setBody] = useState(template.body_template);
  const [isActive, setIsActive] = useState(template.is_active);
  const dirty = body !== template.body_template || isActive !== template.is_active;

  function save() {
    startTransition(async () => {
      const result = await updateNotificationTemplateAction(template.id, {
        body_template: body,
        is_active: isActive,
      });
      if (result.status === "error") {
        toast.error(result.message ?? "Failed to save.");
        return;
      }
      toast.success("Template saved.");
    });
  }

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle className="capitalize">{template.template_key.replace(/_/g, " ")}</CardTitle>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Active</span>
          <Switch checked={isActive} onCheckedChange={setIsActive} />
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="grid gap-2">
          <Label htmlFor={`template-${template.id}`}>Message body</Label>
          <Textarea
            id={`template-${template.id}`}
            rows={3}
            value={body}
            onChange={(e) => setBody(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            Placeholders like <code>{"{{patient_name}}"}</code> and{" "}
            <code>{"{{appointment_date}}"}</code> are filled in when a reminder is sent — never
            include diagnosis, measurements, or risk detail here (spec section 9).
          </p>
        </div>
        <div>
          <Button size="sm" variant="outline" onClick={save} disabled={pending || !dirty}>
            {pending ? "Saving…" : "Save template"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function DeliverySettingsCard({ settings }: { settings: NotificationSettingsRow | null }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | undefined>();
  const [hoursBefore, setHoursBefore] = useState(String(settings?.reminder_hours_before ?? 48));
  const [maxAttempts, setMaxAttempts] = useState(String(settings?.retry_max_attempts ?? 3));
  const [backoffMinutes, setBackoffMinutes] = useState(String(settings?.retry_backoff_minutes ?? 30));
  const [provider, setProvider] = useState<"console" | "baileys">(
    settings?.whatsapp_provider === "baileys" ? "baileys" : "console",
  );

  function save() {
    setError(undefined);
    startTransition(async () => {
      const result = await updateNotificationSettingsAction({
        reminder_hours_before: hoursBefore,
        retry_max_attempts: maxAttempts,
        retry_backoff_minutes: backoffMinutes,
        whatsapp_provider: provider,
      });
      if (result.status === "error") {
        setError(result.message);
        return;
      }
      toast.success("Delivery settings saved.");
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Delivery settings</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="grid grid-cols-3 gap-4">
          <div className="grid gap-2">
            <Label htmlFor="reminder-hours">Send reminder (hours before)</Label>
            <Input id="reminder-hours" type="number" min={1} max={336} value={hoursBefore} onChange={(e) => setHoursBefore(e.target.value)} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="retry-attempts">Retry attempts</Label>
            <Input id="retry-attempts" type="number" min={0} max={10} value={maxAttempts} onChange={(e) => setMaxAttempts(e.target.value)} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="retry-backoff">Retry backoff (minutes)</Label>
            <Input id="retry-backoff" type="number" min={1} max={1440} value={backoffMinutes} onChange={(e) => setBackoffMinutes(e.target.value)} />
          </div>
        </div>
        <div className="grid gap-2 sm:max-w-sm">
          <Label htmlFor="whatsapp-provider">WhatsApp provider</Label>
          <Select value={provider} onValueChange={(v) => v && setProvider(v as "console" | "baileys")}>
            <SelectTrigger id="whatsapp-provider">
              <SelectValue>
                {(value: string) => PROVIDER_OPTIONS.find((o) => o.value === value)?.label ?? "Console"}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {PROVIDER_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            Switching to WhatsApp shows a connection card above — read{" "}
            <code>whatsapp-service/README.md</code>&apos;s ban-risk note before pairing a real number.
          </p>
        </div>
        {error ? (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        ) : null}
        <div>
          <Button size="sm" variant="outline" onClick={save} disabled={pending}>
            {pending ? "Saving…" : "Save delivery settings"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
