"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { deleteInvoice } from "@/lib/actions/invoices";
import { PdfPreviewButton } from "../pdf-preview-button";
import { buildPdfFilename } from "@/lib/pdf-filename";

export function InvoiceRowActions({
  invoiceId,
  invoiceNumber,
  businessName,
}: {
  invoiceId: string;
  invoiceNumber: string;
  businessName: string;
}) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  return (
    <div className="flex items-center justify-end gap-1">
      <PdfPreviewButton
        href={`/invoices/${invoiceId}/pdf`}
        filename={buildPdfFilename(businessName, invoiceNumber)}
        label="Preview"
        className="px-2 py-1 rounded text-xs text-gray-600 hover:bg-gray-100"
      />
      <Link
        href={`/invoices/${invoiceId}/edit`}
        className="px-2 py-1 rounded text-xs text-gray-600 hover:bg-gray-100"
      >
        Edit
      </Link>
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          if (confirm(`Delete invoice ${invoiceNumber}? This cannot be undone.`)) {
            toast.success(`Invoice ${invoiceNumber} deleted`);
            startTransition(async () => {
              await deleteInvoice(invoiceId);
              router.refresh();
            });
          }
        }}
        className="px-2 py-1 rounded text-xs text-red-600 hover:bg-red-50 disabled:opacity-50"
      >
        Delete
      </button>
    </div>
  );
}
