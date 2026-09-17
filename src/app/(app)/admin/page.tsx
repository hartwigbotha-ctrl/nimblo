import { requireBusiness } from "@/lib/session";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { businesses, subscriptions } from "@/db/schema";
import { desc } from "drizzle-orm";
import { isAdminEmail } from "@/lib/admin";
import { DeleteBusinessButton } from "./delete-business-button";
import Link from "next/link";

/**
 * Admin-only, cross-tenant view — restricted by email (ADMIN_EMAIL env var,
 * comma-separated), not by any in-app role, since there's no platform-admin
 * concept yet. Deliberately exempted from the subscription paywall in
 * proxy.ts (an admin's own test business may not have an active
 * subscription) but still requires being logged in.
 *
 * Exists to answer one question: "how would I know if someone got access
 * without paying?" — lists every business with its subscription status and
 * flags any that has real data (clients/invoices) but isn't "active". That
 * combination should never happen after the 2026-09-04 paywall fix
 * (src/proxy.ts) — if it ever shows up here, something's broken again.
 */
export default async function AdminPage() {
  const { session } = await requireBusiness();

  if (!isAdminEmail(session.user?.email)) {
    redirect("/dashboard");
  }

  const allBusinesses = await db.query.businesses.findMany({
    orderBy: desc(businesses.createdAt),
    with: {
      subscriptions: { orderBy: desc(subscriptions.createdAt), with: { plan: true } },
      clients: { columns: { id: true } },
      invoices: { columns: { id: true } },
    },
  });

  const rows = allBusinesses.map((b) => {
    const subscription = b.subscriptions[0] ?? null;
    const hasData = b.clients.length > 0 || b.invoices.length > 0;
    const isActive = subscription?.status === "active";
    const flagged = hasData && !isActive;
    return {
      id: b.id,
      name: b.name,
      email: b.email,
      createdAt: b.createdAt,
      clientCount: b.clients.length,
      invoiceCount: b.invoices.length,
      planName: subscription?.plan?.name ?? null,
      status: subscription?.status ?? "no subscription",
      flagged,
      isActive: subscription?.status === "active",
    };
  });

  // Flagged businesses first — that's the whole point of this page.
  rows.sort((a, b) => Number(b.flagged) - Number(a.flagged));

  const flaggedCount = rows.filter((r) => r.flagged).length;

  return (
    <div className="p-4 sm:p-8 max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Admin — all businesses</h1>
        <p className="text-sm text-gray-600 mt-1">
          {flaggedCount === 0
            ? "No businesses have data without an active subscription. That's the expected state."
            : `${flaggedCount} business${flaggedCount === 1 ? "" : "es"} have data but no active subscription — see flagged rows below.`}
        </p>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 text-left text-gray-500">
              <th className="p-3 font-medium">Business</th>
              <th className="p-3 font-medium">Email</th>
              <th className="p-3 font-medium">Status</th>
              <th className="p-3 font-medium">Plan</th>
              <th className="p-3 font-medium">Clients</th>
              <th className="p-3 font-medium">Invoices</th>
              <th className="p-3 font-medium">Signed up</th>
              <th className="p-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr
                key={r.id}
                className={`border-b border-gray-100 last:border-0 ${r.flagged ? "bg-red-50" : ""}`}
              >
                <td className="p-3 font-medium">
                  {r.flagged && <span className="text-red-600 mr-1">⚠</span>}
                  <Link href={`/admin/${r.id}`} className="hover:underline">
                    {r.name}
                  </Link>
                </td>
                <td className="p-3 text-gray-600">{r.email}</td>
                <td className="p-3">
                  <span
                    className={`px-2 py-1 rounded-full text-xs font-medium ${
                      r.status === "active"
                        ? "bg-green-100 text-green-700"
                        : r.status === "past_due"
                        ? "bg-amber-100 text-amber-700"
                        : "bg-gray-100 text-gray-600"
                    }`}
                  >
                    {r.status}
                  </span>
                </td>
                <td className="p-3 text-gray-600">{r.planName ?? "—"}</td>
                <td className="p-3 text-gray-600">{r.clientCount}</td>
                <td className="p-3 text-gray-600">{r.invoiceCount}</td>
                <td className="p-3 text-gray-600">{new Date(r.createdAt).toLocaleDateString("en-ZA")}</td>
                <td className="p-3">
                  <DeleteBusinessButton businessId={r.id} businessName={r.name} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
