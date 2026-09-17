"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";

export type Row = { description: string; quantity: string; unitPrice: string };
export type SavedItem = {
  id: string;
  code: string | null;
  name: string;
  description?: string | null;
  defaultPrice: number;
};

export function LineItemsEditor({
  initialRows,
  savedItems,
}: {
  initialRows?: Row[];
  savedItems?: SavedItem[];
}) {
  const [rows, setRows] = useState<Row[]>(
    initialRows && initialRows.length > 0
      ? initialRows
      : [{ description: "", quantity: "1", unitPrice: "" }]
  );

  const subtotal = rows.reduce(
    (sum, r) => sum + (Number(r.quantity) || 0) * (Number(r.unitPrice) || 0),
    0
  );

  function updateRow(i: number, patch: Partial<Row>) {
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  }

  function addRow() {
    setRows((prev) => [...prev, { description: "", quantity: "1", unitPrice: "" }]);
  }

  function addFromCatalog(itemId: string) {
    const item = savedItems?.find((it) => it.id === itemId);
    if (!item) return;
    // Combine the item's name and description so the line item reads clearly
    // on its own (e.g. "TEMBISA — CONSULTANCY FEE"), not just the description
    // on its own with no indication of what it's for.
    const label = item.description?.trim() ? `${item.name} — ${item.description}` : item.name;
    setRows((prev) => {
      // If the only row is still empty, fill it instead of appending a new one.
      if (prev.length === 1 && !prev[0].description && !prev[0].unitPrice) {
        return [{ description: label, quantity: "1", unitPrice: String(item.defaultPrice) }];
      }
      return [...prev, { description: label, quantity: "1", unitPrice: String(item.defaultPrice) }];
    });
    toast.success(`Added "${label}" to line items`);
  }

  function removeRow(i: number) {
    setRows((prev) => (prev.length > 1 ? prev.filter((_, idx) => idx !== i) : prev));
  }

  return (
    <div>
      {savedItems && savedItems.length > 0 && (
        <div className="mb-3 flex items-center gap-2">
          <select
            defaultValue=""
            onChange={(e) => {
              if (e.target.value) addFromCatalog(e.target.value);
              e.target.value = "";
            }}
            className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
          >
            <option value="" disabled>
              + Add from saved items…
            </option>
            {savedItems.map((it) => (
              <option key={it.id} value={it.id}>
                {it.code ? `${it.code} — ` : ""}
                {it.name}
              </option>
            ))}
          </select>
          <Link href="/items/new" className="text-xs text-gray-500 hover:text-gray-900 underline">
            Manage items
          </Link>
        </div>
      )}
      {(!savedItems || savedItems.length === 0) && (
        <p className="mb-3 text-xs text-gray-500">
          <Link href="/items/new" className="underline hover:text-gray-900">
            Save items or services
          </Link>{" "}
          you bill often to add them here in one click.
        </p>
      )}

      <div className="grid grid-cols-[1fr_80px_120px_120px_32px] gap-2 mb-2 text-xs font-medium text-gray-500 px-1">
        <span>Description</span>
        <span>Qty</span>
        <span>Unit price</span>
        <span className="text-right">Amount</span>
        <span />
      </div>
      <div className="space-y-2">
        {rows.map((row, i) => (
          <div key={i} className="grid grid-cols-[1fr_80px_120px_120px_32px] gap-2 items-center">
            <input
              name="li_description"
              value={row.description}
              onChange={(e) => updateRow(i, { description: e.target.value })}
              placeholder="Consulting services"
              className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
            />
            <input
              name="li_quantity"
              type="number"
              step="any"
              min="0"
              value={row.quantity}
              onChange={(e) => updateRow(i, { quantity: e.target.value })}
              className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
            />
            <input
              name="li_unitPrice"
              type="number"
              step="any"
              min="0"
              value={row.unitPrice}
              onChange={(e) => updateRow(i, { unitPrice: e.target.value })}
              className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
            />
            <span className="text-sm text-right text-gray-600">
              {((Number(row.quantity) || 0) * (Number(row.unitPrice) || 0)).toFixed(2)}
            </span>
            <button
              type="button"
              onClick={() => removeRow(i)}
              className="text-gray-400 hover:text-red-600"
              aria-label="Remove line"
            >
              <Trash2 size={16} />
            </button>
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={addRow}
        className="mt-3 flex items-center gap-1 text-sm text-gray-700 hover:text-gray-900"
      >
        <Plus size={14} /> Add line
      </button>
      <div className="mt-4 flex justify-end text-sm">
        <span className="text-gray-500 mr-2">Subtotal:</span>
        <span className="font-medium">{subtotal.toFixed(2)}</span>
      </div>
    </div>
  );
}
