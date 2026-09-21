import { NextRequest, NextResponse } from "next/server";
import { requireBusiness } from "@/lib/session";
import { buildQuotePdfBuffer } from "@/lib/actions/quotes";
import { buildPdfFilename } from "@/lib/pdf-filename";
import { db } from "@/db";
import { quotes } from "@/db/schema";
import { and, eq } from "drizzle-orm";

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  const { business } = await requireBusiness();

  const quote = await db.query.quotes.findFirst({
    where: and(eq(quotes.id, id), eq(quotes.businessId, business.id)),
  });
  if (!quote) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const pdfBuffer = await buildQuotePdfBuffer(id, business.id);

  return new NextResponse(new Uint8Array(pdfBuffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${buildPdfFilename(business.name, quote.number)}"`,
    },
  });
}
