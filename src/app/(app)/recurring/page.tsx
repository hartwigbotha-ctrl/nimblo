import { requireBusiness } from "@/lib/session";
import { db } from "@/db";
import { recurringSchedules } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import Link from "next/link";
import { Suspense } from "react";
import { ScheduleActions } from "./schedule-actions";
import { SavedToast } from "../saved-toast";

export default async function RecurringPage() {
  const { business } = await requireBusiness();
  const schedules = await db.query.recurringSchedules.findMany({
    where: eq(recurringSchedules.businessId, business.id),
    with: { client: true },
    orderBy: desc(recurringSchedules.createdAt),
  });

  return (
    <div className="p-4 sm:p-8 max-w-5xl mx-auto">
      <Suspense fallback={null}>
        <SavedToast />
      </Suspense>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold">Recurring invoices</h1>
          <p className="text-sm text-gray-600 mt-1">
            Auto-generate and send invoices on a schedule — no manual work each month.
          </p>
        </div>
        <Link
          href="/recurring/new"
          className="bg-gray-900 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-gray-800"
        >
          + New schedule
        </Link>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg">
        {schedules.length === 0 ? (
          <div className="p-8 text-center text-sm text-gray-500">
            No recurring schedules yet.{" "}
            <Link href="/recurring/new" className="text-gray-900 underline">
              Set one up
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[640px]">
            <thead>
              <tr className="text-left text-gray-500 border-b border-gray-100">
                <th className="px-5 py-2 font-medium">Title</th>
                <th className="px-5 py-2 font-medium">Client</th>
                <th className="px-5 py-2 font-medium">Frequency</th>
                <th className="px-5 py-2 font-medium">Next run</th>
                <th className="px-5 py-2 font-medium">Auto-send</th>
                <th className="px-5 py-2 font-medium">Status</th>
                <th className="px-5 py-2 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {schedules.map((s) => (
                <tr key={s.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50">
                  <td className="px-5 py-3 font-medium">{s.title}</td>
                  <td className="px-5 py-3 text-gray-600">{s.client.name}</td>
                  <td className="px-5 py-3 text-gray-600 capitalize">
                    {s.intervalCount > 1 ? `Every ${s.intervalCount} ${s.frequency}` : s.frequency}
                  </td>
                  <td className="px-5 py-3 text-gray-600">{s.nextRunDate}</td>
                  <td className="px-5 py-3 text-gray-600">{s.autoSend ? "Yes" : "No (draft only)"}</td>
                  <td className="px-5 py-3">
                    <span
                      className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        s.active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"
                      }`}
                    >
                      {s.active ? "Active" : "Paused"}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-right">
                    <ScheduleActions scheduleId={s.id} active={s.active} />
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
