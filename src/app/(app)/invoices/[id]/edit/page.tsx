import { requireBusiness } from "@/lib/session";
import { db } from "@/db";
import { clients, items, invoices } from "@/db/schema";
import { and, eq, desc } from "drizzle-orm";
import { notFound } from "next/navigation";
import { updateInvoice } from "@/lib/actions/invoices";
import { InvoiceForm } from "../../invoice-form";

export default async function EditInvoicePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { business } = await requireBusiness();

  const invoice = await db.query.invoices.findFirst({
    where: and(eq(invoices.id, id), eq(invoices.businessId, business.id)),
    with: { lineItems: true },
  });
  if (!invoice) notFound();

  const allClients = await db.query.clients.findMany({
    where: eq(clients.businessId, business.id),
  });
  const savedItems = await db.query.items.findMany({
    where: eq(items.businessId, business.id),
    orderBy: desc(items.createdAt),
  });

  const updateWithId = updateInvoice.bind(null, id);
  const sortedLineItems = [...invoice.lineItems].sort((a, b) => a.sortOrder - b.sortOrder);

  return (
    <div className="p-4 sm:p-8 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold mb-2">Edit invoice {invoice.number}</h1>
      {invoice.status !== "draft" && (
        <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-2 mb-6">
          This invoice has already been {invoice.status}. Saving changes will not automatically notify
          the client — resend it afterwards if they need the updated version.
        </p>
      )}
      {invoice.status === "draft" && <div className="mb-6" />}
      <InvoiceForm
        action={updateWithId}
        allClients={allClients}
        savedItems={savedItems}
        submitLabel="Save changes"
        showStatus
        defaultValues={{
          clientId: invoice.clientId,
          taxRate: invoice.taxRate,
          issueDate: invoice.issueDate,
          dueDate: invoice.dueDate,
          notes: invoice.notes,
          status: invoice.status,
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
