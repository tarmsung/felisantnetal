"use client";

import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

export function SettingsTabs({
  clinic,
  schedule,
  rules,
  notifications,
}: {
  clinic: React.ReactNode;
  schedule: React.ReactNode;
  rules: React.ReactNode;
  notifications: React.ReactNode;
}) {
  return (
    <Tabs defaultValue="clinic">
      <TabsList className="flex-wrap">
        <TabsTrigger value="clinic">Clinic</TabsTrigger>
        <TabsTrigger value="schedule">ANC Schedule</TabsTrigger>
        <TabsTrigger value="rules">Clinical Rules</TabsTrigger>
        <TabsTrigger value="notifications">Notifications</TabsTrigger>
      </TabsList>

      <TabsContent value="clinic" className="pt-4">
        {clinic}
      </TabsContent>
      <TabsContent value="schedule" className="pt-4">
        {schedule}
      </TabsContent>
      <TabsContent value="rules" className="pt-4">
        {rules}
      </TabsContent>
      <TabsContent value="notifications" className="pt-4">
        {notifications}
      </TabsContent>
    </Tabs>
  );
}
