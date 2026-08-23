"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { updateClinicSettingsAction } from "@/app/(app)/settings/actions";
import type { ClinicSettingsRow } from "@/types/database";

export function ClinicSettingsForm({ settings }: { settings: ClinicSettingsRow | null }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | undefined>();
  const [clinicName, setClinicName] = useState(settings?.clinic_name ?? "");
  const [address, setAddress] = useState(settings?.address ?? "");
  const [phone, setPhone] = useState(settings?.phone ?? "");
  const [email, setEmail] = useState(settings?.email ?? "");
  const [logoUrl, setLogoUrl] = useState(settings?.logo_url ?? "");
  const [countryCode, setCountryCode] = useState(settings?.default_phone_country_code ?? "263");

  function submit() {
    setError(undefined);
    startTransition(async () => {
      const result = await updateClinicSettingsAction({
        clinic_name: clinicName,
        address,
        phone,
        email,
        logo_url: logoUrl,
        default_phone_country_code: countryCode,
      });
      if (result.status === "error") {
        setError(result.message);
        return;
      }
      toast.success("Clinic settings saved.");
    });
  }

  return (
    <Card>
      <CardContent className="flex flex-col gap-4">
        <p className="text-sm text-muted-foreground">
          Shown on every generated ANC card and report PDF (Phase 7), and wherever the clinic name
          appears in the app.
        </p>
        <div className="grid grid-cols-2 gap-4">
          <div className="grid gap-2">
            <Label htmlFor="settings-clinic-name">Clinic name</Label>
            <Input id="settings-clinic-name" value={clinicName} onChange={(e) => setClinicName(e.target.value)} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="settings-phone">Phone</Label>
            <Input id="settings-phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="settings-address">Address</Label>
          <Input id="settings-address" value={address} onChange={(e) => setAddress(e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="grid gap-2">
            <Label htmlFor="settings-email">Email</Label>
            <Input id="settings-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="settings-logo">Logo URL</Label>
            <Input id="settings-logo" value={logoUrl} onChange={(e) => setLogoUrl(e.target.value)} placeholder="/brand/felis-logo.png" />
          </div>
        </div>
        <div className="grid gap-2 sm:max-w-[200px]">
          <Label htmlFor="settings-country-code">Phone country code</Label>
          <Input
            id="settings-country-code"
            value={countryCode}
            onChange={(e) => setCountryCode(e.target.value)}
            placeholder="263"
          />
          <p className="text-xs text-muted-foreground">
            Digits only, no plus sign. Used to turn a patient&apos;s local-format phone number into
            a WhatsApp-reachable one when sending reminders (Phase 5).
          </p>
        </div>
        {error ? (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        ) : null}
        <div>
          <Button onClick={submit} disabled={pending || !clinicName.trim()}>
            {pending ? "Saving…" : "Save clinic settings"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
