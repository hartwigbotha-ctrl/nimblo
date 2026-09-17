import { requireBusiness } from "@/lib/session";
import { db } from "@/db";
import { items } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import Link from "next/link";
import { Suspense } from "react";
import { DeleteItemButton } from "./delete-button";
import { SavedToast } from "../saved-toast";

function money(amount: number, currency: string) {
  try {
    return new Intl.NumberFormat("en-ZA", { style: "currency", currency }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
}

export default async function ItemsPage() {
  const { business } = await requireBusiness();
  const allItems = await db.query.items.findMany({
    where: eq(items.businessId, business.id),
    orderBy: desc(items.createdAt),
  });

  return (
    <div className="p-4 sm:p-8 max-w-5xl mx-auto">
      <Suspense fallback={null}>
        <SavedToast />
      </Suspense>
      <div className="flex items-center justify-between mb-2">
        <h1 className="text-2xl font-bold">Items</h1>
        <Link
          href="/items/new"
          className="bg-gray-900 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-gray-800"
        >
          + Add item
        </Link>
      </div>
      <p className="text-sm text-gray-600 mb-8">
        Save products or services you bill often so you can add them to an invoice in one click
        instead of retyping them every time.
      </p>

      <div className="bg-white border border-gray-200 rounded-lg">
        {allItems.length === 0 ? (
          <div className="p-8 text-center text-sm text-gray-500">
            No saved items yet.{" "}
            <Link href="/items/new" className="text-gray-900 underline">
              Add your first item
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[640px]">
            <thead>
              <tr className="text-left text-gray-500 border-b border-gray-100">
                <th className="px-5 py-2 font-medium">Code</th>
                <th className="px-5 py-2 font-medium">Name</th>
                <th className="px-5 py-2 font-medium">Unit type</th>
                <th className="px-5 py-2 font-medium text-right">Rate</th>
                <th className="px-5 py-2 font-medium text-right">Cost</th>
                <th className="px-5 py-2 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {allItems.map((it) => (
                <tr key={it.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50">
                  <td className="px-5 py-3 text-gray-600">{it.code || "—"}</td>
                  <td className="px-5 py-3">
                    <Link href={`/items/${it.id}`} className="font-medium hover:underline">
                      {it.name}
                    </Link>
                    {it.description && (
                      <p className="text-xs text-gray-500 mt-0.5 max-w-xs truncate">{it.description}</p>
                    )}
                  </td>
                  <td className="px-5 py-3 text-gray-600">{it.unitType || "None"}</td>
                  <td className="px-5 py-3 text-right">{money(it.defaultPrice, business.currency)}</td>
                  <td className="px-5 py-3 text-right text-gray-600">{money(it.cost, business.currency)}</td>
                  <td className="px-5 py-3 text-right">
                    <DeleteItemButton itemId={it.id} />
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
