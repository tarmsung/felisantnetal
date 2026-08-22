import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

/**
 * Groups a long form into scannable sections (spec section 20:
 * "FormSection"). Used by patient registration/edit today; reuse this
 * rather than a bespoke <Card> wrapper wherever another multi-field form
 * shows up (visit recording, settings, etc.).
 */
export function FormSection({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-[15px]">{title}</CardTitle>
        {description ? <CardDescription>{description}</CardDescription> : null}
      </CardHeader>
      <CardContent className="grid gap-4 sm:grid-cols-2">{children}</CardContent>
    </Card>
  );
}
