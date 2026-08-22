"use client";

import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Escapes a single CSV field per RFC 4180: wrap in quotes if it contains a comma, quote, or newline; double any embedded quotes. */
function csvField(value: string | number): string {
  const str = String(value);
  return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
}

function toCsv(rows: Array<Record<string, string | number>>): string {
  if (rows.length === 0) return "";
  const headers = Object.keys(rows[0]);
  const lines = [headers.join(",")];
  for (const row of rows) {
    lines.push(headers.map((h) => csvField(row[h] ?? "")).join(","));
  }
  return lines.join("\n");
}

/**
 * Generic CSV export for any report table already fetched server-side
 * and handed to this client component as flat rows — no extra round
 * trip to re-fetch the same data just to format it. Standard
 * client-side download (Blob + a temporary <a download>), unrelated to
 * the Artifact viewer's sandboxed-download restriction — this is a
 * normal feature of the deployed app, not an Artifact preview.
 */
export function ExportCsvButton({
  filename,
  rows,
}: {
  filename: string;
  rows: Array<Record<string, string | number>>;
}) {
  function handleExport() {
    const csv = toCsv(rows);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  return (
    <Button variant="outline" size="sm" onClick={handleExport} disabled={rows.length === 0}>
      <Download className="h-4 w-4" />
      Export CSV
    </Button>
  );
}
