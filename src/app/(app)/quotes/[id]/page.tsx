import { requireBusiness } from "@/lib/session";
import { db } from "@/db";
import { quotes } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Suspense } from "react";
import { statusLabel } from "@/lib/invoice-utils";
import { QuoteActions } from "./quote-actions";
import { LimitBanner } from "../../limit-banner";
import { SavedToast } from "../../saved-toast";

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
  accepted: "bg-green-100 text-green-700",
  declined: "bg-red-100 text-red-700",
  expired: "bg-gray-100 text-gray-500",
};

export default async function QuoteDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ limitReached?: string; plan?: string }>;
}) {
  const { id } = await params;
  const { limitReached, plan } = await searchParams;
  const { business } = await requireBusiness();

  const quote = await db.query.quotes.findFirst({
    where: and(eq(quotes.id, id), eq(quotes.businessId, business.id)),
    with: { client: true, lineItems: true },
  });
  if (!quote) notFound();

  const lineItems = [...quote.lineItems].sort((a, b) => a.sortOrder - b.sortOrder);

  return (
    <div className="p-4 sm:p-8 max-w-3xl mx-auto">
      <Suspense fallback={null}>
        <SavedToast />
      </Suspense>
      {limitReached && <LimitBanner limit={limitReached} planName={plan ?? "Starter"} />}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-8">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">{quote.number}</h1>
            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[quote.status]}`}>
              {statusLabel(quote.status)}
            </span>
          </div>
          <p className="text-gray-600 mt-1">{quote.client.name}</p>
          {quote.convertedInvoiceId && (
            <p className="text-sm mt-1">
              <Link href={`/invoices/${quote.convertedInvoiceId}`} className="text-gray-900 underline">
                View converted invoice
              </Link>
            </p>
          )}
        </div>
        <QuoteActions
          quoteId={quote.id}
          quoteNumber={quote.number}
          status={quote.status}
          hasClientEmail={!!quote.client.email}
          alreadyConverted={!!quote.convertedInvoiceId}
          businessName={business.name}
        />
      </div>

      <div className="bg-white border border-gray-200 rounded-lg p-4 sm:p-6">
        <div className="grid sm:grid-cols-3 gap-4 mb-6 text-sm">
          <div>
            <p className="text-gray-500">Issue date</p>
            <p className="font-medium">{quote.issueDate}</p>
          </div>
          <div>
            <p className="text-gray-500">Valid until</p>
            <p className="font-medium">{quote.expiryDate}</p>
          </div>
          <div>
            <p className="text-gray-500">Total</p>
            <p className="font-medium">{money(quote.total, quote.currency)}</p>
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
                  <td className="py-2 text-right">{money(li.unitPrice, quote.currency)}</td>
                  <td className="py-2 text-right">{money(li.amount, quote.currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex justify-end">
          <div className="w-56 text-sm space-y-1">
            <div className="flex justify-between">
              <span className="text-gray-500">Subtotal</span>
              <span>{money(quote.subtotal, quote.currency)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Tax ({quote.taxRate}%)</span>
              <span>{money(quote.taxAmount, quote.currency)}</span>
            </div>
            <div className="flex justify-between font-semibold text-base pt-2 border-t border-gray-200">
              <span>Total</span>
              <span>{money(quote.total, quote.currency)}</span>
            </div>
          </div>
        </div>

        {quote.notes && (
          <div className="mt-6 pt-6 border-t border-gray-200 text-sm">
            <p className="text-gray-500 mb-1">Notes</p>
            <p>{quote.notes}</p>
          </div>
        )}
      </div>
    </div>
  );
}
