import { StyleSheet } from "@react-pdf/renderer";

/**
 * @react-pdf/renderer has its own flexbox-based styling system — it
 * cannot read the app's Tailwind classes or CSS custom properties
 * (globals.css), so the brand colors are duplicated here as literal
 * hex values. Keep these in sync with globals.css's `:root` tokens by
 * hand; there's no shared source between a browser stylesheet and a
 * PDF renderer's style objects.
 */
export const PDF_COLORS = {
  primary: "#0D6E67",
  foreground: "#0F1F2E",
  muted: "#5B6B7A",
  border: "#E4E9EE",
  card: "#FFFFFF",
  background: "#F5F7F9",
  destructive: "#C0392B",
  warning: "#B7791A",
  success: "#14705A",
};

export const sharedStyles = StyleSheet.create({
  page: {
    paddingTop: 32,
    paddingBottom: 40,
    paddingHorizontal: 36,
    fontSize: 10,
    fontFamily: "Helvetica",
    color: PDF_COLORS.foreground,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 2,
    borderBottomColor: PDF_COLORS.primary,
  },
  clinicName: {
    fontSize: 16,
    fontFamily: "Helvetica-Bold",
    color: PDF_COLORS.primary,
  },
  clinicMeta: {
    fontSize: 8.5,
    color: PDF_COLORS.muted,
    marginTop: 2,
  },
  docTitle: {
    fontSize: 13,
    fontFamily: "Helvetica-Bold",
    textAlign: "right",
  },
  docMeta: {
    fontSize: 8.5,
    color: PDF_COLORS.muted,
    textAlign: "right",
    marginTop: 2,
  },
  sectionTitle: {
    fontSize: 10.5,
    fontFamily: "Helvetica-Bold",
    color: PDF_COLORS.primary,
    marginTop: 14,
    marginBottom: 6,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  fieldGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  field: {
    width: "50%",
    marginBottom: 6,
  },
  fieldLabel: {
    fontSize: 8,
    color: PDF_COLORS.muted,
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },
  fieldValue: {
    fontSize: 10,
    marginTop: 1,
  },
  table: {
    marginTop: 4,
    borderWidth: 1,
    borderColor: PDF_COLORS.border,
    borderRadius: 2,
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: PDF_COLORS.border,
  },
  tableRowLast: {
    flexDirection: "row",
  },
  tableHeaderRow: {
    flexDirection: "row",
    backgroundColor: PDF_COLORS.background,
    borderBottomWidth: 1,
    borderBottomColor: PDF_COLORS.border,
  },
  tableCell: {
    padding: 5,
    fontSize: 8.5,
  },
  tableHeaderCell: {
    padding: 5,
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    color: PDF_COLORS.muted,
    textTransform: "uppercase",
  },
  footer: {
    position: "absolute",
    bottom: 18,
    left: 36,
    right: 36,
    fontSize: 7.5,
    color: PDF_COLORS.muted,
    textAlign: "center",
    borderTopWidth: 1,
    borderTopColor: PDF_COLORS.border,
    paddingTop: 6,
  },
  note: {
    fontSize: 8,
    color: PDF_COLORS.muted,
    marginTop: 8,
    fontStyle: "italic",
  },
});
