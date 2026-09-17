import { requireBusiness } from "@/lib/session";
import { redirect, notFound } from "next/navigation";
import { db } from "@/db";
import { businesses, clients, invoices, items } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { isAdminEmail } from "@/lib/admin";
import { adminCreateClient, adminCreateInvoice, adminSetPaidDate } from "@/lib/actions/admin";
import { ClientForm } from "../../clients/client-form";
import { InvoiceForm } from "../../invoices/invoice-form";
import { formatISO, addDays } from "date-fns";
import Link from "next/link";

/**
 * Admin-only "do it for them" page for a single business — lets an admin
 * (ADMIN_EMAIL) add a client and back-date invoices directly onto that
 * business's account, without needing the customer's login. Built for
 * cases like a customer emailing in old paper/PDF invoices and asking for
 * help getting them into Nimblo.
 */
export default async function AdminBusinessPage({ params }: { params: Promise<{ id: string }> }) {
  const { session } = await requireBusiness();
  if (!isAdminEmail(session.user?.email)) {
    redirect("/dashboard");
  }

  const { id } = await params;
  const business = await db.query.businesses.findFirst({ where: eq(businesses.id, id) });
  if (!business) notFound();

  const [allClients, allInvoices, savedItems] = await Promise.all([
    db.query.clients.findMany({ where: eq(clients.businessId, id), orderBy: desc(clients.createdAt) }),
    db.query.invoices.findMany({
      where: eq(invoices.businessId, id),
      orderBy: desc(invoices.issueDate),
      with: { client: true },
    }),
    db.query.items.findMany({ where: eq(items.businessId, id), orderBy: desc(items.createdAt) }),
  ]);

  const today = formatISO(new Date(), { representation: "date" });
  const defaultDue = formatISO(addDays(new Date(), business.paymentTermsDays), { representation: "date" });

  return (
    <div className="p-4 sm:p-8 max-w-5xl mx-auto space-y-8">
      <div>
        <Link href="/admin" className="text-sm text-gray-500 hover:underline">
          ← All businesses
        </Link>
        <h1 className="text-2xl font-bold mt-1">{business.name}</h1>
        <p className="text-sm text-gray-600 mt-1">
          Adding a client or invoice here writes straight onto {business.name}&apos;s account, as if they&apos;d
          entered it themselves — use this to backfill records for them.
        </p>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h2 className="font-semibold mb-3">Existing clients ({allClients.length})</h2>
        {allClients.length === 0 ? (
          <p className="text-sm text-gray-500 mb-4">No clients yet.</p>
        ) : (
          <ul className="text-sm text-gray-700 mb-4 space-y-1">
            {allClients.map((c) => (
              <li key={c.id}>
                {c.name} {c.email && <span className="text-gray-400">— {c.email}</span>}
              </li>
            ))}
          </ul>
        )}
        <details className="mt-2">
          <summary className="text-sm font-medium cursor-pointer text-gray-900">+ Add a client</summary>
          <div className="mt-4">
            <ClientForm action={adminCreateClient.bind(null, id)} />
          </div>
        </details>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h2 className="font-semibold mb-3">Existing invoices ({allInvoices.length})</h2>
        {allInvoices.length === 0 ? (
          <p className="text-sm text-gray-500 mb-4">No invoices yet.</p>
        ) : (
          <ul className="text-sm text-gray-700 mb-4 space-y-2">
            {allInvoices.map((inv) => (
              <li key={inv.id} className="flex flex-wrap items-center gap-2">
                <span>
                  {inv.number} — {inv.client?.name ?? "Unknown client"} — {business.currency}{" "}
                  {inv.total.toFixed(2)} — {inv.status} — {inv.issueDate}
                  {inv.status === "paid" && (
                    <span className="text-gray-400"> — paid {inv.paidAt?.slice(0, 10) ?? "—"}</span>
                  )}
                </span>
                {inv.status === "paid" && (
                  <form
                    action={adminSetPaidDate.bind(null, id, inv.id)}
                    className="flex items-center gap-1"
                  >
                    <input
                      name="paidAt"
                      type="date"
                      defaultValue={inv.paidAt?.slice(0, 10) || inv.dueDate}
                      className="rounded-md border border-gray-300 px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-gray-900"
                    />
                    <button
                      type="submit"
                      className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded-md hover:bg-gray-200"
                    >
                      Fix paid date
                    </button>
                  </form>
                )}
              </li>
            ))}
          </ul>
        )}

        {allClients.length === 0 ? (
          <p className="text-sm text-gray-500">Add a client above first before creating an invoice.</p>
        ) : (
          <details className="mt-2">
            <summary className="text-sm font-medium cursor-pointer text-gray-900">+ Add an invoice</summary>
            <div className="mt-4">
              <InvoiceForm
                action={adminCreateInvoice.bind(null, id)}
                allClients={allClients}
                savedItems={savedItems}
                submitLabel="Create invoice"
                showStatus
                showNumberField
                defaultValues={{
                  taxRate: business.defaultTaxRate,
                  issueDate: today,
                  dueDate: defaultDue,
                  status: "sent",
                }}
              />
            </div>
          </details>
        )}
      </div>
    </div>
  );
}
