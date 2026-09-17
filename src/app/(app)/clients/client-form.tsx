"use client";

import { useState } from "react";
import { Plus, X } from "lucide-react";
import type { clients } from "@/db/schema";

type Client = typeof clients.$inferSelect;

const PAYMENT_TERMS_OPTIONS = [
  { label: "None (use business default)", value: "" },
  { label: "Due on receipt", value: "0" },
  { label: "Net 7", value: "7" },
  { label: "Net 14", value: "14" },
  { label: "Net 30", value: "30" },
  { label: "Net 60", value: "60" },
];

function parseExtraList(value: string | null | undefined): string[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((v) => typeof v === "string") : [];
  } catch {
    return [];
  }
}

export function ClientForm({
  action,
  client,
}: {
  action: (formData: FormData) => void;
  client?: Client;
}) {
  return (
    <form action={action} className="space-y-4 max-w-lg">
      <Field name="name" label="Client name" placeholder="Enter a name…" defaultValue={client?.name} required />

      <RepeatableField
        name="email"
        label="Email"
        type="email"
        placeholder="Enter an email address…"
        addLabel="Add another email"
        defaultValues={[client?.email ?? "", ...parseExtraList(client?.extraEmails)]}
      />

      <Field
        name="address"
        label="Billing address"
        placeholder="Enter a billing address…"
        defaultValue={client?.address ?? ""}
        textarea
      />
      <Field
        name="contactName"
        label="Contact name"
        placeholder="Enter contact information…"
        defaultValue={client?.contactName ?? ""}
      />

      <RepeatableField
        name="phone"
        label="Phone"
        type="tel"
        placeholder="Enter a phone number…"
        addLabel="Add another phone number"
        defaultValues={[client?.phone ?? "", ...parseExtraList(client?.extraPhones)]}
      />

      <Field
        name="mobile"
        label="Mobile"
        placeholder="Enter a mobile number…"
        defaultValue={client?.mobile ?? ""}
      />
      <Field name="website" label="Website" placeholder="Enter a URL…" defaultValue={client?.website ?? ""} />
      <Field
        name="vatNumber"
        label="Tax number"
        placeholder="Enter a tax registration number…"
        defaultValue={client?.vatNumber ?? ""}
      />

      <div>
        <label htmlFor="customPaymentTermsDays" className="block text-sm font-medium text-gray-700 mb-1">
          Custom payment terms
        </label>
        <select
          id="customPaymentTermsDays"
          name="customPaymentTermsDays"
          defaultValue={
            client?.customPaymentTermsDays !== null && client?.customPaymentTermsDays !== undefined
              ? String(client.customPaymentTermsDays)
              : ""
          }
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
        >
          {PAYMENT_TERMS_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      <Field
        name="notes"
        label="Notes"
        placeholder="Enter a private note about this client…"
        defaultValue={client?.notes ?? ""}
        textarea
      />

      <button
        type="submit"
        className="bg-gray-900 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-gray-800"
      >
        {client ? "Save changes" : "Add client"}
      </button>
    </form>
  );
}

function Field({
  name,
  label,
  type = "text",
  placeholder,
  defaultValue,
  required,
  textarea,
}: {
  name: string;
  label: string;
  type?: string;
  placeholder?: string;
  defaultValue?: string;
  required?: boolean;
  textarea?: boolean;
}) {
  return (
    <div>
      <label htmlFor={name} className="block text-sm font-medium text-gray-700 mb-1">
        {label}
      </label>
      {textarea ? (
        <textarea
          id={name}
          name={name}
          rows={2}
          placeholder={placeholder}
          defaultValue={defaultValue}
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
        />
      ) : (
        <input
          id={name}
          name={name}
          type={type}
          placeholder={placeholder}
          defaultValue={defaultValue}
          required={required}
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
        />
      )}
    </div>
  );
}

// Renders a primary input plus any number of extra rows for the same field
// name, so the form submits several values under one FormData key
// (formData.getAll(name) on the server). The first non-blank entry becomes
// the client's primary email/phone; the rest are stored as extras.
let rowIdCounter = 0;
function nextRowId() {
  rowIdCounter += 1;
  return rowIdCounter;
}

function RepeatableField({
  name,
  label,
  type = "text",
  placeholder,
  addLabel,
  defaultValues,
}: {
  name: string;
  label: string;
  type?: string;
  placeholder?: string;
  addLabel: string;
  defaultValues: string[];
}) {
  const initial = defaultValues.filter((v) => v.trim() !== "");
  const [rows, setRows] = useState<{ id: number; value: string }[]>(() =>
    (initial.length ? initial : [""]).map((value) => ({ id: nextRowId(), value }))
  );

  function addRow() {
    setRows((prev) => [...prev, { id: nextRowId(), value: "" }]);
  }

  function removeRow(id: number) {
    setRows((prev) => (prev.length > 1 ? prev.filter((r) => r.id !== id) : prev));
  }

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <div className="space-y-2">
        {rows.map((row, i) => (
          <div key={row.id} className="flex items-center gap-2">
            <input
              name={name}
              type={type}
              placeholder={i === 0 ? placeholder : `Another ${label.toLowerCase()}…`}
              defaultValue={row.value}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
            />
            {rows.length > 1 && (
              <button
                type="button"
                onClick={() => removeRow(row.id)}
                aria-label={`Remove ${label.toLowerCase()}`}
                className="shrink-0 p-1.5 text-gray-400 hover:text-red-600"
              >
                <X size={16} />
              </button>
            )}
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={addRow}
        className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-gray-600 hover:text-gray-900"
      >
        <Plus size={14} />
        {addLabel}
      </button>
    </div>
  );
}
