"use server";

import { db } from "@/db";
import { businesses, subscriptions, plans, users } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { requireBusiness, requireSession } from "@/lib/session";
import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { z } from "zod";

const MAX_LOGO_BYTES = 500 * 1024; // 500KB — keeps the PDF/email fast, plenty for a logo
const MIN_LOGO_HEIGHT = 20;
const MAX_LOGO_HEIGHT = 150;
const LOGO_ALIGN_OPTIONS = new Set(["left", "center", "right"]);

export async function updateBusinessSettings(formData: FormData) {
  const { business } = await requireBusiness();

  const update: Record<string, unknown> = {
    name: formData.get("name") as string,
    email: formData.get("email") as string,
    phone: (formData.get("phone") as string) || null,
    address: (formData.get("address") as string) || null,
    vatNumber: (formData.get("vatNumber") as string) || null,
    regNumber: (formData.get("regNumber") as string) || null,
    invoicePrefix: (formData.get("invoicePrefix") as string) || "INV",
    quotePrefix: (formData.get("quotePrefix") as string) || "QUO",
    currency: (formData.get("currency") as string) || "ZAR",
    defaultTaxRate: Number(formData.get("defaultTaxRate") || 0),
    paymentTermsDays: Number(formData.get("paymentTermsDays") || 7),
    bankDetails: (formData.get("bankDetails") as string) || null,
    brandColor: (formData.get("brandColor") as string) || "#111827",
    pdfTemplate: (formData.get("pdfTemplate") as string) || "modern",
    updatedAt: new Date().toISOString(),
  };

  // Logo size (px) and position on the PDF — set in Settings > Branding.
  const logoHeight = Number(formData.get("logoHeight"));
  if (Number.isFinite(logoHeight) && logoHeight > 0) {
    update.logoHeight = Math.min(MAX_LOGO_HEIGHT, Math.max(MIN_LOGO_HEIGHT, Math.round(logoHeight)));
  }
  const logoAlign = formData.get("logoAlign") as string;
  if (LOGO_ALIGN_OPTIONS.has(logoAlign)) {
    update.logoAlign = logoAlign;
  }

  // "Next invoice/quote number" — lets a business migrating from an old
  // system (spreadsheets, another tool) continue their existing numbering
  // instead of resetting to 0001. Only touch it if a valid positive number
  // was submitted, so leaving the field alone never breaks numbering.
  const nextInvoiceSeq = Number(formData.get("nextInvoiceSeq"));
  if (Number.isFinite(nextInvoiceSeq) && nextInvoiceSeq >= 1) {
    update.nextInvoiceSeq = Math.floor(nextInvoiceSeq);
  }
  const nextQuoteSeq = Number(formData.get("nextQuoteSeq"));
  if (Number.isFinite(nextQuoteSeq) && nextQuoteSeq >= 1) {
    update.nextQuoteSeq = Math.floor(nextQuoteSeq);
  }

  // Logo upload is optional on every save — only touch logoUrl if a new
  // file was actually picked, or if the user explicitly asked to remove it.
  const removeLogo = formData.get("removeLogo") === "1";
  const logoFile = formData.get("logo");
  if (removeLogo) {
    update.logoUrl = null;
  } else if (logoFile instanceof File && logoFile.size > 0) {
    if (logoFile.size > MAX_LOGO_BYTES) {
      throw new Error("Logo image is too large — please use one under 500KB.");
    }
    if (!logoFile.type.startsWith("image/")) {
      throw new Error("Logo must be an image file.");
    }
    const buffer = Buffer.from(await logoFile.arrayBuffer());
    update.logoUrl = `data:${logoFile.type};base64,${buffer.toString("base64")}`;
  }

  await db.update(businesses).set(update).where(eq(businesses.id, business.id));

  revalidatePath("/settings");
  revalidatePath("/invoices");
}

/**
 * TEMPORARY: manual plan switch used until real billing (PayFast) is wired
 * up. Lets the account owner set their own plan directly so Pro/Business
 * features can be used and demoed before card payments are live. Once
 * PayFast webhooks are in, subscription rows will be updated automatically
 * from payment events instead and this action can be removed or restricted.
 */
export async function setPlanManually(formData: FormData) {
  const { business } = await requireBusiness();
  const planName = formData.get("planName") as string;

  const plan = await db.query.plans.findFirst({ where: eq(plans.name, planName) });
  if (!plan) throw new Error("Unknown plan");

  const existing = await db.query.subscriptions.findFirst({
    where: eq(subscriptions.businessId, business.id),
    orderBy: desc(subscriptions.createdAt),
  });

  const now = new Date().toISOString();
  if (existing) {
    await db
      .update(subscriptions)
      .set({ planId: plan.id, status: "active", canceledAt: null, updatedAt: now })
      .where(eq(subscriptions.id, existing.id));
  } else {
    await db.insert(subscriptions).values({
      businessId: business.id,
      planId: plan.id,
      status: "active",
    });
  }

  revalidatePath("/settings");
  revalidatePath("/imports");
}

const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Enter your current password"),
    newPassword: z.string().min(8, "New password must be at least 8 characters"),
    confirmPassword: z.string().min(1, "Confirm your new password"),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "New passwords don't match",
    path: ["confirmPassword"],
  });

export type ChangePasswordState = {
  error?: string;
  fieldErrors?: Record<string, string>;
  success?: boolean;
};

// Lets the logged-in account holder change their own password from
// Settings, after confirming their current one. Any user (owner or staff)
// can change their own password this way — it only ever touches the
// currently-signed-in user's row, never anyone else's.
export async function changePassword(
  _prevState: ChangePasswordState,
  formData: FormData
): Promise<ChangePasswordState> {
  const session = await requireSession();
  const userId = (session.user as { id?: string })?.id;
  if (!userId) {
    return { error: "Couldn't find your account. Please log in again." };
  }

  const parsed = changePasswordSchema.safeParse({
    currentPassword: formData.get("currentPassword"),
    newPassword: formData.get("newPassword"),
    confirmPassword: formData.get("confirmPassword"),
  });

  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      fieldErrors[String(issue.path[0])] = issue.message;
    }
    return { fieldErrors };
  }

  const user = await db.query.users.findFirst({ where: eq(users.id, userId) });
  if (!user) {
    return { error: "Couldn't find your account. Please log in again." };
  }

  const valid = await bcrypt.compare(parsed.data.currentPassword, user.passwordHash);
  if (!valid) {
    return { fieldErrors: { currentPassword: "That's not your current password." } };
  }

  const passwordHash = await bcrypt.hash(parsed.data.newPassword, 10);
  await db
    .update(users)
    .set({ passwordHash, updatedAt: new Date().toISOString() })
    .where(eq(users.id, userId));

  return { success: true };
}
