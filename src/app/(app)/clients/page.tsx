import { requireBusiness } from "@/lib/session";
import { db } from "@/db";
import { clients } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import Link from "next/link";
import { DeleteClientButton } from "./delete-button";

function countExtras(value: string | null): number {
  if (!value) return 0;
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.length : 0;
  } catch {
    return 0;
  }
}

export default async function ClientsPage() {
  const { business } = await requireBusiness();
  const allClients = await db.query.clients.findMany({
    where: eq(clients.businessId, business.id),
    orderBy: desc(clients.createdAt),
  });

  return (
    <div className="p-4 sm:p-8 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold">Clients</h1>
        <Link
          href="/clients/new"
          className="bg-gray-900 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-gray-800"
        >
          + New client
        </Link>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg">
        {allClients.length === 0 ? (
          <div className="p-8 text-center text-sm text-gray-500">
            No clients yet.{" "}
            <Link href="/clients/new" className="text-gray-900 underline">
              Add your first client
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[640px]">
            <thead>
              <tr className="text-left text-gray-500 border-b border-gray-100">
                <th className="px-5 py-2 font-medium">Name</th>
                <th className="px-5 py-2 font-medium">Email</th>
                <th className="px-5 py-2 font-medium">Phone</th>
                <th className="px-5 py-2 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {allClients.map((c) => (
                <tr key={c.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50">
                  <td className="px-5 py-3">
                    <Link href={`/clients/${c.id}`} className="font-medium hover:underline">
                      {c.name}
                    </Link>
                  </td>
                  <td className="px-5 py-3 text-gray-600">
                    {c.email || "—"}
                    {countExtras(c.extraEmails) > 0 && (
                      <span className="ml-1 text-xs text-gray-400">+{countExtras(c.extraEmails)}</span>
                    )}
                  </td>
                  <td className="px-5 py-3 text-gray-600">
                    {c.phone || "—"}
                    {countExtras(c.extraPhones) > 0 && (
                      <span className="ml-1 text-xs text-gray-400">+{countExtras(c.extraPhones)}</span>
                    )}
                  </td>
                  <td className="px-5 py-3 text-right">
                    <DeleteClientButton clientId={c.id} />
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
