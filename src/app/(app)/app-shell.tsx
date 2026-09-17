"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  FileText,
  FileSignature,
  Repeat,
  Package,
  Settings,
  Menu,
  X,
  UploadCloud,
  CircleHelp,
  ShieldCheck,
} from "lucide-react";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/invoices", label: "Invoices", icon: FileText },
  { href: "/quotes", label: "Quotes", icon: FileSignature },
  { href: "/clients", label: "Clients", icon: Users },
  { href: "/items", label: "Items", icon: Package },
  { href: "/recurring", label: "Recurring", icon: Repeat },
  { href: "/imports", label: "Import", icon: UploadCloud },
  { href: "/settings", label: "Settings", icon: Settings },
];

// Shared with every nav-style link below (sidebar items, Admin, Report a
// problem) so tapping any of them gives the same instant, visible pressed
// feedback as buttons get — links don't pick up the global button:active
// rule in globals.css since they're <a> tags, not <button>s.
const NAV_LINK_ACTIVE = "active:scale-[0.97] active:bg-gray-200 transition-transform";

export function AppShell({
  businessName,
  userEmail,
  signOutAction,
  isAdmin,
  children,
}: {
  businessName: string;
  userEmail?: string | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  signOutAction: any;
  isAdmin?: boolean;
  children: React.ReactNode;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();

  const sidebarContent = (
    <>
      <div className="px-5 py-5 border-b border-gray-200 flex items-center justify-between">
        <div>
          <Link href="/dashboard" className="text-lg font-bold" onClick={() => setMobileOpen(false)}>
            Nimblo
          </Link>
          <p className="text-xs text-gray-500 mt-0.5 truncate">{businessName}</p>
        </div>
        <button
          type="button"
          className="lg:hidden p-1 text-gray-500 hover:text-gray-900"
          aria-label="Close menu"
          onClick={() => setMobileOpen(false)}
        >
          <X size={20} />
        </button>
      </div>
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const active = pathname === item.href || pathname?.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              prefetch={false}
              onClick={() => setMobileOpen(false)}
              className={`flex items-center gap-2.5 px-3 py-2 rounded-md text-sm ${NAV_LINK_ACTIVE} ${
                active ? "bg-gray-900 text-white" : "text-gray-700 hover:bg-gray-100"
              }`}
            >
              <item.icon size={16} />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="px-3 py-4 border-t border-gray-200 space-y-1">
        {isAdmin && (
          <Link
            href="/admin"
            prefetch={false}
            onClick={() => setMobileOpen(false)}
            className={`flex items-center gap-2.5 px-3 py-2 rounded-md text-sm ${NAV_LINK_ACTIVE} ${
              pathname === "/admin" ? "bg-gray-900 text-white" : "text-gray-700 hover:bg-gray-100"
            }`}
          >
            <ShieldCheck size={16} />
            Admin
          </Link>
        )}
        <Link
          href="/support"
          prefetch={false}
          onClick={() => setMobileOpen(false)}
          className={`flex items-center gap-2.5 px-3 py-2 rounded-md text-sm ${NAV_LINK_ACTIVE} ${
            pathname === "/support" ? "bg-gray-900 text-white" : "text-gray-700 hover:bg-gray-100"
          }`}
        >
          <CircleHelp size={16} />
          Report a problem
        </Link>
        <p className="px-3 text-xs text-gray-500 truncate mb-2 pt-2">{userEmail}</p>
        <form action={signOutAction}>
          <button
            type="submit"
            className="w-full text-left px-3 py-2 rounded-md text-sm text-gray-700 hover:bg-gray-100"
          >
            Log out
          </button>
        </form>
      </div>
    </>
  );

  return (
    <div className="flex-1 flex min-h-0">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex w-60 shrink-0 border-r border-gray-200 bg-white flex-col">
        {sidebarContent}
      </aside>

      {/* Mobile top bar */}
      <div className="lg:hidden fixed top-0 inset-x-0 z-30 h-14 bg-white border-b border-gray-200 flex items-center px-4 gap-3">
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          aria-label="Open menu"
          className="p-1.5 -ml-1.5 text-gray-700"
        >
          <Menu size={22} />
        </button>
        <span className="font-bold">Nimblo</span>
      </div>

      {/* Mobile off-canvas drawer */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-40 flex">
          <div className="absolute inset-0 bg-black/50" onClick={() => setMobileOpen(false)} />
          <aside className="relative w-72 max-w-[85vw] bg-white flex flex-col h-full">
            {sidebarContent}
          </aside>
        </div>
      )}

      <main className="flex-1 min-w-0 pt-14 lg:pt-0">{children}</main>
    </div>
  );
}
