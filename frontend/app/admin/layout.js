
"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Gamepad2,
  TicketPercent,
  ClipboardCheck,
  ShieldCheck,
  LoaderCircle,
  AlertTriangle,
  RefreshCw,
  LogOut,
  Home,
  Menu,
  X,
  ChevronRight,
  PanelLeftClose,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { apiUrl } from "@/lib/api";

const NAVIGATION = [
  {
    label: "Dashboard",
    href: "/admin",
    icon: LayoutDashboard,
  },
  {
    label: "Games",
    href: "/admin/games",
    icon: Gamepad2,
  },
  {
    label: "Orders",
    href: "/admin/orders",
    icon: ClipboardCheck,
  },
  {
    label: "Payment Verification",
    href: "/admin/orders",
    icon: ShieldCheck,
  },
  {
    label: "Marquee",
    href: "/admin/marquee",
    icon: TicketPercent,
  },
];

function getActiveNavigation(pathname) {
  if (pathname.startsWith("/admin/games")) {
    return { label: "Games", href: "/admin/games" };
  }

  if (pathname.startsWith("/admin/marquee")) {
    return { label: "Marquee", href: "/admin/marquee" };
  }

  if (pathname.startsWith("/admin/orders")) {
    return { label: "Orders & Payment Verification", href: "/admin/orders" };
  }

  return { label: "Dashboard", href: "/admin" };
}

function LoadingScreen() {
  return (
    <main
      className="flex min-h-screen items-center justify-center bg-background px-4"
      aria-busy="true"
    >
      <section className="w-full max-w-sm rounded-2xl border border-glass-border bg-card p-8 text-center shadow-xl">
        <ShieldCheck className="mx-auto mb-4 h-10 w-10 text-accent" />
        <LoaderCircle className="mx-auto mb-4 h-7 w-7 animate-spin text-accent" />
        <h1 className="text-xl font-bold">
          Verifying administrator access
        </h1>
        <p className="mt-2 text-sm text-secondary">
          Checking your signed-in account securely.
        </p>
      </section>
    </main>
  );
}

function AccessMessage({
  title,
  message,
  icon: Icon,
  onRetry,
  showRetry = false,
}) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <section className="w-full max-w-md rounded-2xl border border-glass-border bg-card p-6 text-center shadow-xl sm:p-8">
        <Icon className="mx-auto mb-4 h-12 w-12 text-accent" />

        <h1 className="text-2xl font-bold">{title}</h1>

        <p role="alert" className="mt-3 break-words text-sm text-secondary">
          {message}
        </p>

        <div className="mt-6 flex flex-wrap justify-center gap-3">
          {showRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-accent px-5 py-3 font-semibold text-white transition hover:opacity-90"
            >
              <RefreshCw className="h-4 w-4" />
              Retry
            </button>
          )}

          <Link
            href="/"
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-glass-border px-5 py-3 font-medium transition hover:border-accent"
          >
            <Home className="h-4 w-4" />
            Back to store
          </Link>
        </div>
      </section>
    </main>
  );
}

export default function AdminLayout({ children }) {
  const auth = useAuth();

  const user = auth?.firebaseUser || auth?.currentUser || null;
  const authLoading = auth?.loading ?? true;

  const pathname = usePathname();
  const router = useRouter();

  const [accessState, setAccessState] = useState("checking");
  const [error, setError] = useState("");
  const [retryCount, setRetryCount] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  const activeNavigation = getActiveNavigation(pathname || "/admin");

  const checkAdminAccess = useCallback(async () => {
    if (authLoading) return;

    if (!user) {
      setAccessState("unauthenticated");
      setError("Please sign in with your administrator account.");
      return;
    }

    setAccessState("checking");
    setError("");

    try {
      const token = await user.getIdToken();

      // This endpoint must validate the Firebase token and admin allowlist.
      const response = await fetch(
        apiUrl("/api/admin/payment-submissions/access"),
        {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        cache: "no-store",
      });

      const data = await response.json().catch(() => ({}));

      if (response.status === 401) {
        setAccessState("unauthenticated");
        setError(data.error || "Your session has expired. Please sign in again.");
        return;
      }

      if (response.status === 403) {
        setAccessState("denied");
        setError(
          data.error ||
            "Your account is not authorized to access the admin panel."
        );
        return;
      }

      if (!response.ok) {
        throw new Error(
          data.error ||
            `Could not verify administrator access (HTTP ${response.status}).`
        );
      }

      setAccessState("authorized");
      setError("");
    } catch (err) {
      console.error("Admin access verification failed:", err);

      setAccessState("error");
      setError(
        err instanceof Error
          ? err.message
          : "Unable to verify administrator access. Check your connection."
      );
    }
  }, [authLoading, user]);

  useEffect(() => {
    if (!authLoading) {
      checkAdminAccess();
    }
  }, [authLoading, checkAdminAccess, retryCount]);

  // Close the mobile sidebar whenever the route changes.
  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  // Prevent the page behind the mobile drawer from scrolling.
  useEffect(() => {
    if (!menuOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function handleKeyDown(event) {
      if (event.key === "Escape") {
        setMenuOpen(false);
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [menuOpen]);

  async function handleSignOut() {
    if (signingOut) return;

    setSigningOut(true);

    try {
      // Use the sign-out method exposed by your existing AuthContext.
      const signOutFunction = auth?.logout || auth?.signOut;

      if (typeof signOutFunction !== "function") {
        throw new Error(
          "Your AuthContext does not expose logout() or signOut(). Add your existing Firebase sign-out function to AuthContext before using this button."
        );
      }

      await signOutFunction();
      setMenuOpen(false);
      router.replace("/");
      router.refresh();
    } catch (err) {
      console.error("Admin sign-out failed:", err);
      setError(
        err instanceof Error ? err.message : "Unable to sign out."
      );
    } finally {
      setSigningOut(false);
    }
  }

  if (authLoading || accessState === "checking") {
    return <LoadingScreen />;
  }

  if (accessState === "unauthenticated") {
    return (
      <AccessMessage
        title="Sign-in required"
        message={error}
        icon={ShieldCheck}
      />
    );
  }

  if (accessState === "denied") {
    return (
      <AccessMessage
        title="Access denied"
        message={
          error ||
          "Your account is not authorized to access the administration panel."
        }
        icon={ShieldCheck}
      />
    );
  }

  if (accessState === "error") {
    return (
      <AccessMessage
        title="Could not verify access"
        message={error}
        icon={AlertTriangle}
        showRetry
        onRetry={() => setRetryCount((count) => count + 1)}
      />
    );
  }

  const sidebarContent = (
    <>
      <div className="flex items-center justify-between gap-3 px-4 pb-5 pt-5 sm:px-5">
        <Link
          href="/admin"
          className="flex min-w-0 items-center gap-3 rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-accent"
          onClick={() => setMenuOpen(false)}
        >
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-accent/15">
            <ShieldCheck className="h-6 w-6 text-accent" />
          </span>

          <span className="min-w-0">
            <span className="block truncate text-base font-bold text-accent">
              Nexus Admin
            </span>
            <span className="block text-xs text-secondary">
              Control panel
            </span>
          </span>
        </Link>

        <button
          type="button"
          onClick={() => setMenuOpen(false)}
          aria-label="Close navigation menu"
          className="rounded-lg p-2 text-secondary transition hover:bg-accent/10 hover:text-foreground lg:hidden"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="px-4 pb-2">
        <p className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-secondary">
          Workspace
        </p>

        <nav aria-label="Admin navigation" className="space-y-1.5">
          {NAVIGATION.map(({ label, href, icon: Icon }, index) => {
            const active =
              label === activeNavigation.label ||
              (href === "/admin" && pathname === "/admin") ||
              (href !== "/admin" && pathname.startsWith(`${href}/`));

            // Orders and payment verification share a destination.
            // Show the destination only once in the sidebar.
            if (
              label === "Payment Verification" &&
              pathname !== "/admin/payment-verification"
            ) {
              return null;
            }

            return (
              <Link
                key={`${href}-${label}-${index}`}
                href={href}
                aria-current={active ? "page" : undefined}
                onClick={() => setMenuOpen(false)}
                className={`group flex min-h-11 items-center gap-3 rounded-xl px-3 py-3 text-sm transition-colors ${
                  active
                    ? "bg-accent/15 font-semibold text-accent ring-1 ring-inset ring-accent/20"
                    : "text-secondary hover:bg-accent/10 hover:text-foreground"
                }`}
              >
                <Icon
                  className={`h-[18px] w-[18px] shrink-0 ${
                    active ? "text-accent" : ""
                  }`}
                />

                <span className="min-w-0 flex-1">{label}</span>

                {active && (
                  <ChevronRight className="h-4 w-4 shrink-0" />
                )}
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="mt-auto space-y-1 border-t border-glass-border p-4">
        <Link
          href="/"
          onClick={() => setMenuOpen(false)}
          className="flex min-h-11 items-center gap-3 rounded-xl px-3 py-3 text-sm text-secondary transition hover:bg-accent/10 hover:text-foreground"
        >
          <Home className="h-[18px] w-[18px] shrink-0" />
          <span>Back to store</span>
        </Link>

        <button
          type="button"
          onClick={handleSignOut}
          disabled={signingOut}
          className="flex min-h-11 w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm text-secondary transition hover:bg-red-500/10 hover:text-red-400 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {signingOut ? (
            <LoaderCircle className="h-[18px] w-[18px] shrink-0 animate-spin" />
          ) : (
            <LogOut className="h-[18px] w-[18px] shrink-0" />
          )}

          <span>{signingOut ? "Signing out..." : "Sign out"}</span>
        </button>
      </div>
    </>
  );

  return (
    <div className="min-h-screen overflow-x-clip bg-background text-foreground">
      {/* Mobile top bar: navigation is hidden inside the drawer. */}
      <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-glass-border bg-background/95 px-4 backdrop-blur-lg lg:hidden">
        <div className="flex min-w-0 items-center gap-3">
          <button
            type="button"
            onClick={() => setMenuOpen(true)}
            aria-label="Open admin navigation"
            aria-expanded={menuOpen}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-glass-border transition hover:border-accent hover:bg-accent/10"
          >
            <Menu className="h-5 w-5" />
          </button>

          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-accent">
              Nexus Admin
            </p>
            <p className="truncate text-xs text-secondary">
              {activeNavigation.label}
            </p>
          </div>
        </div>

        <Link
          href="/"
          aria-label="Back to store"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-secondary transition hover:bg-accent/10 hover:text-foreground"
        >
          <Home className="h-5 w-5" />
        </Link>
      </header>

      <div className="flex min-h-[calc(100vh-4rem)] lg:min-h-screen">
        {/* Desktop sidebar */}
        <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-glass-border bg-card/70 lg:flex xl:w-72">
          {sidebarContent}
        </aside>

        {/* Mobile sidebar drawer */}
        {menuOpen && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <button
              type="button"
              aria-label="Close navigation overlay"
              onClick={() => setMenuOpen(false)}
              className="absolute inset-0 h-full w-full cursor-default bg-black/60 backdrop-blur-[2px]"
            />

            <aside
              id="admin-mobile-sidebar"
              aria-label="Mobile admin navigation"
              className="absolute inset-y-0 left-0 flex w-[min(86vw,320px)] flex-col border-r border-glass-border bg-card shadow-2xl"
            >
              {sidebarContent}
            </aside>
          </div>
        )}

        {/* Main content */}
        <main className="min-w-0 flex-1">
          <div className="mx-auto w-full max-w-[1800px] p-4 sm:p-6 lg:p-8 xl:p-10">
            <header className="mb-6 border-b border-glass-border pb-5 sm:mb-8 sm:pb-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold tracking-[0.2em] text-accent sm:text-xs">
                    NEXUS GAMING MARKETPLACE
                  </p>

                  <h1 className="mt-2 break-words text-2xl font-bold tracking-tight sm:text-3xl">
                    {activeNavigation.label}
                  </h1>

                  <p className="mt-2 max-w-2xl text-sm leading-6 text-secondary">
                    Manage your store, games, customer orders, and payment
                    verification.
                  </p>
                </div>

                <div className="hidden items-center gap-2 rounded-full border border-glass-border px-3 py-2 text-xs text-secondary sm:flex">
                  <span className="h-2 w-2 rounded-full bg-emerald-500" />
                  Admin workspace
                </div>
              </div>
            </header>

            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
