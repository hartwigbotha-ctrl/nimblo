import { requireBusiness } from "@/lib/session";
import { db } from "@/db";
import { invoices } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { statusLabel } from "@/lib/invoice-utils";
import { InvoiceActions } from "./invoice-actions";

function money(amount: number, currency: string) {
  try {
    return new Intl.NumberFormat("en-ZA", { style: "currency", currency }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
}

const statusColors: Record<string, string> = {
  draft: "bg-gray-100 text-gray-700",
  sent: "bg-blue-100 text-blue-700",
  paid: "bg-green-100 text-green-700",
  overdue: "bg-red-100 text-red-700",
  cancelled: "bg-gray-100 text-gray-500",
};

export default async function InvoiceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { business } = await requireBusiness();

  const invoice = await db.query.invoices.findFirst({
    where: and(eq(invoices.id, id), eq(invoices.businessId, business.id)),
    with: { client: true, lineItems: true },
  });
  if (!invoice) notFound();

  const lineItems = [...invoice.lineItems].sort((a, b) => a.sortOrder - b.sortOrder);

  return (
    <div className="p-4 sm:p-8 max-w-3xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-8">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">{invoice.number}</h1>
            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[invoice.status]}`}>
              {statusLabel(invoice.status)}
            </span>
          </div>
          <p className="text-gray-600 mt-1">{invoice.client.name}</p>
        </div>
        <InvoiceActions
          invoiceId={invoice.id}
          invoiceNumber={invoice.number}
          status={invoice.status}
          hasClientEmail={!!invoice.client.email}
          businessName={business.name}
        />
      </div>

      <div className="bg-white border border-gray-200 rounded-lg p-4 sm:p-6">
        <div className="grid sm:grid-cols-3 gap-4 mb-6 text-sm">
          <div>
            <p className="text-gray-500">Issue date</p>
            <p className="font-medium">{invoice.issueDate}</p>
          </div>
          <div>
            <p className="text-gray-500">Due date</p>
            <p className="font-medium">{invoice.dueDate}</p>
          </div>
          <div>
            <p className="text-gray-500">Amount paid</p>
            <p className="font-medium">{money(invoice.amountPaid, invoice.currency)}</p>
          </div>
        </div>

        <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
          <table className="w-full text-sm mb-4 min-w-[480px]">
            <thead>
              <tr className="text-left text-gray-500 border-b border-gray-100">
                <th className="py-2 font-medium">Description</th>
                <th className="py-2 font-medium text-right">Qty</th>
                <th className="py-2 font-medium text-right">Unit price</th>
                <th className="py-2 font-medium text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {lineItems.map((li) => (
                <tr key={li.id} className="border-b border-gray-50">
                  <td className="py-2">{li.description}</td>
                  <td className="py-2 text-right">{li.quantity}</td>
                  <td className="py-2 text-right">{money(li.unitPrice, invoice.currency)}</td>
                  <td className="py-2 text-right">{money(li.amount, invoice.currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex justify-end">
          <div className="w-56 text-sm space-y-1">
            <div className="flex justify-between">
              <span className="text-gray-500">Subtotal</span>
              <span>{money(invoice.subtotal, invoice.currency)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Tax ({invoice.taxRate}%)</span>
              <span>{money(invoice.taxAmount, invoice.currency)}</span>
            </div>
            <div className="flex justify-between font-semibold text-base pt-2 border-t border-gray-200">
              <span>Total</span>
              <span>{money(invoice.total, invoice.currency)}</span>
            </div>
          </div>
        </div>

        {invoice.notes && (
          <div className="mt-6 pt-6 border-t border-gray-200 text-sm">
            <p className="text-gray-500 mb-1">Notes</p>
            <p>{invoice.notes}</p>
          </div>
        )}
      </div>
    </div>
  );
}
