"use server";

import { db } from "@/db";
import { invoices, invoiceLineItems, clients, payments } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { requireBusiness } from "@/lib/session";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { calcTotals, nextInvoiceNumber, type LineItemInput } from "@/lib/invoice-utils";
import { generateInvoicePdf } from "@/lib/invoice-pdf";
import { sendInvoiceEmail, friendlyEmailError } from "@/lib/mailer";
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

export async function createInvoice(formData: FormData) {
  const { business } = await requireBusiness();
  const limitCheck = await checkMonthlyDocumentLimit(business.id);
  if (!limitCheck.ok) {
    redirect(`/invoices/new?limitReached=${limitCheck.limit}&plan=${encodeURIComponent(limitCheck.planName)}`);
  }

  const clientId = formData.get("clientId") as string;
  const taxRate = Number(formData.get("taxRate") || business.defaultTaxRate);
  const issueDate = (formData.get("issueDate") as string) || formatISO(new Date(), { representation: "date" });
  const dueDate =
    (formData.get("dueDate") as string) ||
    formatISO(addDays(new Date(issueDate), business.paymentTermsDays), { representation: "date" });
  const notes = (formData.get("notes") as string) || null;

  const client = await db.query.clients.findFirst({
    where: and(eq(clients.id, clientId), eq(clients.businessId, business.id)),
  });
  if (!client) throw new Error("Client not found");

  const lineItems = parseLineItems(formData);
  const { subtotal, taxAmount, total } = calcTotals(lineItems, taxRate);
  const number = await nextInvoiceNumber(business.id);

  const inserted = await db
    .insert(invoices)
    .values({
      businessId: business.id,
      clientId,
      number,
      status: "draft",
      issueDate,
      dueDate,
      currency: business.currency,
      subtotal,
      taxRate,
      taxAmount,
      total,
      notes,
    })
    .returning();

  const invoiceId = inserted[0].id;

  await db.insert(invoiceLineItems).values(
    lineItems.map((li, i) => ({
      invoiceId,
      description: li.description,
      quantity: li.quantity,
      unitPrice: li.unitPrice,
      amount: Math.round(li.quantity * li.unitPrice * 100) / 100,
      sortOrder: i,
    }))
  );

  revalidatePath("/invoices");
  redirect(`/invoices/${invoiceId}?saved=${encodeURIComponent("Invoice created")}`);
}

export async function updateInvoice(invoiceId: string, formData: FormData) {
  const { business } = await requireBusiness();

  const existing = await db.query.invoices.findFirst({
    where: and(eq(invoices.id, invoiceId), eq(invoices.businessId, business.id)),
  });
  if (!existing) throw new Error("Invoice not found");

  const clientId = formData.get("clientId") as string;
  const taxRate = Number(formData.get("taxRate") || business.defaultTaxRate);
  const issueDate = (formData.get("issueDate") as string) || existing.issueDate;
  const dueDate = (formData.get("dueDate") as string) || existing.dueDate;
  const notes = (formData.get("notes") as string) || null;
  const statusInput = formData.get("status") as string;
  const status =
    statusInput && ["draft", "sent", "paid", "overdue", "cancelled"].includes(statusInput)
      ? statusInput
      : existing.status;

  const client = await db.query.clients.findFirst({
    where: and(eq(clients.id, clientId), eq(clients.businessId, business.id)),
  });
  if (!client) throw new Error("Client not found");

  const lineItems = parseLineItems(formData);
  const { subtotal, taxAmount, total } = calcTotals(lineItems, taxRate);

  await db
    .update(invoices)
    .set({
      clientId,
      issueDate,
      dueDate,
      notes,
      taxRate,
      subtotal,
      taxAmount,
      total,
      status,
      // Fixing a mistaken "Paid" status back to something else should also
      // clear the amount-paid/paid-at markers, so the invoice doesn't show
      // as paid on the dashboard/list while its status says otherwise.
      amountPaid: status === "paid" ? Math.max(existing.amountPaid, total) : status === existing.status ? existing.amountPaid : 0,
      paidAt: status === "paid" ? existing.paidAt || new Date().toISOString() : status === existing.status ? existing.paidAt : null,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(invoices.id, invoiceId));

  await db.delete(invoiceLineItems).where(eq(invoiceLineItems.invoiceId, invoiceId));
  await db.insert(invoiceLineItems).values(
    lineItems.map((li, i) => ({
      invoiceId,
      description: li.description,
      quantity: li.quantity,
      unitPrice: li.unitPrice,
      amount: Math.round(li.quantity * li.unitPrice * 100) / 100,
      sortOrder: i,
    }))
  );

  revalidatePath("/invoices");
  revalidatePath(`/invoices/${invoiceId}`);
  redirect(`/invoices/${invoiceId}?saved=${encodeURIComponent("Invoice updated")}`);
}

export async function deleteInvoice(invoiceId: string) {
  const { business } = await requireBusiness();
  await db
    .delete(invoices)
    .where(and(eq(invoices.id, invoiceId), eq(invoices.businessId, business.id)));
  revalidatePath("/invoices");
  redirect("/invoices");
}

export async function markInvoicePaid(invoiceId: string, amount?: number) {
  const { business } = await requireBusiness();
  const invoice = await db.query.invoices.findFirst({
    where: and(eq(invoices.id, invoiceId), eq(invoices.businessId, business.id)),
  });
  if (!invoice) throw new Error("Invoice not found");

  const payAmount = amount ?? invoice.total - invoice.amountPaid;
  const now = new Date().toISOString();

  await db.insert(payments).values({
    invoiceId,
    amount: payAmount,
    method: "manual",
    paidAt: now,
  });

  const newAmountPaid = invoice.amountPaid + payAmount;
  const isFullyPaid = newAmountPaid >= invoice.total - 0.001;

  await db
    .update(invoices)
    .set({
      amountPaid: newAmountPaid,
      status: isFullyPaid ? "paid" : invoice.status,
      paidAt: isFullyPaid ? now : invoice.paidAt,
      updatedAt: now,
    })
    .where(eq(invoices.id, invoiceId));

  revalidatePath(`/invoices/${invoiceId}`);
  revalidatePath("/invoices");
}

async function loadFullInvoice(invoiceId: string, businessId: string) {
  const invoice = await db.query.invoices.findFirst({
    where: and(eq(invoices.id, invoiceId), eq(invoices.businessId, businessId)),
    with: { lineItems: true, client: true, business: true },
  });
  if (!invoice) throw new Error("Invoice not found");
  return invoice;
}

export async function buildInvoicePdfBuffer(invoiceId: string, businessId: string) {
  const invoice = await loadFullInvoice(invoiceId, businessId);
  return generateInvoicePdf({
    business: invoice.business,
    client: invoice.client,
    invoice,
    lineItems: invoice.lineItems.sort((a, b) => a.sortOrder - b.sortOrder),
  });
}

export type SendInvoiceResult = { ok: true } | { ok: false; error: string };

export async function sendInvoice(invoiceId: string): Promise<SendInvoiceResult> {
  const { business } = await requireBusiness();
  const invoice = await loadFullInvoice(invoiceId, business.id);

  if (!invoice.client.email) {
    return { ok: false, error: "This client has no email address on file." };
  }

  const pdfBuffer = await generateInvoicePdf({
    business: invoice.business,
    client: invoice.client,
    invoice,
    lineItems: invoice.lineItems.sort((a, b) => a.sortOrder - b.sortOrder),
  });

  try {
    await sendInvoiceEmail({
      to: invoice.client.email,
      businessName: invoice.business.name,
      invoiceNumber: invoice.number,
      total: `${invoice.currency} ${invoice.total.toFixed(2)}`,
      dueDate: invoice.dueDate,
      pdfBuffer,
    });
  } catch (err) {
    // Server Action errors that reach the client as a thrown Error get
    // their message stripped by Next.js in production — so a raw throw
    // here would crash the page and show a generic "Something went wrong"
    // with no clue why. Return a result instead so the UI can show
    // something useful (e.g. Resend's sandbox-mode restriction message).
    console.error(`[invoices] failed to send ${invoice.number}`, err);
    const message = err instanceof Error ? err.message : "Failed to send email.";
    return { ok: false, error: friendlyEmailError(message) };
  }

  const now = new Date().toISOString();
  await db
    .update(invoices)
    .set({ status: invoice.status === "draft" ? "sent" : invoice.status, sentAt: now, updatedAt: now })
    .where(eq(invoices.id, invoiceId));

  revalidatePath(`/invoices/${invoiceId}`);
  revalidatePath("/invoices");
  return { ok: true };
}
