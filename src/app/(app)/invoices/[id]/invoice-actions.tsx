"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { sendInvoice, deleteInvoice, markInvoicePaid } from "@/lib/actions/invoices";
import { PdfPreviewButton } from "../../pdf-preview-button";
import { buildPdfFilename } from "@/lib/pdf-filename";

export function InvoiceActions({
  invoiceId,
  invoiceNumber,
  status,
  hasClientEmail,
  businessName,
}: {
  invoiceId: string;
  invoiceNumber: string;
  status: string;
  hasClientEmail: boolean;
  businessName: string;
}) {
  const [pending, startTransition] = useTransition();
  const [sendError, setSendError] = useState<string | null>(null);
  const router = useRouter();

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        <PdfPreviewButton
          href={`/invoices/${invoiceId}/pdf`}
          filename={buildPdfFilename(businessName, invoiceNumber)}
          label="Preview"
        />

        <Link
          href={`/invoices/${invoiceId}/edit`}
          className="px-3 py-1.5 rounded-md text-sm border border-gray-300 hover:bg-gray-100"
        >
          Edit
        </Link>

        {status !== "paid" && status !== "cancelled" && (
          <button
            disabled={pending || !hasClientEmail}
            title={!hasClientEmail ? "Client has no email on file" : undefined}
            onClick={() =>
              startTransition(async () => {
                setSendError(null);
                const result = await sendInvoice(invoiceId);
                if (!result.ok) {
                  setSendError(result.error);
                  toast.error(result.error || "Couldn't send the invoice.");
                  return;
                }
                toast.success(
                  status === "draft"
                    ? `Invoice ${invoiceNumber} sent`
                    : `Invoice ${invoiceNumber} resent`
                );
                router.refresh();
              })
            }
            className="px-3 py-1.5 rounded-md text-sm border border-gray-300 hover:bg-gray-100 disabled:opacity-50"
          >
            {status === "draft" ? "Send invoice" : "Resend invoice"}
          </button>
        )}

        {status !== "paid" && status !== "cancelled" && (
          <button
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                await markInvoicePaid(invoiceId);
                toast.success(`Invoice ${invoiceNumber} marked as paid`);
                router.refresh();
              })
            }
            className="px-3 py-1.5 rounded-md text-sm bg-green-600 text-white hover:bg-green-700 disabled:opacity-50"
          >
            Mark as paid
          </button>
        )}

        <button
          disabled={pending}
          onClick={() => {
            if (confirm("Delete this invoice? This cannot be undone.")) {
              toast.success(`Invoice ${invoiceNumber} deleted`);
              startTransition(() => deleteInvoice(invoiceId));
            }
          }}
          className="px-3 py-1.5 rounded-md text-sm text-red-600 border border-red-200 hover:bg-red-50 disabled:opacity-50"
        >
          Delete
        </button>
      </div>

      {sendError && (
        <p className="mt-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2 max-w-xl">
          {sendError}
        </p>
      )}
    </div>
  );
}
