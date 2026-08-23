import { FileText } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Links straight to the /reports/export route handler (a real GET request, not a client fetch) — the browser's own "open in new tab" handles the PDF response, no JS needed here. */
export function ExportPdfButton({ href }: { href: string }) {
  return (
    <Button
      variant="outline"
      size="sm"
      render={<a href={href} target="_blank" rel="noopener noreferrer" />}
      nativeButton={false}
    >
      <FileText className="h-4 w-4" />
      Export PDF
    </Button>
  );
}
