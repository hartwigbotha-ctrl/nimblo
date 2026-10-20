import { db } from "@/db";
import {
  recurringSchedules,
  invoices,
  invoiceLineItems,
  businesses,
  clients,
} from "@/db/schema";
import { eq, and, lte } from "drizzle-orm";
import { calcTotals, nextInvoiceNumber, type LineItemInput } from "@/lib/invoice-utils";
import { computeNextRunDate, type Frequency } from "@/lib/recurring";
import { generateInvoicePdf } from "@/lib/invoice-pdf";
import { sendInvoiceEmail, clientRecipients } from "@/lib/mailer";
import { addDays, formatISO } from "date-fns";

/**
 * Generates (and optionally sends) one invoice from a recurring schedule,
 * then advances the schedule's nextRunDate. Used by both the "run now"
 * server action and the scheduled recurring:run script/cron job.
 */
export async function generateInvoiceFromSchedule(scheduleId: string) {
  const schedule = await db.query.recurringSchedules.findFirst({
    where: eq(recurringSchedules.id, scheduleId),
  });
  if (!schedule || !schedule.active) return null;

  const business = await db.query.businesses.findFirst({
    where: eq(businesses.id, schedule.businessId),
  });
  const client = await db.query.clients.findFirst({
    where: eq(clients.id, schedule.clientId),
  });
  if (!business || !client) return null;

  const lineItems: LineItemInput[] = JSON.parse(schedule.lineItemsJson);
  const taxRate = schedule.taxRate ?? business.defaultTaxRate;
  const { subtotal, taxAmount, total } = calcTotals(lineItems, taxRate);
  const number = await nextInvoiceNumber(business.id);

  const issueDate = formatISO(new Date(), { representation: "date" });
  const dueDate = formatISO(addDays(new Date(), business.paymentTermsDays), {
    representation: "date",
  });

  const inserted = await db
    .insert(invoices)
    .values({
      businessId: business.id,
      clientId: client.id,
      recurringScheduleId: schedule.id,
      number,
      status: "draft",
      issueDate,
      dueDate,
      currency: business.currency,
      subtotal,
      taxRate,
      taxAmount,
      total,
      notes: schedule.notes,
    })
    .returning();

  const invoiceId = inserted[0].id;

  await db.insert(invoiceLineItems).values(
    lineItems.map((li, i) => ({
      invoiceId,
      code: li.code,
      description: li.description,
      quantity: li.quantity,
      unitPrice: li.unitPrice,
      amount: Math.round(li.quantity * li.unitPrice * 100) / 100,
      sortOrder: i,
    }))
  );

  let sent = false;
  if (schedule.autoSend && client.email) {
    const pdfBuffer = await generateInvoicePdf({
      business,
      client,
      invoice: { number, status: "sent", issueDate, dueDate, currency: business.currency, subtotal, taxRate, taxAmount, total, notes: schedule.notes },
      lineItems: lineItems.map((li, i) => ({
        code: li.code,
        description: li.description,
        quantity: li.quantity,
        unitPrice: li.unitPrice,
        amount: Math.round(li.quantity * li.unitPrice * 100) / 100,
      })),
    });

    await sendInvoiceEmail({
      to: clientRecipients(client),
      businessName: business.name,
      invoiceNumber: number,
      total: `${business.currency} ${total.toFixed(2)}`,
      dueDate,
      pdfBuffer,
    });

    await db
      .update(invoices)
      .set({ status: "sent", sentAt: new Date().toISOString() })
      .where(eq(invoices.id, invoiceId));
    sent = true;
  }

  const nextRunDate = computeNextRunDate(
    schedule.nextRunDate,
    schedule.frequency as Frequency,
    schedule.intervalCount
  );

  const pastEnd = schedule.endDate ? nextRunDate > schedule.endDate : false;

  await db
    .update(recurringSchedules)
    .set({
      nextRunDate,
      lastRunAt: new Date().toISOString(),
      active: pastEnd ? false : schedule.active,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(recurringSchedules.id, scheduleId));

  return { invoiceId, sent };
}

/** Finds every active schedule whose nextRunDate has arrived and generates invoices for them. */
export async function runDueSchedules() {
  const today = formatISO(new Date(), { representation: "date" });
  const due = await db.query.recurringSchedules.findMany({
    where: and(eq(recurringSchedules.active, true), lte(recurringSchedules.nextRunDate, today)),
  });

  const results = [];
  for (const schedule of due) {
    // Loop in case a schedule has been dormant for multiple periods (e.g. server was down).
    let current = schedule.nextRunDate;
    let guard = 0;
    while (current <= today && guard < 52) {
      const result = await generateInvoiceFromSchedule(schedule.id);
      if (!result) break;
      results.push({ scheduleId: schedule.id, ...result });
      const updated = await db.query.recurringSchedules.findFirst({
        where: eq(recurringSchedules.id, schedule.id),
      });
      if (!updated || !updated.active) break;
      current = updated.nextRunDate;
      guard++;
    }
  }
  return results;
}
