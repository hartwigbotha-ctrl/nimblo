"use server";

import { db } from "@/db";
import { items } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { requireBusiness } from "@/lib/session";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

const itemSchema = z.object({
  code: z.string().optional(),
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  defaultPrice: z.number().min(0).default(0),
  cost: z.number().min(0).default(0),
  unitType: z.string().optional(),
  taxable: z.boolean().default(true),
});

function parseItemForm(formData: FormData) {
  return itemSchema.parse({
    code: (formData.get("code") as string) || undefined,
    name: formData.get("name"),
    description: (formData.get("description") as string) || undefined,
    defaultPrice: Number(formData.get("defaultPrice") || 0),
    cost: Number(formData.get("cost") || 0),
    unitType: (formData.get("unitType") as string) || undefined,
    taxable: formData.get("taxable") === "on",
  });
}

export async function createItem(formData: FormData) {
  const { business } = await requireBusiness();
  const parsed = parseItemForm(formData);

  await db.insert(items).values({
    businessId: business.id,
    code: parsed.code || null,
    name: parsed.name,
    description: parsed.description || null,
    defaultPrice: parsed.defaultPrice,
    cost: parsed.cost,
    unitType: parsed.unitType || null,
    taxable: parsed.taxable,
  });

  revalidatePath("/items");
  redirect(`/items?saved=${encodeURIComponent("Item added")}`);
}

export async function updateItem(itemId: string, formData: FormData) {
  const { business } = await requireBusiness();
  const parsed = parseItemForm(formData);

  await db
    .update(items)
    .set({
      code: parsed.code || null,
      name: parsed.name,
      description: parsed.description || null,
      defaultPrice: parsed.defaultPrice,
      cost: parsed.cost,
      unitType: parsed.unitType || null,
      taxable: parsed.taxable,
      updatedAt: new Date().toISOString(),
    })
    .where(and(eq(items.id, itemId), eq(items.businessId, business.id)));

  revalidatePath("/items");
  redirect(`/items?saved=${encodeURIComponent("Item updated")}`);
}

export async function deleteItem(itemId: string) {
  const { business } = await requireBusiness();
  await db.delete(items).where(and(eq(items.id, itemId), eq(items.businessId, business.id)));
  revalidatePath("/items");
}
