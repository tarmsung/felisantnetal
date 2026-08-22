"use client";

import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ComingSoon } from "@/components/shared/coming-soon";

export function PatientTabs({
  overview,
  visits,
  appointments,
  clinicalHistory,
  riskFlags,
  auditHistory,
}: {
  overview: React.ReactNode;
  visits: React.ReactNode;
  appointments: React.ReactNode;
  clinicalHistory: React.ReactNode;
  riskFlags: React.ReactNode;
  /** Omitted entirely (not just empty) for non-administrators — RLS hides the underlying data too. */
  auditHistory?: React.ReactNode;
}) {
  return (
    <Tabs defaultValue="overview">
      <TabsList className="flex-wrap">
        <TabsTrigger value="overview">Overview</TabsTrigger>
        <TabsTrigger value="visits">ANC Visits</TabsTrigger>
        <TabsTrigger value="appointments">Appointments</TabsTrigger>
        <TabsTrigger value="clinical">Clinical History</TabsTrigger>
        <TabsTrigger value="risk">Risk Flags</TabsTrigger>
        <TabsTrigger value="documents">Documents</TabsTrigger>
        {auditHistory ? <TabsTrigger value="audit">Audit History</TabsTrigger> : null}
      </TabsList>

      <TabsContent value="overview" className="pt-4">
        {overview}
      </TabsContent>
      <TabsContent value="visits" className="pt-4">
        {visits}
      </TabsContent>
      <TabsContent value="appointments" className="pt-4">
        {appointments}
      </TabsContent>
      <TabsContent value="clinical" className="pt-4">
        {clinicalHistory}
      </TabsContent>
      <TabsContent value="risk" className="pt-4">
        {riskFlags}
      </TabsContent>
      <TabsContent value="documents" className="pt-4">
        <ComingSoon moduleName="Downloadable patient documents" phase={7} />
      </TabsContent>
      {auditHistory ? (
        <TabsContent value="audit" className="pt-4">
          {auditHistory}
        </TabsContent>
      ) : null}
    </Tabs>
  );
}
