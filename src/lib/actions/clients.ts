"use server";

import { db } from "@/db";
import { clients, invoices, quotes, businesses } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { requireBusiness } from "@/lib/session";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { formatISO } from "date-fns";
import { generateStatementPdf } from "@/lib/statement-pdf";

const clientSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email().optional().or(z.literal("")),
  extraEmails: z.array(z.string().email()),
  address: z.string().optional(),
  contactName: z.string().optional(),
  phone: z.string().optional(),
  extraPhones: z.array(z.string()),
  mobile: z.string().optional(),
  website: z.string().optional(),
  vatNumber: z.string().optional(),
  customPaymentTermsDays: z.number().int().min(0).optional(),
  notes: z.string().optional(),
});

// The form submits repeatable "email" / "phone" inputs (one primary + any
// number of extras added via the "+ Add" button). getAll() picks up every
// input sharing that name; the first non-blank one becomes the primary
// value stored in the existing column, the rest are kept as a JSON array.
function splitPrimaryAndExtras(values: FormDataEntryValue[]) {
  const cleaned = values.map((v) => String(v).trim()).filter(Boolean);
  const [primary, ...extras] = cleaned;
  return { primary: primary ?? "", extras };
}

function parseClientForm(formData: FormData) {
  const customPaymentTerms = formData.get("customPaymentTermsDays");
  const { primary: email, extras: extraEmails } = splitPrimaryAndExtras(formData.getAll("email"));
  const { primary: phone, extras: extraPhones } = splitPrimaryAndExtras(formData.getAll("phone"));

  return clientSchema.parse({
    name: formData.get("name"),
    email,
    extraEmails,
    address: formData.get("address") || undefined,
    contactName: formData.get("contactName") || undefined,
    phone,
    extraPhones,
    mobile: formData.get("mobile") || undefined,
    website: formData.get("website") || undefined,
    vatNumber: formData.get("vatNumber") || undefined,
    customPaymentTermsDays:
      customPaymentTerms && customPaymentTerms !== "" ? Number(customPaymentTerms) : undefined,
    notes: formData.get("notes") || undefined,
  });
}

export async function createClient(formData: FormData) {
  const { business } = await requireBusiness();
  const parsed = parseClientForm(formData);

  await db.insert(clients).values({
    businessId: business.id,
    name: parsed.name,
    email: parsed.email || null,
    extraEmails: parsed.extraEmails.length ? JSON.stringify(parsed.extraEmails) : null,
    address: parsed.address || null,
    contactName: parsed.contactName || null,
    phone: parsed.phone || null,
    extraPhones: parsed.extraPhones.length ? JSON.stringify(parsed.extraPhones) : null,
    mobile: parsed.mobile || null,
    website: parsed.website || null,
    vatNumber: parsed.vatNumber || null,
    customPaymentTermsDays: parsed.customPaymentTermsDays ?? null,
    notes: parsed.notes || null,
  });

  revalidatePath("/clients");
  redirect(`/clients?saved=${encodeURIComponent("Client added")}`);
}

export async function updateClient(clientId: string, formData: FormData) {
  const { business } = await requireBusiness();
  const parsed = parseClientForm(formData);

  await db
    .update(clients)
    .set({
      name: parsed.name,
      email: parsed.email || null,
      extraEmails: parsed.extraEmails.length ? JSON.stringify(parsed.extraEmails) : null,
      address: parsed.address || null,
      contactName: parsed.contactName || null,
      phone: parsed.phone || null,
      extraPhones: parsed.extraPhones.length ? JSON.stringify(parsed.extraPhones) : null,
      mobile: parsed.mobile || null,
      website: parsed.website || null,
      vatNumber: parsed.vatNumber || null,
      customPaymentTermsDays: parsed.customPaymentTermsDays ?? null,
      notes: parsed.notes || null,
      updatedAt: new Date().toISOString(),
    })
    .where(and(eq(clients.id, clientId), eq(clients.businessId, business.id)));

  revalidatePath("/clients");
  redirect(`/clients?saved=${encodeURIComponent("Client updated")}`);
}

export async function deleteClient(clientId: string) {
  const { business } = await requireBusiness();
  await db
    .delete(clients)
    .where(and(eq(clients.id, clientId), eq(clients.businessId, business.id)));
  revalidatePath("/clients");
}

/**
 * Builds a client statement PDF — every invoice and quote for this client
 * in one timeline plus the outstanding balance, similar to a client's
 * "Activity" view in other invoicing apps. Outstanding balance uses the
 * same definition as the dashboard's "Outstanding" figure (sent/overdue
 * invoices, total minus what's been paid).
 */
export async function buildStatementPdfBuffer(clientId: string, businessId: string) {
  const [business, client, clientInvoices, clientQuotes] = await Promise.all([
    db.query.businesses.findFirst({ where: eq(businesses.id, businessId) }),
    db.query.clients.findFirst({ where: and(eq(clients.id, clientId), eq(clients.businessId, businessId)) }),
    db.query.invoices.findMany({ where: and(eq(invoices.clientId, clientId), eq(invoices.businessId, businessId)) }),
    db.query.quotes.findMany({ where: and(eq(quotes.clientId, clientId), eq(quotes.businessId, businessId)) }),
  ]);
  if (!business) throw new Error("Business not found");
  if (!client) throw new Error("Client not found");

  const outstandingBalance = clientInvoices
    .filter((i) => i.status === "sent" || i.status === "overdue")
    .reduce((sum, i) => sum + (i.total - i.amountPaid), 0);

  const documents = [
    ...clientInvoices.map((i) => ({
      type: "invoice" as const,
      number: i.number,
      date: i.issueDate,
      dueDate: i.dueDate,
      status: i.status,
      total: i.total,
    })),
    ...clientQuotes.map((q) => ({
      type: "quote" as const,
      number: q.number,
      date: q.issueDate,
      dueDate: q.expiryDate,
      status: q.status,
      total: q.total,
    })),
  ].sort((a, b) => (a.date < b.date ? 1 : -1));

  return generateStatementPdf({
    business,
    client,
    generatedAt: formatISO(new Date(), { representation: "date" }),
    currency: business.currency,
    outstandingBalance,
    documents,
  });
}
