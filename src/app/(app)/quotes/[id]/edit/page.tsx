import { requireBusiness } from "@/lib/session";
import { db } from "@/db";
import { clients, items, quotes } from "@/db/schema";
import { and, eq, desc } from "drizzle-orm";
import { notFound } from "next/navigation";
import { updateQuote } from "@/lib/actions/quotes";
import { QuoteForm } from "../../quote-form";

export default async function EditQuotePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { business } = await requireBusiness();

  const quote = await db.query.quotes.findFirst({
    where: and(eq(quotes.id, id), eq(quotes.businessId, business.id)),
    with: { lineItems: true },
  });
  if (!quote) notFound();

  const allClients = await db.query.clients.findMany({
    where: eq(clients.businessId, business.id),
  });
  const savedItems = await db.query.items.findMany({
    where: eq(items.businessId, business.id),
    orderBy: desc(items.createdAt),
  });

  const updateWithId = updateQuote.bind(null, id);
  const sortedLineItems = [...quote.lineItems].sort((a, b) => a.sortOrder - b.sortOrder);

  return (
    <div className="p-4 sm:p-8 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold mb-8">Edit quote {quote.number}</h1>
      <QuoteForm
        action={updateWithId}
        allClients={allClients}
        savedItems={savedItems}
        submitLabel="Save changes"
        showStatus
        defaultValues={{
          clientId: quote.clientId,
          taxRate: quote.taxRate,
          issueDate: quote.issueDate,
          expiryDate: quote.expiryDate,
          notes: quote.notes,
          status: quote.status,
          lineItems: sortedLineItems.map((li) => ({
            code: li.code || "",
            description: li.description,
            quantity: String(li.quantity),
            unitPrice: String(li.unitPrice),
          })),
        }}
      />
    </div>
  );
}
