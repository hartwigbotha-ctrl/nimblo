import { requireBusiness } from "@/lib/session";
import { db } from "@/db";
import { clients, invoices, quotes } from "@/db/schema";
import { and, eq, desc } from "drizzle-orm";
import { notFound } from "next/navigation";
import Link from "next/link";

function money(amount: number, currency: string) {
  try {
    return new Intl.NumberFormat("en-ZA", { style: "currency", currency }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
}

function statusBadge(status: string) {
  const classes: Record<string, string> = {
    paid: "bg-green-100 text-green-700",
    accepted: "bg-green-100 text-green-700",
    overdue: "bg-red-100 text-red-700",
    declined: "bg-red-100 text-red-700",
    sent: "bg-blue-100 text-blue-700",
    expired: "bg-gray-100 text-gray-600",
    cancelled: "bg-gray-100 text-gray-600",
  };
  return classes[status] || "bg-gray-100 text-gray-600";
}

/**
 * A client's "Activity" page — every invoice and quote for this client in
 * one timeline, their outstanding balance, and a "Generate statement" PDF,
 * the way most invoicing apps (Invoice2go, etc.) show a client's history
 * when you click into them from the client list. Editing the client's own
 * details lives at /clients/[id]/edit ("Info" tab below).
 */
export default async function ClientActivityPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { business } = await requireBusiness();

  const client = await db.query.clients.findFirst({
    where: and(eq(clients.id, id), eq(clients.businessId, business.id)),
  });
  if (!client) notFound();

  const [clientInvoices, clientQuotes] = await Promise.all([
    db.query.invoices.findMany({
      where: and(eq(invoices.clientId, id), eq(invoices.businessId, business.id)),
      orderBy: desc(invoices.issueDate),
    }),
    db.query.quotes.findMany({
      where: and(eq(quotes.clientId, id), eq(quotes.businessId, business.id)),
      orderBy: desc(quotes.issueDate),
    }),
  ]);

  const documents = [
    ...clientInvoices.map((i) => ({
      type: "invoice" as const,
      id: i.id,
      number: i.number,
      date: i.issueDate,
      dueDate: i.dueDate,
      status: i.status,
      total: i.total,
      href: `/invoices/${i.id}`,
    })),
    ...clientQuotes.map((q) => ({
      type: "quote" as const,
      id: q.id,
      number: q.number,
      date: q.issueDate,
      dueDate: q.expiryDate,
      status: q.status,
      total: q.total,
      href: `/quotes/${q.id}`,
    })),
  ].sort((a, b) => (a.date < b.date ? 1 : -1));

  const outstandingBalance = clientInvoices
    .filter((i) => i.status === "sent" || i.status === "overdue")
    .reduce((sum, i) => sum + (i.total - i.amountPaid), 0);
  const overdueCount = clientInvoices.filter((i) => i.status === "overdue").length;
  const unpaidCount = clientInvoices.filter((i) => i.status === "sent" || i.status === "overdue").length;

  return (
    <div className="p-4 sm:p-8 max-w-5xl mx-auto space-y-6">
      <div>
        <Link href="/clients" className="text-sm text-gray-500 hover:underline">
          ← Clients
        </Link>
        <h1 className="text-2xl font-bold mt-1">{client.name}</h1>
      </div>

      <div className="flex gap-6 border-b border-gray-200">
        <span className="pb-2 text-sm font-medium text-gray-900 border-b-2 border-gray-900">Activity</span>
        <Link href={`/clients/${id}/edit`} className="pb-2 text-sm font-medium text-gray-500 hover:text-gray-900">
          Info
        </Link>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <p className="text-sm text-gray-500 mb-1">Outstanding balance</p>
        <p className="text-2xl font-bold">
          {money(outstandingBalance, business.currency)}
          {unpaidCount > 0 && (
            <span className="text-sm font-normal text-gray-500 ml-2">
              {unpaidCount} unpaid{overdueCount > 0 ? ` (${overdueCount} overdue)` : ""}
            </span>
          )}
        </p>
        <a
          href={`/clients/${id}/statement`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block mt-3 text-sm font-medium text-gray-900 hover:underline"
        >
          Generate statement →
        </a>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg overflow-x-auto">
        {documents.length === 0 ? (
          <div className="p-8 text-center text-sm text-gray-500">
            No invoices or quotes for this client yet.{" "}
            <Link href="/invoices/new" className="text-gray-900 underline">
              Create one
            </Link>
          </div>
        ) : (
          <table className="w-full text-sm min-w-[640px]">
            <thead>
              <tr className="text-left text-gray-500 border-b border-gray-100">
                <th className="px-5 py-2 font-medium">Type</th>
                <th className="px-5 py-2 font-medium">Number</th>
                <th className="px-5 py-2 font-medium">Date</th>
                <th className="px-5 py-2 font-medium">Due</th>
                <th className="px-5 py-2 font-medium">Status</th>
                <th className="px-5 py-2 font-medium text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {documents.map((doc) => (
                <tr key={`${doc.type}-${doc.id}`} className="border-b border-gray-50 last:border-0 hover:bg-gray-50">
                  <td className="px-5 py-3 text-gray-600 capitalize">{doc.type}</td>
                  <td className="px-5 py-3">
                    <Link href={doc.href} className="font-medium hover:underline">
                      {doc.number}
                    </Link>
                  </td>
                  <td className="px-5 py-3 text-gray-600">{doc.date}</td>
                  <td className="px-5 py-3 text-gray-600">{doc.dueDate}</td>
                  <td className="px-5 py-3">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusBadge(doc.status)}`}>
                      {doc.status}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-right">{money(doc.total, business.currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
