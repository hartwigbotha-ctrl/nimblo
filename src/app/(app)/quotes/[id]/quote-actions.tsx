"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import {
  sendQuote,
  deleteQuote,
  markQuoteResponded,
  convertQuoteToInvoice,
} from "@/lib/actions/quotes";
import { PdfPreviewButton } from "../../pdf-preview-button";
import { buildPdfFilename } from "@/lib/pdf-filename";

export function QuoteActions({
  quoteId,
  quoteNumber,
  status,
  hasClientEmail,
  alreadyConverted,
  businessName,
}: {
  quoteId: string;
  quoteNumber: string;
  status: string;
  hasClientEmail: boolean;
  alreadyConverted: boolean;
  businessName: string;
}) {
  const [pending, startTransition] = useTransition();
  const [sendError, setSendError] = useState<string | null>(null);
  const router = useRouter();

  return (
    <div>
      <div className="flex flex-wrap gap-2">
      <PdfPreviewButton
        href={`/quotes/${quoteId}/pdf`}
        filename={buildPdfFilename(businessName, quoteNumber)}
        label="Preview"
      />

      <Link
        href={`/quotes/${quoteId}/edit`}
        className="px-3 py-1.5 rounded-md text-sm border border-gray-300 hover:bg-gray-100"
      >
        Edit
      </Link>

      {status !== "accepted" && status !== "declined" && (
        <button
          disabled={pending || !hasClientEmail}
          title={!hasClientEmail ? "Client has no email on file" : undefined}
          onClick={() =>
            startTransition(async () => {
              setSendError(null);
              const result = await sendQuote(quoteId);
              if (!result.ok) {
                setSendError(result.error);
                toast.error(result.error || "Couldn't send the quote.");
                return;
              }
              toast.success(
                status === "draft" ? `Quote ${quoteNumber} sent` : `Quote ${quoteNumber} resent`
              );
              router.refresh();
            })
          }
          className="px-3 py-1.5 rounded-md text-sm border border-gray-300 hover:bg-gray-100 disabled:opacity-50"
        >
          {status === "draft" ? "Send quote" : "Resend quote"}
        </button>
      )}

      {status === "sent" && (
        <>
          <button
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                await markQuoteResponded(quoteId, true);
                toast.success(`Quote ${quoteNumber} marked accepted`);
                router.refresh();
              })
            }
            className="px-3 py-1.5 rounded-md text-sm bg-green-600 text-white hover:bg-green-700 disabled:opacity-50"
          >
            Mark accepted
          </button>
          <button
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                await markQuoteResponded(quoteId, false);
                toast.success(`Quote ${quoteNumber} marked declined`);
                router.refresh();
              })
            }
            className="px-3 py-1.5 rounded-md text-sm border border-gray-300 text-gray-700 hover:bg-gray-100 disabled:opacity-50"
          >
            Mark declined
          </button>
        </>
      )}

      {!alreadyConverted && (
        <button
          disabled={pending}
          onClick={() => {
            if (confirm(`Create a draft invoice from ${quoteNumber}?`)) {
              toast.success(`Draft invoice created from ${quoteNumber}`);
              startTransition(() => convertQuoteToInvoice(quoteId));
            }
          }}
          className="px-3 py-1.5 rounded-md text-sm bg-gray-900 text-white hover:bg-gray-800 disabled:opacity-50"
        >
          Convert to invoice
        </button>
      )}

      <button
        disabled={pending}
        onClick={() => {
          if (confirm("Delete this quote? This cannot be undone.")) {
            toast.success(`Quote ${quoteNumber} deleted`);
            startTransition(() => deleteQuote(quoteId));
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
