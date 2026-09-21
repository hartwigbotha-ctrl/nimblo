import { NextRequest, NextResponse } from "next/server";
import { requireBusiness } from "@/lib/session";
import { buildInvoicePdfBuffer } from "@/lib/actions/invoices";
import { buildPdfFilename } from "@/lib/pdf-filename";
import { db } from "@/db";
import { invoices } from "@/db/schema";
import { and, eq } from "drizzle-orm";

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  const { business } = await requireBusiness();

  const invoice = await db.query.invoices.findFirst({
    where: and(eq(invoices.id, id), eq(invoices.businessId, business.id)),
  });
  if (!invoice) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const pdfBuffer = await buildInvoicePdfBuffer(id, business.id);

  return new NextResponse(new Uint8Array(pdfBuffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${buildPdfFilename(business.name, invoice.number)}"`,
    },
  });
}
