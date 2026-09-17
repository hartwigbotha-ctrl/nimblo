"use client";

import { useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";

// Drop <SavedToast /> into any (app) page that a Server Action can redirect
// to right after a successful save — e.g. `redirect("/clients?saved=" +
// encodeURIComponent("Client added"))`. It fires one confirmation toast
// using that message, then strips the `saved` param from the URL so
// refreshing (or navigating back) doesn't show it again.
//
// This exists so every save gets the same visible confirmation, whether the
// form that triggered it is a plain <form action={...}> (no client JS
// running to show a toast itself) or an interactive action button (which
// already shows its own toast via sonner directly).
export function SavedToast() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const message = searchParams.get("saved");
    if (!message) return;

    toast.success(message);

    const params = new URLSearchParams(searchParams);
    params.delete("saved");
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  return null;
}
