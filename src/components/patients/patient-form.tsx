"use client";

import { useForm, type Resolver } from "react-hook-form";
import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import {
  patientFormSchema,
  type PatientFormValues,
  type PatientFormInput,
} from "@/lib/validation/patientSchemas";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { FormSection } from "@/components/shared/form-section";
import type { CommunityHealthWorkerRow } from "@/types/database";

interface PatientFormProps {
  chws: CommunityHealthWorkerRow[];
  defaultValues?: Partial<PatientFormValues>;
  onSubmit: (data: PatientFormInput) => void | Promise<void>;
  submitLabel: string;
  pending?: boolean;
  serverError?: string;
}

const EMPTY_DEFAULTS: PatientFormValues = {
  full_name: "",
  national_id: "",
  date_of_birth: "",
  phone: "",
  alternative_phone: "",
  address: "",
  emergency_contact_name: "",
  emergency_contact_phone: "",
  community_health_worker_id: "",
  notes: "",
  gravida: "",
  para: "",
  lmp: "",
  edd: "",
  gestational_information: "",
};

export function PatientForm({
  chws,
  defaultValues,
  onSubmit,
  submitLabel,
  pending,
  serverError,
}: PatientFormProps) {
  // patientFormSchema's input type (raw form strings) differs from its
  // output type (transformed — "" -> undefined, numeric strings -> numbers).
  // Every combination of explicit useForm generics + zodResolver/
  // standardSchemaResolver we tried produced the same downstream error —
  // react-hook-form's own Control/ControllerProps types default their
  // context generic to `any`, and no resolver-inferred instantiation
  // (whether its context came out `unknown` or an explicit `any`) was
  // structurally accepted in that slot, down to TS calling two
  // identically-shaped Control<> instantiations "unrelated" (TS2719).
  // Rather than fight generic inference across two libraries, useForm is
  // typed with the schema's raw (pre-transform) shape only, and the one
  // resolver cast below documents the single spot where the real
  // runtime type (post-transform) diverges from what TS is told it is —
  // corrected immediately after by the matching cast in handleSubmit.
  const form = useForm<PatientFormValues>({
    resolver: standardSchemaResolver(patientFormSchema) as unknown as Resolver<PatientFormValues>,
    defaultValues: { ...EMPTY_DEFAULTS, ...defaultValues },
  });

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit((data) => onSubmit(data as unknown as PatientFormInput))}
        className="flex flex-col gap-5"
      >
        <FormSection
          title="Identity"
          description="National ID and phone are optional if the patient doesn't have them on hand."
        >
          <FormField
            control={form.control}
            name="full_name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Full name</FormLabel>
                <FormControl>
                  <Input {...field} autoFocus />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="national_id"
            render={({ field }) => (
              <FormItem>
                <FormLabel>National ID</FormLabel>
                <FormControl>
                  <Input {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="date_of_birth"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Date of birth</FormLabel>
                <FormControl>
                  <Input {...field} type="date" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="community_health_worker_id"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Community health worker</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <FormControl>
                    <SelectTrigger className="w-full">
                      {/*
                        Base UI's Select.Value doesn't derive a label from
                        the matching Select.Item automatically — it shows
                        the raw value unless given a render function (see
                        node_modules/@base-ui/react/select/value/SelectValue.d.ts).
                      */}
                      <SelectValue>
                        {(value: string) => {
                          const chw = chws.find((c) => c.id === value);
                          if (!chw) return "Select a community health worker";
                          return chw.area ? `${chw.full_name} — ${chw.area}` : chw.full_name;
                        }}
                      </SelectValue>
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {chws.map((chw) => (
                      <SelectItem key={chw.id} value={chw.id}>
                        {chw.full_name}
                        {chw.area ? ` — ${chw.area}` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </FormSection>

        <FormSection title="Contact">
          <FormField
            control={form.control}
            name="phone"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Phone</FormLabel>
                <FormControl>
                  <Input {...field} type="tel" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="alternative_phone"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Alternative phone</FormLabel>
                <FormControl>
                  <Input {...field} type="tel" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="address"
            render={({ field }) => (
              <FormItem className="sm:col-span-2">
                <FormLabel>Address</FormLabel>
                <FormControl>
                  <Textarea {...field} rows={2} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="emergency_contact_name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Emergency contact name</FormLabel>
                <FormControl>
                  <Input {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="emergency_contact_phone"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Emergency contact phone</FormLabel>
                <FormControl>
                  <Input {...field} type="tel" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </FormSection>

        <FormSection
          title="Pregnancy information"
          description="For this pregnancy episode. Gravida/para are optional."
        >
          <FormField
            control={form.control}
            name="edd"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Estimated date of delivery (EDD)</FormLabel>
                <FormControl>
                  <Input {...field} type="date" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="lmp"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Last menstrual period (LMP)</FormLabel>
                <FormControl>
                  <Input {...field} type="date" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="gravida"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Gravida</FormLabel>
                <FormControl>
                  <Input {...field} type="number" min={0} inputMode="numeric" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="para"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Para</FormLabel>
                <FormControl>
                  <Input {...field} type="number" min={0} inputMode="numeric" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="gestational_information"
            render={({ field }) => (
              <FormItem className="sm:col-span-2">
                <FormLabel>Gestational information</FormLabel>
                <FormControl>
                  <Textarea {...field} rows={2} placeholder="Any other pregnancy-related notes" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </FormSection>

        <FormSection title="Notes">
          <FormField
            control={form.control}
            name="notes"
            render={({ field }) => (
              <FormItem className="sm:col-span-2">
                <FormControl>
                  <Textarea {...field} rows={3} placeholder="Optional" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </FormSection>

        {serverError ? (
          <p role="alert" className="text-sm text-destructive">
            {serverError}
          </p>
        ) : null}

        <div className="sticky bottom-0 flex justify-end gap-2 border-t border-border bg-background/95 py-3 backdrop-blur">
          <Button type="submit" disabled={pending}>
            {pending ? "Saving…" : submitLabel}
          </Button>
        </div>
      </form>
    </Form>
  );
}
