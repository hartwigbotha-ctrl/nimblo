import { requireBusiness } from "@/lib/session";
import { db } from "@/db";
import { quotes } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import Link from "next/link";
import { statusLabel, sweepExpiredQuotes } from "@/lib/invoice-utils";
import { QuoteRowActions } from "./quote-row-actions";

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

export default async function QuotesPage() {
  const { business } = await requireBusiness();
  await sweepExpiredQuotes(business.id);

  const allQuotes = await db.query.quotes.findMany({
    where: eq(quotes.businessId, business.id),
    with: { client: true },
    orderBy: desc(quotes.createdAt),
  });

  return (
    <div className="p-4 sm:p-8 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-8 gap-3">
        <h1 className="text-2xl font-bold">Quotes</h1>
        <Link
          href="/quotes/new"
          className="bg-gray-900 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-gray-800 whitespace-nowrap"
        >
          + New quote
        </Link>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg">
        {allQuotes.length === 0 ? (
          <div className="p-8 text-center text-sm text-gray-500">
            No quotes yet.{" "}
            <Link href="/quotes/new" className="text-gray-900 underline">
              Create your first quote
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[720px]">
              <thead>
                <tr className="text-left text-gray-500 border-b border-gray-100">
                  <th className="px-5 py-2 font-medium">Number</th>
                  <th className="px-5 py-2 font-medium">Client</th>
                  <th className="px-5 py-2 font-medium">Status</th>
                  <th className="px-5 py-2 font-medium">Issue date</th>
                  <th className="px-5 py-2 font-medium">Valid until</th>
                  <th className="px-5 py-2 font-medium text-right">Total</th>
                  <th className="px-5 py-2 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {allQuotes.map((q) => (
                  <tr key={q.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50">
                    <td className="px-5 py-3">
                      <Link href={`/quotes/${q.id}`} className="font-medium hover:underline">
                        {q.number}
                      </Link>
                    </td>
                    <td className="px-5 py-3 text-gray-600">{q.client.name}</td>
                    <td className="px-5 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[q.status]}`}>
                        {statusLabel(q.status)}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-gray-600">{q.issueDate}</td>
                    <td className="px-5 py-3 text-gray-600">{q.expiryDate}</td>
                    <td className="px-5 py-3 text-right font-medium">
                      {money(q.total, q.currency)}
                    </td>
                    <td className="px-5 py-3">
                      <QuoteRowActions
                        quoteId={q.id}
                        quoteNumber={q.number}
                        businessName={business.name}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
