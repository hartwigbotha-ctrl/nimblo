"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { deleteQuote } from "@/lib/actions/quotes";
import { PdfPreviewButton } from "../pdf-preview-button";
import { buildPdfFilename } from "@/lib/pdf-filename";

export function QuoteRowActions({
  quoteId,
  quoteNumber,
  businessName,
}: {
  quoteId: string;
  quoteNumber: string;
  businessName: string;
}) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  return (
    <div className="flex items-center justify-end gap-1">
      <PdfPreviewButton
        href={`/quotes/${quoteId}/pdf`}
        filename={buildPdfFilename(businessName, quoteNumber)}
        label="Preview"
        className="px-2 py-1 rounded text-xs text-gray-600 hover:bg-gray-100"
      />
      <Link
        href={`/quotes/${quoteId}/edit`}
        className="px-2 py-1 rounded text-xs text-gray-600 hover:bg-gray-100"
      >
        Edit
      </Link>
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          if (confirm(`Delete quote ${quoteNumber}? This cannot be undone.`)) {
            toast.success(`Quote ${quoteNumber} deleted`);
            startTransition(async () => {
              await deleteQuote(quoteId);
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
