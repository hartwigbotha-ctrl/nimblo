"use server";

import { db } from "@/db";
import { quotes, quoteLineItems, clients, invoices, invoiceLineItems } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { requireBusiness } from "@/lib/session";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { calcTotals, nextQuoteNumber, nextInvoiceNumber, type LineItemInput } from "@/lib/invoice-utils";
import { generateInvoicePdf } from "@/lib/invoice-pdf";
import { sendQuoteEmail, friendlyEmailError } from "@/lib/mailer";
import { checkMonthlyDocumentLimit } from "@/lib/plan-access";
import { addDays, formatISO } from "date-fns";

function parseLineItems(formData: FormData): LineItemInput[] {
  const descriptions = formData.getAll("li_description") as string[];
  const quantities = formData.getAll("li_quantity") as string[];
  const unitPrices = formData.getAll("li_unitPrice") as string[];

  const items: LineItemInput[] = [];
  for (let i = 0; i < descriptions.length; i++) {
    const description = descriptions[i]?.trim();
    if (!description) continue;
    items.push({
      description,
      quantity: Number(quantities[i] || 0) || 0,
      unitPrice: Number(unitPrices[i] || 0) || 0,
    });
  }
  if (items.length === 0) {
    throw new Error("At least one line item is required");
  }
  return items;
}

export async function createQuote(formData: FormData) {
  const { business } = await requireBusiness();
  const limitCheck = await checkMonthlyDocumentLimit(business.id);
  if (!limitCheck.ok) {
    redirect(`/quotes/new?limitReached=${limitCheck.limit}&plan=${encodeURIComponent(limitCheck.planName)}`);
  }

  const clientId = formData.get("clientId") as string;
  const taxRate = Number(formData.get("taxRate") || business.defaultTaxRate);
  const issueDate = (formData.get("issueDate") as string) || formatISO(new Date(), { representation: "date" });
  const expiryDate =
    (formData.get("expiryDate") as string) ||
    formatISO(addDays(new Date(issueDate), 30), { representation: "date" });
  const notes = (formData.get("notes") as string) || null;

  const client = await db.query.clients.findFirst({
    where: and(eq(clients.id, clientId), eq(clients.businessId, business.id)),
  });
  if (!client) throw new Error("Client not found");

  const lineItems = parseLineItems(formData);
  const { subtotal, taxAmount, total } = calcTotals(lineItems, taxRate);
  const number = await nextQuoteNumber(business.id);

  const inserted = await db
    .insert(quotes)
    .values({
      businessId: business.id,
      clientId,
      number,
      status: "draft",
      issueDate,
      expiryDate,
      currency: business.currency,
      subtotal,
      taxRate,
      taxAmount,
      total,
      notes,
    })
    .returning();

  const quoteId = inserted[0].id;

  await db.insert(quoteLineItems).values(
    lineItems.map((li, i) => ({
      quoteId,
      description: li.description,
      quantity: li.quantity,
      unitPrice: li.unitPrice,
      amount: Math.round(li.quantity * li.unitPrice * 100) / 100,
      sortOrder: i,
    }))
  );

  revalidatePath("/quotes");
  redirect(`/quotes/${quoteId}?saved=${encodeURIComponent("Quote created")}`);
}

export async function updateQuote(quoteId: string, formData: FormData) {
  const { business } = await requireBusiness();

  const existing = await db.query.quotes.findFirst({
    where: and(eq(quotes.id, quoteId), eq(quotes.businessId, business.id)),
  });
  if (!existing) throw new Error("Quote not found");

  const clientId = formData.get("clientId") as string;
  const taxRate = Number(formData.get("taxRate") || business.defaultTaxRate);
  const issueDate = (formData.get("issueDate") as string) || existing.issueDate;
  const expiryDate = (formData.get("expiryDate") as string) || existing.expiryDate;
  const notes = (formData.get("notes") as string) || null;
  const statusInput = formData.get("status") as string;
  const status =
    statusInput && ["draft", "sent", "accepted", "declined", "expired"].includes(statusInput)
      ? statusInput
      : existing.status;

  const client = await db.query.clients.findFirst({
    where: and(eq(clients.id, clientId), eq(clients.businessId, business.id)),
  });
  if (!client) throw new Error("Client not found");

  const lineItems = parseLineItems(formData);
  const { subtotal, taxAmount, total } = calcTotals(lineItems, taxRate);

  await db
    .update(quotes)
    .set({
      clientId,
      issueDate,
      expiryDate,
      notes,
      taxRate,
      subtotal,
      taxAmount,
      total,
      status,
      respondedAt:
        status === "accepted" || status === "declined"
          ? existing.respondedAt || new Date().toISOString()
          : status === existing.status
          ? existing.respondedAt
          : null,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(quotes.id, quoteId));

  await db.delete(quoteLineItems).where(eq(quoteLineItems.quoteId, quoteId));
  await db.insert(quoteLineItems).values(
    lineItems.map((li, i) => ({
      quoteId,
      description: li.description,
      quantity: li.quantity,
      unitPrice: li.unitPrice,
      amount: Math.round(li.quantity * li.unitPrice * 100) / 100,
      sortOrder: i,
    }))
  );

  revalidatePath("/quotes");
  revalidatePath(`/quotes/${quoteId}`);
  redirect(`/quotes/${quoteId}?saved=${encodeURIComponent("Quote updated")}`);
}

export async function deleteQuote(quoteId: string) {
  const { business } = await requireBusiness();
  await db.delete(quotes).where(and(eq(quotes.id, quoteId), eq(quotes.businessId, business.id)));
  revalidatePath("/quotes");
  redirect("/quotes");
}

async function loadFullQuote(quoteId: string, businessId: string) {
  const quote = await db.query.quotes.findFirst({
    where: and(eq(quotes.id, quoteId), eq(quotes.businessId, businessId)),
    with: { lineItems: true, client: true, business: true },
  });
  if (!quote) throw new Error("Quote not found");
  return quote;
}

export async function buildQuotePdfBuffer(quoteId: string, businessId: string) {
  const quote = await loadFullQuote(quoteId, businessId);
  return generateInvoicePdf({
    docType: "quote",
    business: quote.business,
    client: quote.client,
    invoice: { ...quote, dueDate: quote.expiryDate },
    lineItems: quote.lineItems.sort((a, b) => a.sortOrder - b.sortOrder),
  });
}

export type SendQuoteResult = { ok: true } | { ok: false; error: string };

export async function sendQuote(quoteId: string): Promise<SendQuoteResult> {
  const { business } = await requireBusiness();
  const quote = await loadFullQuote(quoteId, business.id);

  if (!quote.client.email) {
    return { ok: false, error: "This client has no email address on file." };
  }

  const pdfBuffer = await generateInvoicePdf({
    docType: "quote",
    business: quote.business,
    client: quote.client,
    invoice: { ...quote, dueDate: quote.expiryDate },
    lineItems: quote.lineItems.sort((a, b) => a.sortOrder - b.sortOrder),
  });

  try {
    await sendQuoteEmail({
      to: quote.client.email,
      businessName: quote.business.name,
      quoteNumber: quote.number,
      total: `${quote.currency} ${quote.total.toFixed(2)}`,
      expiryDate: quote.expiryDate,
      pdfBuffer,
    });
  } catch (err) {
    console.error(`[quotes] failed to send ${quote.number}`, err);
    const message = err instanceof Error ? err.message : "Failed to send email.";
    return { ok: false, error: friendlyEmailError(message) };
  }

  const now = new Date().toISOString();
  await db
    .update(quotes)
    .set({ status: quote.status === "draft" ? "sent" : quote.status, sentAt: now, updatedAt: now })
    .where(eq(quotes.id, quoteId));

  revalidatePath(`/quotes/${quoteId}`);
  revalidatePath("/quotes");
  return { ok: true };
}

export async function markQuoteResponded(quoteId: string, accepted: boolean) {
  const { business } = await requireBusiness();
  const quote = await db.query.quotes.findFirst({
    where: and(eq(quotes.id, quoteId), eq(quotes.businessId, business.id)),
  });
  if (!quote) throw new Error("Quote not found");

  await db
    .update(quotes)
    .set({
      status: accepted ? "accepted" : "declined",
      respondedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })
    .where(eq(quotes.id, quoteId));

  revalidatePath(`/quotes/${quoteId}`);
  revalidatePath("/quotes");
}

/** Creates a new draft invoice from an accepted (or any) quote's client + line items. */
export async function convertQuoteToInvoice(quoteId: string) {
  const { business } = await requireBusiness();
  const limitCheck = await checkMonthlyDocumentLimit(business.id);
  if (!limitCheck.ok) {
    redirect(`/quotes/${quoteId}?limitReached=${limitCheck.limit}&plan=${encodeURIComponent(limitCheck.planName)}`);
  }
  const quote = await loadFullQuote(quoteId, business.id);

  const number = await nextInvoiceNumber(business.id);
  const issueDate = formatISO(new Date(), { representation: "date" });
  const dueDate = formatISO(addDays(new Date(), business.paymentTermsDays), {
    representation: "date",
  });

  const inserted = await db
    .insert(invoices)
    .values({
      businessId: business.id,
      clientId: quote.clientId,
      number,
      status: "draft",
      issueDate,
      dueDate,
      currency: quote.currency,
      subtotal: quote.subtotal,
      taxRate: quote.taxRate,
      taxAmount: quote.taxAmount,
      total: quote.total,
      notes: quote.notes,
    })
    .returning();

  const invoiceId = inserted[0].id;
  const sortedLineItems = [...quote.lineItems].sort((a, b) => a.sortOrder - b.sortOrder);

  await db.insert(invoiceLineItems).values(
    sortedLineItems.map((li, i) => ({
      invoiceId,
      description: li.description,
      quantity: li.quantity,
      unitPrice: li.unitPrice,
      amount: li.amount,
      sortOrder: i,
    }))
  );

  await db
    .update(quotes)
    .set({ convertedInvoiceId: invoiceId, updatedAt: new Date().toISOString() })
    .where(eq(quotes.id, quoteId));

  revalidatePath("/quotes");
  revalidatePath("/invoices");
  redirect(`/invoices/${invoiceId}?saved=${encodeURIComponent("Draft invoice created from quote")}`);
}
