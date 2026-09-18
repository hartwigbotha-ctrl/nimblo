import { NextRequest, NextResponse } from "next/server";
import { requireBusiness } from "@/lib/session";
import { buildStatementPdfBuffer } from "@/lib/actions/clients";
import { db } from "@/db";
import { clients } from "@/db/schema";
import { and, eq } from "drizzle-orm";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const { business } = await requireBusiness();

  const client = await db.query.clients.findFirst({
    where: and(eq(clients.id, id), eq(clients.businessId, business.id)),
  });
  if (!client) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const pdfBuffer = await buildStatementPdfBuffer(id, business.id);

  return new NextResponse(new Uint8Array(pdfBuffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${business.name} - ${client.name} statement.pdf"`,
    },
  });
}
