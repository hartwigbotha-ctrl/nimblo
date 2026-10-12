import { requireBusiness } from "@/lib/session";

// These routes are all per-user/session data behind auth — never attempt a
// build-time static shell for them (Next.js may otherwise render this
// layout once at build time with no session, bake in the resulting
// redirect("/login") as a cached "static shell", and later serve that
// stale redirect to real, authenticated users via prefetching).
export const dynamic = "force-dynamic";
import { signOut } from "@/lib/auth";
import { AppShell } from "./app-shell";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { subscriptions } from "@/db/schema";
import { eq, desc } from "drizzle-orm";

// Routes that stay reachable even without an active subscription — a
// business that hasn't paid (or whose card failed) still needs to be able
// to pay us and to ask for help, just not to use the product itself.
// "/admin" is included to match proxy.ts's own exemption (an admin's own
// test business may not have an active subscription) — these two lists had
// drifted apart, which is exactly what locked an admin out of /admin here
// even though proxy.ts let the request through.
const BILLING_EXEMPT_PREFIXES = ["/billing", "/support", "/admin"];

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { business, session } = await requireBusiness();

  const pathname = (await headers()).get("x-pathname") || "";
  const isExempt = BILLING_EXEMPT_PREFIXES.some((p) => pathname.startsWith(p));

  if (!isExempt) {
    const subscription = await db.query.subscriptions.findFirst({
      where: eq(subscriptions.businessId, business.id),
      orderBy: desc(subscriptions.createdAt),
    });
    // No trial: a business only gets into the app with a subscription row
    // whose status is "active" (confirmed by a PayFast ITN) — anything
    // else (no row yet, incomplete checkout, past_due, canceled) sends
    // them to pick/pay for a plan instead.
    if (!subscription || subscription.status !== "active") {
      redirect("/billing/subscribe");
    }
  }

  async function signOutAction() {
    "use server";
    await signOut({ redirectTo: "/login" });
  }

  // Same email-allowlist check as src/app/(app)/admin/page.tsx — only used
  // here to decide whether to show the "Admin" nav link at all; the admin
  // page re-checks this itself, so this is just UX (no security relies on
  // this list not showing the link).
  const adminEmails = (process.env.ADMIN_EMAIL || "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  const isAdmin = adminEmails.includes((session.user?.email ?? "").toLowerCase());

  return (
    <AppShell
      businessName={business.name}
      userEmail={session.user?.email}
      signOutAction={signOutAction}
      isAdmin={isAdmin}
    >
      {children}
    </AppShell>
  );
}
