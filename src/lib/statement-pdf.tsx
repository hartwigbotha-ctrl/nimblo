import React from "react";
import { Document, Page, Text, View, Image, StyleSheet, renderToBuffer } from "@react-pdf/renderer";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type PdfStyle = any;

export type StatementPdfData = {
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
  };
  client: {
    name: string;
    email?: string | null;
    address?: string | null;
  };
  generatedAt: string;
  currency: string;
  outstandingBalance: number;
  documents: {
    type: "invoice" | "quote";
    number: string;
    date: string;
    dueDate: string;
    status: string;
    total: number;
  }[];
};

function money(amount: number, currency: string) {
  try {
    return new Intl.NumberFormat("en-ZA", { style: "currency", currency }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
}

function logoStyle(business: StatementPdfData["business"]): PdfStyle {
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

const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 10, fontFamily: "Helvetica", color: "#1f2937" },
  small: { fontSize: 9, color: "#6b7280" },
  sectionLabel: { fontSize: 9, color: "#6b7280", marginBottom: 4, textTransform: "uppercase" },
  colType: { flex: 1.2 },
  colNumber: { flex: 1.4 },
  colDate: { flex: 1.3 },
  colDue: { flex: 1.3 },
  colStatus: { flex: 1.3 },
  colTotal: { flex: 1.3, textAlign: "right" },
  statusBadge: { paddingVertical: 2, paddingHorizontal: 6, borderRadius: 3, fontSize: 8, fontWeight: 700 },
});

export function StatementDocument({ data }: { data: StatementPdfData }) {
  const { business, client, documents } = data;
  const accent = business.brandColor || "#111827";

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 24 }}>
          <View>
            {business.logoUrl && <Image src={business.logoUrl} style={logoStyle(business)} />}
            <Text style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>{business.name}</Text>
            {business.address && <Text style={styles.small}>{business.address}</Text>}
            {business.email && <Text style={styles.small}>{business.email}</Text>}
            {business.phone && <Text style={styles.small}>{business.phone}</Text>}
            {business.vatNumber && <Text style={styles.small}>VAT: {business.vatNumber}</Text>}
          </View>
          <View>
            <Text style={{ fontSize: 22, fontWeight: 700, textAlign: "right", color: accent }}>STATEMENT</Text>
            <Text style={{ fontSize: 9, color: "#6b7280", textAlign: "right" }}>Generated</Text>
            <Text style={{ fontSize: 10, textAlign: "right", marginBottom: 6 }}>{data.generatedAt}</Text>
          </View>
        </View>

        <View style={{ marginBottom: 20 }}>
          <Text style={styles.sectionLabel}>Statement for</Text>
          <Text style={{ fontWeight: 700 }}>{client.name}</Text>
          {client.address && <Text style={styles.small}>{client.address}</Text>}
          {client.email && <Text style={styles.small}>{client.email}</Text>}
        </View>

        <View
          style={{
            backgroundColor: "#f9fafb",
            borderRadius: 4,
            padding: 12,
            marginBottom: 20,
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <Text style={{ fontSize: 10, color: "#6b7280" }}>Outstanding balance</Text>
          <Text style={{ fontSize: 16, fontWeight: 700, color: accent }}>
            {money(data.outstandingBalance, data.currency)}
          </Text>
        </View>

        <View style={{ borderTopWidth: 1, borderTopColor: "#e5e7eb" }}>
          <View
            style={{
              flexDirection: "row",
              paddingVertical: 6,
              paddingHorizontal: 4,
              fontWeight: 700,
              backgroundColor: "#f9fafb",
            }}
          >
            <Text style={styles.colType}>Type</Text>
            <Text style={styles.colNumber}>Number</Text>
            <Text style={styles.colDate}>Date</Text>
            <Text style={styles.colDue}>Due</Text>
            <Text style={styles.colStatus}>Status</Text>
            <Text style={styles.colTotal}>Total</Text>
          </View>
          {documents.length === 0 ? (
            <View style={{ padding: 10 }}>
              <Text style={styles.small}>No invoices or quotes for this client yet.</Text>
            </View>
          ) : (
            documents.map((doc, i) => (
              <View
                key={i}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  paddingVertical: 6,
                  paddingHorizontal: 4,
                  borderBottomWidth: 1,
                  borderBottomColor: "#f3f4f6",
                }}
              >
                <Text style={[styles.colType, { textTransform: "capitalize" }]}>{doc.type}</Text>
                <Text style={styles.colNumber}>{doc.number}</Text>
                <Text style={styles.colDate}>{doc.date}</Text>
                <Text style={styles.colDue}>{doc.dueDate}</Text>
                <View style={styles.colStatus}>
                  <View style={[styles.statusBadge, statusColor(doc.status), { alignSelf: "flex-start" }]}>
                    <Text>{doc.status.toUpperCase()}</Text>
                  </View>
                </View>
                <Text style={styles.colTotal}>{money(doc.total, data.currency)}</Text>
              </View>
            ))
          )}
        </View>

        {business.bankDetails && (
          <View style={{ marginTop: 30, fontSize: 9, color: "#6b7280" }}>
            <Text style={styles.sectionLabel}>Payment details</Text>
            <Text>{business.bankDetails}</Text>
          </View>
        )}
      </Page>
    </Document>
  );
}

export async function generateStatementPdf(data: StatementPdfData): Promise<Buffer> {
  return renderToBuffer(<StatementDocument data={data} />);
}
