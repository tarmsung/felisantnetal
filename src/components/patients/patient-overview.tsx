import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { calculateAge, formatDisplayDate } from "@/lib/dates";
import type { PatientRow, PregnancyRow } from "@/types/database";

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <span className="text-sm">{value ?? "—"}</span>
    </div>
  );
}

export function PatientOverview({
  patient,
  pregnancy,
  chwName,
}: {
  patient: PatientRow;
  pregnancy: PregnancyRow | null;
  chwName: string | null;
}) {
  const age = calculateAge(patient.date_of_birth);

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-[15px]">Demographics</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-3">
          <Field label="Date of birth" value={formatDisplayDate(patient.date_of_birth)} />
          <Field label="Age" value={age !== null ? `${age} years` : undefined} />
          <Field label="National ID" value={patient.national_id} />
          <Field label="Phone" value={patient.phone} />
          <Field label="Alternative phone" value={patient.alternative_phone} />
          <Field label="Community health worker" value={chwName} />
          <Field label="Address" value={patient.address} />
          <Field label="Emergency contact" value={patient.emergency_contact_name} />
          <Field label="Emergency contact phone" value={patient.emergency_contact_phone} />
          <Field label="Registration date" value={formatDisplayDate(patient.registration_date)} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-[15px]">Current pregnancy</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-3">
          {pregnancy ? (
            <>
              <Field label="Pregnancy episode" value={`#${pregnancy.pregnancy_number}`} />
              <Field label="Gravida" value={pregnancy.gravida ?? undefined} />
              <Field label="Para" value={pregnancy.para ?? undefined} />
              <Field label="LMP" value={formatDisplayDate(pregnancy.lmp)} />
              <Field label="EDD" value={formatDisplayDate(pregnancy.edd)} />
              <Field label="Status" value={pregnancy.status} />
              <div className="sm:col-span-3">
                <Field
                  label="Gestational information"
                  value={pregnancy.gestational_information}
                />
              </div>
            </>
          ) : (
            <p className="text-sm text-muted-foreground sm:col-span-3">
              No pregnancy episode recorded.
            </p>
          )}
        </CardContent>
      </Card>

      {patient.notes ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-[15px]">Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="whitespace-pre-wrap text-sm text-muted-foreground">{patient.notes}</p>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
