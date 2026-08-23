"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import {
  updateNotificationTemplateAction,
  updateNotificationSettingsAction,
} from "@/app/(app)/settings/actions";
import type { NotificationSettingsRow, NotificationTemplateRow } from "@/types/database";

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
        Message wording and delivery timing for the WhatsApp reminder system (built out fully in a
        later phase) — configuring these now doesn&apos;t send anything until that scheduler exists.
      </p>
      {templates.map((template) => (
        <TemplateCard key={template.id} template={template} />
      ))}
      <DeliverySettingsCard settings={settings} />
    </div>
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
  const [provider, setProvider] = useState(settings?.whatsapp_provider ?? "");

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
        <div className="grid gap-2 sm:max-w-xs">
          <Label htmlFor="whatsapp-provider">WhatsApp provider</Label>
          <Input
            id="whatsapp-provider"
            value={provider}
            onChange={(e) => setProvider(e.target.value)}
            placeholder="Not configured yet"
          />
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
