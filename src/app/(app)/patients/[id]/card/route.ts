import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/session";
import { generatePatientCardPdf } from "@/lib/services/pdfService";

// @react-pdf/renderer needs real Node APIs (see next.config.ts's
// serverExternalPackages) — this route can never run on the Edge runtime.
export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await requireUser();
  const { id } = await params;

  try {
    const buffer = await generatePatientCardPdf(id, user.full_name);
    // NextResponse's BodyInit type doesn't accept a Node Buffer directly —
    // a plain Uint8Array view over the same bytes satisfies it with no copy.
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/pdf",
        // inline, not attachment — staff typically want to preview/print
        // the card immediately, not save a file to disk first.
        "Content-Disposition": 'inline; filename="anc-card.pdf"',
      },
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to generate the ANC card." },
      { status: 404 },
    );
  }
}
