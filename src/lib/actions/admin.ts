"use server";

import { db } from "@/db";
import { businesses, subscriptions, clients, invoices, invoiceLineItems } from "@/db/schema";
import { eq, desc, and } from "drizzle-orm";
import { requireBusiness } from "@/lib/session";
import { isAdminEmail } from "@/lib/admin";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { calcTotals, nextInvoiceNumber, type LineItemInput } from "@/lib/invoice-utils";
import { addDays, formatISO } from "date-fns";

async function requireAdmin() {
  const { session } = await requireBusiness();
  if (!isAdminEmail(session.user?.email)) {
    throw new Error("Not authorized.");
  }
}

type DeleteBusinessResult = { ok: true } | { ok: false; error: string };

/**
 * Permanently deletes a business and everything that belongs to it
 * (clients, invoices, quotes, items, recurring schedules, subscriptions,
 * support tickets — every table with a businessId foreign key cascades,
 * see src/db/schema.ts). There is no undo.
 *
 * Admin-only (same ADMIN_EMAIL gate as /admin), and requires the caller to
 * have typed the business's exact name as a confirmation — a click alone
 * isn't enough for something this destructive. Also refuses to delete a
 * business with a currently *active* paying subscription, so a fat-fingered
 * click on a real paying customer can't wipe their data; cancel the
 * subscription first (or use PayFast directly) if it really needs to go.
 */
export async function deleteBusinessAction(
  businessId: string,
  confirmName: string
): Promise<DeleteBusinessResult> {
  const { session } = await requireBusiness();
  const userEmail = session.user?.email ?? null;

  if (!isAdminEmail(userEmail)) {
    return { ok: false, error: "Not authorized." };
  }

  const business = await db.query.businesses.findFirst({
    where: eq(businesses.id, businessId),
  });
  if (!business) {
    return { ok: false, error: "Business not found — it may already be deleted." };
  }

  if (confirmName.trim() !== business.name.trim()) {
    return { ok: false, error: "Business name didn't match — nothing was deleted." };
  }

  const subscription = await db.query.subscriptions.findFirst({
    where: eq(subscriptions.businessId, businessId),
    orderBy: desc(subscriptions.createdAt),
  });
  if (subscription?.status === "active") {
    return {
      ok: false,
      error:
        "This business has an active paying subscription — cancel it first (in PayFast or from Settings as that business) before deleting.",
    };
  }

  await db.delete(businesses).where(eq(businesses.id, businessId));

  revalidatePath("/admin");
  return { ok: true };
}

/**
 * Lets an admin add a client directly to another business's account — for
 * example, entering a customer's historical invoices for them on request,
 * without needing their login. Same ADMIN_EMAIL gate as the rest of /admin.
 * Deliberately minimal (just the fields a backfilled client record needs);
 * the business's own owner can fill in the rest from Clients later.
 */
export async function adminCreateClient(businessId: string, formData: FormData) {
  await requireAdmin();

  const name = (formData.get("name") as string)?.trim();
  if (!name) throw new Error("Client name is required");

  await db.insert(clients).values({
    businessId,
    name,
    email: (formData.get("email") as string) || null,
    phone: (formData.get("phone") as string) || null,
    address: (formData.get("address") as string) || null,
  });

  revalidatePath(`/admin/${businessId}`);
  redirect(`/admin/${businessId}`);
}

function parseAdminLineItems(formData: FormData): LineItemInput[] {
  const descriptions = formData.getAll("li_description") as string[];
  const quantities = formData.getAll("li_quantity") as string[];
  const unitPrices = formData.getAll("li_unitPrice") as string[];

  const out: LineItemInput[] = [];
  for (let i = 0; i < descriptions.length; i++) {
    const description = descriptions[i]?.trim();
    if (!description) continue;
    out.push({
      description,
      quantity: Number(quantities[i] || 0) || 0,
      unitPrice: Number(unitPrices[i] || 0) || 0,
    });
  }
  if (out.length === 0) throw new Error("At least one line item is required");
  return out;
}

/**
 * Lets an admin create an invoice directly on another business's account —
 * the "do it for them as a favor" path, e.g. backfilling a customer's
 * historical invoices from paper/PDF records they emailed in. Same
 * ADMIN_EMAIL gate as the rest of /admin. Unlike the normal create-invoice
 * action, this accepts a status up front (so a backfilled invoice can be
 * marked "sent"/"paid" immediately instead of starting as a draft) and
 * skips the plan's monthly document limit — an admin backfill shouldn't be
 * blocked by the customer's own plan cap.
 */
export async function adminCreateInvoice(businessId: string, formData: FormData) {
  await requireAdmin();

  const business = await db.query.businesses.findFirst({ where: eq(businesses.id, businessId) });
  if (!business) throw new Error("Business not found");

  const clientId = formData.get("clientId") as string;
  const client = await db.query.clients.findFirst({
    where: eq(clients.id, clientId),
  });
  if (!client || client.businessId !== businessId) throw new Error("Client not found");

  const taxRate = Number(formData.get("taxRate") || business.defaultTaxRate);
  const issueDate = (formData.get("issueDate") as string) || formatISO(new Date(), { representation: "date" });
  const dueDate =
    (formData.get("dueDate") as string) ||
    formatISO(addDays(new Date(issueDate), business.paymentTermsDays), { representation: "date" });
  const notes = (formData.get("notes") as string) || null;
  const statusInput = formData.get("status") as string;
  const status = ["draft", "sent", "paid", "overdue", "cancelled"].includes(statusInput)
    ? statusInput
    : "draft";

  const lineItems = parseAdminLineItems(formData);
  const { subtotal, taxAmount, total } = calcTotals(lineItems, taxRate);

  // Admin-only: an explicit number (e.g. to match a customer's old paper
  // record) skips auto-numbering entirely — it does NOT advance the
  // business's own nextInvoiceSeq counter, so their normal numbering picks
  // up again wherever it left off. Blocks an accidental duplicate within
  // the same business.
  const manualNumber = (formData.get("number") as string)?.trim();
  let number: string;
  if (manualNumber) {
    const existing = await db.query.invoices.findFirst({
      where: and(eq(invoices.businessId, businessId), eq(invoices.number, manualNumber)),
    });
    if (existing) throw new Error(`An invoice numbered "${manualNumber}" already exists for this business.`);
    number = manualNumber;
  } else {
    number = await nextInvoiceNumber(businessId);
  }

  const inserted = await db
    .insert(invoices)
    .values({
      businessId,
      clientId,
      number,
      status,
      issueDate,
      dueDate,
      currency: business.currency,
      subtotal,
      taxRate,
      taxAmount,
      total,
      amountPaid: status === "paid" ? total : 0,
      paidAt: status === "paid" ? new Date().toISOString() : null,
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

  revalidatePath(`/admin/${businessId}`);
  revalidatePath("/admin");
  redirect(`/admin/${businessId}`);
}
