"use client";

import { LineItemsEditor, type SavedItem, type Row } from "../line-items-editor";

type ClientOption = { id: string; name: string };

export function InvoiceForm({
  action,
  allClients,
  savedItems,
  submitLabel,
  defaultValues,
  showStatus,
  showNumberField,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  action: any;
  allClients: ClientOption[];
  savedItems: SavedItem[];
  submitLabel: string;
  defaultValues: {
    clientId?: string;
    taxRate: number;
    issueDate: string;
    dueDate: string;
    notes?: string | null;
    lineItems?: Row[];
    status?: string;
  };
  /** Only shown on the edit form — a new invoice always starts as a draft. */
  showStatus?: boolean;
  /**
   * Admin-only: lets the invoice number be typed instead of auto-assigned —
   * used when backfilling a customer's historical invoices so the number
   * can match their old records. Never shown on the normal customer-facing
   * create form, which always auto-numbers to avoid gaps/duplicates.
   */
  showNumberField?: boolean;
}) {
  return (
    <form action={action} className="bg-white border border-gray-200 rounded-lg p-6 space-y-6">
      <div className="grid sm:grid-cols-2 gap-4">
        {showNumberField && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Invoice number</label>
            <input
              name="number"
              placeholder="Leave blank to auto-assign"
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
            />
            <p className="text-xs text-gray-500 mt-1">
              To match an old record, e.g. &quot;INV002&quot;. Leave blank to use the next auto number.
            </p>
          </div>
        )}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Client</label>
          <select
            name="clientId"
            required
            defaultValue={defaultValues.clientId}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
          >
            {allClients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">VAT rate (%)</label>
          <input
            name="taxRate"
            type="number"
            step="any"
            min={0}
            defaultValue={defaultValues.taxRate}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Issue date</label>
          <input
            name="issueDate"
            type="date"
            defaultValue={defaultValues.issueDate}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Due date</label>
          <input
            name="dueDate"
            type="date"
            defaultValue={defaultValues.dueDate}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
          />
        </div>
        {showStatus && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
            <select
              name="status"
              defaultValue={defaultValues.status || "draft"}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
            >
              <option value="draft">Draft</option>
              <option value="sent">Sent</option>
              <option value="paid">Paid</option>
              <option value="overdue">Overdue</option>
              <option value="cancelled">Cancelled</option>
            </select>
            <p className="text-xs text-gray-500 mt-1">
              Fix a mistaken status here — e.g. undo an accidental &quot;Paid&quot;.
            </p>
          </div>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Line items</label>
        <LineItemsEditor savedItems={savedItems} initialRows={defaultValues.lineItems} />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
        <textarea
          name="notes"
          rows={2}
          defaultValue={defaultValues.notes || ""}
          placeholder="Optional notes for the client"
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
        />
      </div>

      <button
        type="submit"
        className="bg-gray-900 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-gray-800"
      >
        {submitLabel}
      </button>
    </form>
  );
}
