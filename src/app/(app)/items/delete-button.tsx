"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { deleteItem } from "@/lib/actions/items";

export function DeleteItemButton({ itemId }: { itemId: string }) {
  const [pending, startTransition] = useTransition();

  return (
    <button
      disabled={pending}
      onClick={() => {
        if (confirm("Delete this item? This cannot be undone.")) {
          startTransition(async () => {
            await deleteItem(itemId);
            toast.success("Item deleted");
          });
        }
      }}
      className="text-xs text-red-600 hover:underline disabled:opacity-50"
    >
      {pending ? "Deleting…" : "Delete"}
    </button>
  );
}
