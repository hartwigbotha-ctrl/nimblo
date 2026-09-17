import React from "react";
import {
  Document,
  Page,
  Text,
  View,
  Image,
  StyleSheet,
  renderToBuffer,
} from "@react-pdf/renderer";
// react-pdf's internal Style type isn't cleanly exported for reuse across
// components; these layout-variant styles are plain objects passed straight
// through to <View style={...}>, so `any` is the pragmatic choice here.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type PdfStyle = any;

export type InvoicePdfData = {
  docType?: "invoice" | "quote";
  business: {
    name: string;
    email: string;
    phone?: string | null;
    address?: string | null;
    vatNumber?: string | null;
    bankDetails?: string | null;
    logoUrl?: string | null;
    logoHeight?: number | null;
    logoAlign?: string | null;
    brandColor?: string | null;
    pdfTemplate?: string | null;
  };
  client: {
    name: string;
    email?: string | null;
    address?: string | null;
    vatNumber?: string | null;
  };
  invoice: {
    number: string;
    status: string;
    issueDate: string;
    dueDate: string;
    currency: string;
    subtotal: number;
    taxRate: number;
    taxAmount: number;
    total: number;
    notes?: string | null;
  };
  lineItems: { description: string; quantity: number; unitPrice: number; amount: number }[];
};

function money(amount: number, currency: string) {
  try {
    return new Intl.NumberFormat("en-ZA", { style: "currency", currency }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
}

// Builds the logo's <Image> style from the business's saved size/position
// settings (set in Settings > Branding), falling back to sensible defaults
// for businesses that haven't configured these yet.
function logoStyle(business: InvoicePdfData["business"]): PdfStyle {
  const height = business.logoHeight && business.logoHeight > 0 ? business.logoHeight : 40;
  const alignSelf =
    business.logoAlign === "center" ? "center" : business.logoAlign === "right" ? "flex-end" : "flex-start";
  return { height, marginBottom: 8, objectFit: "contain", alignSelf };
}

function statusColor(status: string) {
  switch (status) {
    case "paid":
    case "accepted":
      return { backgroundColor: "#dcfce7", color: "#166534" };
    case "overdue":
    case "declined":
      return { backgroundColor: "#fee2e2", color: "#991b1b" };
    case "sent":
      return { backgroundColor: "#dbeafe", color: "#1e40af" };
    default:
      return { backgroundColor: "#f3f4f6", color: "#374151" };
  }
}

// Turns e.g. "#111827" into "rgba(17,24,39,0.08)" for a subtle brand-color tint.
function tint(hex: string, alpha: number) {
  const clean = (hex || "#111827").replace("#", "");
  const full = clean.length === 3 ? clean.split("").map((c) => c + c).join("") : clean;
  const num = parseInt(full, 16);
  if (Number.isNaN(num)) return `rgba(17,24,39,${alpha})`;
  const r = (num >> 16) & 255;
  const g = (num >> 8) & 255;
  const b = num & 255;
  return `rgba(${r},${g},${b},${alpha})`;
}

const base = StyleSheet.create({
  page: { padding: 40, fontSize: 10, fontFamily: "Helvetica", color: "#1f2937" },
  small: { fontSize: 9, color: "#6b7280" },
  section: { marginBottom: 20 },
  sectionLabel: { fontSize: 9, color: "#6b7280", marginBottom: 4, textTransform: "uppercase" },
  colDesc: { flex: 4 },
  colQty: { flex: 1, textAlign: "right" },
  colPrice: { flex: 1.5, textAlign: "right" },
  colAmount: { flex: 1.5, textAlign: "right" },
  totalsBlock: { marginTop: 12, alignSelf: "flex-end", width: 220 },
  totalsRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 3 },
  totalsLabel: { color: "#6b7280" },
  footer: { marginTop: 30, fontSize: 9, color: "#6b7280" },
  statusBadge: {
    marginTop: 8,
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 3,
    fontSize: 9,
    fontWeight: 700,
  },
});

function LineItemsTable({
  data,
  headerStyle,
  rowStyle,
}: {
  data: InvoicePdfData;
  headerStyle: PdfStyle;
  rowStyle: PdfStyle;
}) {
  const { invoice, lineItems } = data;
  return (
    <View>
      <View style={[{ flexDirection: "row", paddingVertical: 6, paddingHorizontal: 4, fontWeight: 700 }, headerStyle]}>
        <Text style={base.colDesc}>Description</Text>
        <Text style={base.colQty}>Qty</Text>
        <Text style={base.colPrice}>Unit price</Text>
        <Text style={base.colAmount}>Amount</Text>
      </View>
      {lineItems.map((li, i) => (
        <View
          key={i}
          style={[{ flexDirection: "row", paddingVertical: 6, paddingHorizontal: 4 }, rowStyle]}
        >
          <Text style={base.colDesc}>{li.description}</Text>
          <Text style={base.colQty}>{li.quantity}</Text>
          <Text style={base.colPrice}>{money(li.unitPrice, invoice.currency)}</Text>
          <Text style={base.colAmount}>{money(li.amount, invoice.currency)}</Text>
        </View>
      ))}
    </View>
  );
}

function Totals({ data, accentColor }: { data: InvoicePdfData; accentColor: string }) {
  const { invoice } = data;
  return (
    <View style={base.totalsBlock}>
      <View style={base.totalsRow}>
        <Text style={base.totalsLabel}>Subtotal</Text>
        <Text>{money(invoice.subtotal, invoice.currency)}</Text>
      </View>
      <View style={base.totalsRow}>
        <Text style={base.totalsLabel}>Tax ({invoice.taxRate}%)</Text>
        <Text>{money(invoice.taxAmount, invoice.currency)}</Text>
      </View>
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          paddingTop: 6,
          marginTop: 6,
          borderTopWidth: 1.5,
          borderTopColor: accentColor,
          fontWeight: 700,
          fontSize: 12,
        }}
      >
        <Text>Total</Text>
        <Text>{money(invoice.total, invoice.currency)}</Text>
      </View>
    </View>
  );
}

function NotesAndPayment({ data }: { data: InvoicePdfData }) {
  const { invoice, business } = data;
  return (
    <>
      {invoice.notes && (
        <View style={base.section}>
          <Text style={base.sectionLabel}>Notes</Text>
          <Text style={base.small}>{invoice.notes}</Text>
        </View>
      )}
      {business.bankDetails && (
        <View style={base.footer}>
          <Text style={base.sectionLabel}>Payment details</Text>
          <Text>{business.bankDetails}</Text>
        </View>
      )}
    </>
  );
}

// ---------- Modern: shaded table header, bold color accents (default) ----------
function ModernLayout({ data }: { data: InvoicePdfData }) {
  const { business, client, invoice } = data;
  const accent = business.brandColor || "#111827";
  const isQuote = data.docType === "quote";
  return (
    <Page size="A4" style={base.page}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 24 }}>
        <View>
          {business.logoUrl && <Image src={business.logoUrl} style={logoStyle(business)} />}
          <Text style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>{business.name}</Text>
          {business.address && <Text style={base.small}>{business.address}</Text>}
          {business.email && <Text style={base.small}>{business.email}</Text>}
          {business.phone && <Text style={base.small}>{business.phone}</Text>}
          {business.vatNumber && <Text style={base.small}>VAT: {business.vatNumber}</Text>}
        </View>
        <View>
          <Text style={{ fontSize: 22, fontWeight: 700, textAlign: "right", color: accent }}>
            {isQuote ? "QUOTE" : "INVOICE"}
          </Text>
          <Text style={{ fontSize: 9, color: "#6b7280", textAlign: "right" }}>
            {isQuote ? "Quote #" : "Invoice #"}
          </Text>
          <Text style={{ fontSize: 10, textAlign: "right", marginBottom: 6 }}>{invoice.number}</Text>
          <Text style={{ fontSize: 9, color: "#6b7280", textAlign: "right" }}>Issue date</Text>
          <Text style={{ fontSize: 10, textAlign: "right", marginBottom: 6 }}>{invoice.issueDate}</Text>
          <Text style={{ fontSize: 9, color: "#6b7280", textAlign: "right" }}>
            {isQuote ? "Valid until" : "Due date"}
          </Text>
          <Text style={{ fontSize: 10, textAlign: "right", marginBottom: 6 }}>{invoice.dueDate}</Text>
          <View style={[base.statusBadge, statusColor(invoice.status), { alignSelf: "flex-end" }]}>
            <Text>{invoice.status.toUpperCase()}</Text>
          </View>
        </View>
      </View>

      <View style={base.section}>
        <Text style={base.sectionLabel}>Bill to</Text>
        <Text style={{ fontWeight: 700 }}>{client.name}</Text>
        {client.address && <Text style={base.small}>{client.address}</Text>}
        {client.email && <Text style={base.small}>{client.email}</Text>}
        {client.vatNumber && <Text style={base.small}>VAT: {client.vatNumber}</Text>}
      </View>

      <View style={{ marginTop: 10, borderTopWidth: 1, borderTopColor: "#e5e7eb" }}>
        <LineItemsTable
          data={data}
          headerStyle={{ backgroundColor: tint(accent, 0.08) }}
          rowStyle={{ borderBottomWidth: 1, borderBottomColor: "#f3f4f6" }}
        />
      </View>

      <Totals data={data} accentColor={accent} />
      <NotesAndPayment data={data} />
    </Page>
  );
}

// ---------- Classic: centered header, serif-style ----------
function ClassicLayout({ data }: { data: InvoicePdfData }) {
  const { business, client, invoice } = data;
  const accent = business.brandColor || "#111827";
  const isQuote = data.docType === "quote";
  return (
    <Page size="A4" style={[base.page, { fontFamily: "Times-Roman" }]}>
      <View style={{ alignItems: "center", marginBottom: 20 }}>
        {business.logoUrl && <Image src={business.logoUrl} style={logoStyle(business)} />}
        <Text style={{ fontSize: 20, fontWeight: 700, marginBottom: 2 }}>{business.name}</Text>
        {business.address && <Text style={base.small}>{business.address}</Text>}
        {business.email && <Text style={base.small}>{business.email}</Text>}
        {business.vatNumber && <Text style={base.small}>VAT: {business.vatNumber}</Text>}
        <Text style={{ fontSize: 16, fontWeight: 700, color: accent, marginTop: 14, letterSpacing: 2 }}>
          {isQuote ? "QUOTE" : "INVOICE"}
        </Text>
        <View style={{ borderBottomWidth: 1.5, borderBottomColor: accent, width: 120, marginTop: 6 }} />
      </View>

      <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 20 }}>
        <View>
          <Text style={base.sectionLabel}>Bill to</Text>
          <Text style={{ fontWeight: 700 }}>{client.name}</Text>
          {client.address && <Text style={base.small}>{client.address}</Text>}
          {client.email && <Text style={base.small}>{client.email}</Text>}
          {client.vatNumber && <Text style={base.small}>VAT: {client.vatNumber}</Text>}
        </View>
        <View style={{ alignItems: "flex-end" }}>
          <Text style={base.small}>{isQuote ? "Quote" : "Invoice"} # {invoice.number}</Text>
          <Text style={base.small}>Issued {invoice.issueDate}</Text>
          <Text style={base.small}>{isQuote ? "Valid until" : "Due"} {invoice.dueDate}</Text>
          <View style={[base.statusBadge, statusColor(invoice.status)]}>
            <Text>{invoice.status.toUpperCase()}</Text>
          </View>
        </View>
      </View>

      <View style={{ borderTopWidth: 1.5, borderTopColor: accent }}>
        <LineItemsTable
          data={data}
          headerStyle={{ borderBottomWidth: 1, borderBottomColor: "#d1d5db" }}
          rowStyle={{ borderBottomWidth: 0.5, borderBottomColor: "#e5e7eb" }}
        />
      </View>

      <Totals data={data} accentColor={accent} />
      <NotesAndPayment data={data} />
    </Page>
  );
}

// ---------- Minimal: clean lines, no fills ----------
function MinimalLayout({ data }: { data: InvoicePdfData }) {
  const { business, client, invoice } = data;
  const accent = business.brandColor || "#111827";
  const isQuote = data.docType === "quote";
  return (
    <Page size="A4" style={base.page}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 30 }}>
        <View>
          {business.logoUrl && <Image src={business.logoUrl} style={logoStyle(business)} />}
          <Text style={{ fontSize: 14, fontWeight: 700 }}>{business.name}</Text>
          {business.address && <Text style={base.small}>{business.address}</Text>}
          {business.email && <Text style={base.small}>{business.email}</Text>}
          {business.vatNumber && <Text style={base.small}>VAT: {business.vatNumber}</Text>}
        </View>
        <View style={{ alignItems: "flex-end" }}>
          <Text style={{ fontSize: 16, fontWeight: 300, letterSpacing: 3, textTransform: "uppercase" }}>
            {isQuote ? "Quote" : "Invoice"}
          </Text>
          <Text style={[base.small, { marginTop: 8 }]}>#{invoice.number}</Text>
          <Text style={base.small}>Issued {invoice.issueDate}</Text>
          <Text style={base.small}>{isQuote ? "Valid until" : "Due"} {invoice.dueDate}</Text>
          <Text style={{ fontSize: 9, fontWeight: 700, color: accent, marginTop: 4 }}>
            {invoice.status.toUpperCase()}
          </Text>
        </View>
      </View>

      <View style={base.section}>
        <Text style={base.sectionLabel}>Bill to</Text>
        <Text style={{ fontWeight: 700 }}>{client.name}</Text>
        {client.address && <Text style={base.small}>{client.address}</Text>}
        {client.email && <Text style={base.small}>{client.email}</Text>}
      </View>

      <LineItemsTable
        data={data}
        headerStyle={{ borderBottomWidth: 1, borderBottomColor: "#111827" }}
        rowStyle={{ borderBottomWidth: 0.5, borderBottomColor: "#e5e7eb" }}
      />

      <Totals data={data} accentColor={accent} />
      <NotesAndPayment data={data} />
    </Page>
  );
}

export function InvoiceDocument({ data }: { data: InvoicePdfData }) {
  const template = data.business.pdfTemplate || "modern";
  return (
    <Document>
      {template === "classic" ? (
        <ClassicLayout data={data} />
      ) : template === "minimal" ? (
        <MinimalLayout data={data} />
      ) : (
        <ModernLayout data={data} />
      )}
    </Document>
  );
}

export async function generateInvoicePdf(data: InvoicePdfData): Promise<Buffer> {
  return renderToBuffer(<InvoiceDocument data={data} />);
}
