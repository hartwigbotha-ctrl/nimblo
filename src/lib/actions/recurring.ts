"use server";

import { db } from "@/db";
import { recurringSchedules } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { requireBusiness } from "@/lib/session";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { generateInvoiceFromSchedule } from "@/lib/recurring-engine";
import type { LineItemInput } from "@/lib/invoice-utils";

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
  if (items.length === 0) throw new Error("At least one line item is required");
  return items;
}

export async function createRecurringSchedule(formData: FormData) {
  const { business } = await requireBusiness();

  const clientId = formData.get("clientId") as string;
  const title = formData.get("title") as string;
  const frequency = formData.get("frequency") as string;
  const intervalCount = Number(formData.get("intervalCount") || 1);
  const startDate = formData.get("startDate") as string;
  const endDate = (formData.get("endDate") as string) || null;
  const autoSend = formData.get("autoSend") === "on";
  const taxRateRaw = formData.get("taxRate") as string;
  const taxRate = taxRateRaw ? Number(taxRateRaw) : null;
  const notes = (formData.get("notes") as string) || null;

  const lineItems = parseLineItems(formData);

  await db.insert(recurringSchedules).values({
    businessId: business.id,
    clientId,
    title,
    frequency,
    intervalCount,
    startDate,
    nextRunDate: startDate,
    endDate,
    autoSend,
    taxRate,
    notes,
    lineItemsJson: JSON.stringify(lineItems),
  });

  revalidatePath("/recurring");
  redirect(`/recurring?saved=${encodeURIComponent("Schedule created")}`);
}

export async function toggleScheduleActive(scheduleId: string, active: boolean) {
  const { business } = await requireBusiness();
  await db
    .update(recurringSchedules)
    .set({ active, updatedAt: new Date().toISOString() })
    .where(and(eq(recurringSchedules.id, scheduleId), eq(recurringSchedules.businessId, business.id)));
  revalidatePath("/recurring");
}

export async function deleteSchedule(scheduleId: string) {
  const { business } = await requireBusiness();
  await db
    .delete(recurringSchedules)
    .where(and(eq(recurringSchedules.id, scheduleId), eq(recurringSchedules.businessId, business.id)));
  revalidatePath("/recurring");
}

export async function runScheduleNow(scheduleId: string) {
  const { business } = await requireBusiness();
  const schedule = await db.query.recurringSchedules.findFirst({
    where: and(eq(recurringSchedules.id, scheduleId), eq(recurringSchedules.businessId, business.id)),
  });
  if (!schedule) throw new Error("Schedule not found");

  await generateInvoiceFromSchedule(scheduleId);
  revalidatePath("/recurring");
  revalidatePath("/invoices");
}
