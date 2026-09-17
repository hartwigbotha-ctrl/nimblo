"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { deleteClient } from "@/lib/actions/clients";

export function DeleteClientButton({ clientId }: { clientId: string }) {
  const [pending, startTransition] = useTransition();

  return (
    <button
      disabled={pending}
      onClick={() => {
        if (confirm("Delete this client? This cannot be undone.")) {
          startTransition(async () => {
            await deleteClient(clientId);
            toast.success("Client deleted");
          });
        }
      }}
      className="text-xs text-red-600 hover:underline disabled:opacity-50"
    >
      {pending ? "Deleting…" : "Delete"}
    </button>
  );
}
