
"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowUpRight,
  LayoutDashboard,
  TicketPercent,
  ClipboardCheck,
  RefreshCw,
  Gamepad2,
  CreditCard,
  Clock3,
  CheckCircle2,
  AlertTriangle,
  Wifi,
  WifiOff,
} from "lucide-react";

import { useAuth } from "@/contexts/AuthContext";
import RecentOrders from "@/components/admin/RecentOrders";
import { apiUrl } from "@/lib/api";

const SHORTCUTS = [
  {
    title: "Review payments",
    description: "Verify payment references and submitted proof.",
    href: "/admin/orders",
    icon: ClipboardCheck,
    accent: "text-amber-300",
    surface: "bg-amber-400/10",
  },
  {
    title: "Manage games",
    description: "Add, edit, and manage your game catalogue.",
    href: "/admin/games",
    icon: Gamepad2,
    accent: "text-cyan-300",
    surface: "bg-cyan-400/10",
  },
  {
    title: "Store promotions",
    description: "Manage your store marquee and promotions.",
    href: "/admin/marquee",
    icon: TicketPercent,
    accent: "text-violet-300",
    surface: "bg-violet-400/10",
  },
];

const INITIAL_STATS = {
  totalRevenue: 0,
  pendingOrders: 0,
  totalGames: 0,
  verifiedOrders: 0,
};

function formatCurrency(value) {
  const amount = Number(value);

  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(Number.isFinite(amount) ? amount : 0);
}

function formatNumber(value) {
  const amount = Number(value ?? 0);

  return Number.isFinite(amount)
    ? amount.toLocaleString("en-IN")
    : "0";
}

function StatSkeleton() {
  return (
    <div
      className="animate-pulse rounded-2xl border border-glass-border bg-card/50 p-5"
      aria-hidden="true"
    >
      <div className="h-3 w-28 rounded bg-white/10" />
      <div className="mt-5 h-8 w-36 max-w-full rounded bg-white/10" />
      <div className="mt-4 h-3 w-24 rounded bg-white/10" />
    </div>
  );
}

function MetricCard({
  title,
  value,
  icon: Icon,
  color = "text-cyan-300",
  loading,
}) {
  return (
    <div className="min-w-0 rounded-2xl border border-glass-border/70 bg-card/50 p-4 transition hover:border-cyan-300/20 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm leading-5 text-secondary">{title}</p>

        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/[0.04]">
          <Icon className={`h-5 w-5 ${color}`} aria-hidden="true" />
        </span>
      </div>

      <div
        className="mt-4 break-words text-2xl font-extrabold tracking-tight sm:text-3xl"
        aria-live="polite"
        aria-busy={loading}
      >
        {loading ? (
          <span
            className="inline-block h-8 w-24 animate-pulse rounded bg-white/10"
            aria-label="Loading metric"
          />
        ) : (
          value
        )}
      </div>
    </div>
  );
}

export default function AdminDashboard() {
  const auth = useAuth();
  const user = auth?.firebaseUser || auth?.currentUser || null;
  const authLoading = auth?.loading ?? true;

  const [stats, setStats] = useState(INITIAL_STATS);
  const [recentOrders, setRecentOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [lastUpdated, setLastUpdated] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const refreshDashboard = useCallback(() => {
    if (loading || refreshing || authLoading) return;

    setRefreshing(true);
    setRefreshKey((value) => value + 1);
  }, [loading, refreshing, authLoading]);

  useEffect(() => {
    let active = true;
    const controller = new AbortController();

    async function loadDashboard() {
      if (authLoading) return;

      if (!user) {
        setStats(INITIAL_STATS);
        setRecentOrders([]);
        setError("Your session is unavailable. Please sign in again.");
        setLoading(false);
        setRefreshing(false);
        return;
      }

      setLoading(true);
      setError("");

      try {
        const token = await user.getIdToken();

        if (!active) return;

        const response = await fetch(apiUrl("/api/admin/dashboard"), {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
          },
          cache: "no-store",
          signal: controller.signal,
        });

        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
          if (response.status === 401) {
            throw new Error(
              "Your session is invalid or expired. Please sign in again."
            );
          }

          if (response.status === 403) {
            throw new Error(
              "Administrator access was denied. Check your admin permissions."
            );
          }

          throw new Error(
            data.error ||
              `Unable to load dashboard data (HTTP ${response.status}).`
          );
        }

        if (
          !data.stats ||
          !Array.isArray(data.recentOrders) ||
          !Number.isFinite(Number(data.stats.totalRevenue)) ||
          !Number.isFinite(Number(data.stats.pendingOrders)) ||
          !Number.isFinite(Number(data.stats.totalGames)) ||
          !Number.isFinite(Number(data.stats.verifiedOrders))
        ) {
          throw new Error(
            "The dashboard API returned invalid or incomplete data."
          );
        }

        if (!active) return;

        setStats({
          totalRevenue: Number(data.stats.totalRevenue),
          pendingOrders: Number(data.stats.pendingOrders),
          totalGames: Number(data.stats.totalGames),
          verifiedOrders: Number(data.stats.verifiedOrders),
        });

        setRecentOrders(data.recentOrders);
        setLastUpdated(new Date());
        setError("");
      } catch (err) {
        if (err?.name === "AbortError") return;

        console.error("Admin dashboard loading failed:", err);

        if (active) {
          setError(
            err instanceof Error
              ? err.message
              : "An unexpected error occurred while loading the dashboard."
          );
        }
      } finally {
        if (active) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    }

    loadDashboard();

    return () => {
      active = false;
      controller.abort();
    };
  }, [user, authLoading, refreshKey]);

  return (
    <div className="min-w-0 space-y-6 sm:space-y-8">
      {/* Dashboard hero */}
      <section className="relative isolate overflow-hidden rounded-2xl border border-cyan-300/15 bg-gradient-to-br from-cyan-400/[0.12] via-card/80 to-violet-500/[0.10] p-5 shadow-xl sm:rounded-3xl sm:p-8">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-16 -top-16 -z-10 h-52 w-52 rounded-full bg-cyan-300/10 blur-3xl sm:h-64 sm:w-64"
        />

        <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div className="min-w-0">
            <div className="mb-4 inline-flex max-w-full items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-cyan-200">
              <LayoutDashboard className="h-4 w-4 shrink-0" />
              <span>Operations overview</span>
            </div>

            <h2 className="break-words text-3xl font-black tracking-tight sm:text-4xl">
              Welcome to{" "}
              <span className="text-cyan-300">Nexus Admin</span>
            </h2>

            <p className="mt-3 max-w-2xl text-sm leading-6 text-secondary sm:text-base">
              Monitor store activity, manage your catalogue, and review
              customer payments from one workspace.
            </p>

            <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-secondary">
              {error ? (
                <>
                  <WifiOff
                    className="h-4 w-4 text-amber-300"
                    aria-hidden="true"
                  />
                  <span>Some data needs attention</span>
                </>
              ) : (
                <>
                  <Wifi
                    className="h-4 w-4 text-emerald-400"
                    aria-hidden="true"
                  />
                  <span>
                    {lastUpdated
                      ? `Metrics refreshed ${lastUpdated.toLocaleTimeString(
                          "en-IN",
                          {
                            hour: "2-digit",
                            minute: "2-digit",
                          }
                        )}`
                      : "Loading dashboard metrics"}
                  </span>
                </>
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={refreshDashboard}
            disabled={loading || refreshing || authLoading}
            className="inline-flex min-h-11 w-full shrink-0 items-center justify-center gap-2 rounded-xl border border-glass-border bg-card/70 px-4 py-3 text-sm font-semibold transition hover:border-cyan-300/40 hover:text-cyan-200 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
          >
            <RefreshCw
              className={`h-4 w-4 ${
                loading || refreshing ? "animate-spin" : ""
              }`}
              aria-hidden="true"
            />
            {loading || refreshing ? "Refreshing..." : "Refresh dashboard"}
          </button>
        </div>
      </section>

      {/* Error diagnostics */}
      {error && (
        <section
          role="alert"
          className="rounded-2xl border border-amber-400/25 bg-amber-400/[0.07] p-4 sm:p-5"
        >
          <div className="flex items-start gap-3">
            <AlertTriangle
              className="mt-0.5 h-5 w-5 shrink-0 text-amber-300"
              aria-hidden="true"
            />

            <div className="min-w-0 flex-1">
              <h3 className="font-semibold text-amber-100">
                Dashboard data warning
              </h3>

              <p className="mt-1 break-words text-sm leading-6 text-amber-100/80">
                {error}
              </p>

              <button
                type="button"
                onClick={refreshDashboard}
                disabled={loading || refreshing || authLoading}
                className="mt-4 inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-amber-300/20 px-3 py-2 text-sm font-semibold transition hover:bg-amber-300/10 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <RefreshCw className="h-4 w-4" aria-hidden="true" />
                Retry dashboard
              </button>
            </div>
          </div>
        </section>
      )}

      {/* Statistics */}
      <section aria-label="Marketplace statistics">
        <div className="mb-4">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-cyan-300">
            Store performance
          </p>

          <h3 className="mt-1 text-xl font-bold sm:text-2xl">
            Marketplace metrics
          </h3>
        </div>

        {loading && !lastUpdated ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 2xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <StatSkeleton key={index} />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 2xl:grid-cols-4">
            <MetricCard
              title="Verified revenue"
              value={formatCurrency(stats.totalRevenue)}
              icon={CreditCard}
              color="text-cyan-300"
              loading={loading}
            />

            <MetricCard
              title="Pending orders"
              value={formatNumber(stats.pendingOrders)}
              icon={Clock3}
              color="text-amber-300"
              loading={loading}
            />

            <MetricCard
              title="Games in catalogue"
              value={formatNumber(stats.totalGames)}
              icon={Gamepad2}
              color="text-violet-300"
              loading={loading}
            />

            <MetricCard
              title="Verified orders"
              value={formatNumber(stats.verifiedOrders)}
              icon={CheckCircle2}
              color="text-emerald-400"
              loading={loading}
            />
          </div>
        )}
      </section>

      {/* Quick actions */}
      <section className="space-y-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-cyan-300">
            Quick actions
          </p>

          <h3 className="mt-1 text-xl font-bold sm:text-2xl">
            Manage your store
          </h3>
        </div>

        <div className="grid min-w-0 grid-cols-1 gap-4 xl:grid-cols-3">
          {SHORTCUTS.map(
            ({ title, description, href, icon: Icon, accent, surface }) => (
              <Link
                key={href}
                href={href}
                className="group flex min-w-0 items-start gap-4 rounded-2xl border border-glass-border/70 bg-card/50 p-4 transition duration-200 hover:border-cyan-300/30 hover:bg-card/80 sm:p-5 xl:hover:-translate-y-0.5"
              >
                <span
                  className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl sm:h-12 sm:w-12 ${surface} ${accent}`}
                >
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </span>

                <span className="min-w-0 flex-1">
                  <span className="flex items-start justify-between gap-2 font-bold">
                    <span className="break-words">{title}</span>

                    <ArrowUpRight
                      className="h-4 w-4 shrink-0 text-secondary transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-cyan-300"
                      aria-hidden="true"
                    />
                  </span>

                  <span className="mt-1 block text-sm leading-6 text-secondary">
                    {description}
                  </span>
                </span>
              </Link>
            )
          )}
        </div>
      </section>

      {/* Recent orders */}
      <section className="min-w-0 overflow-hidden rounded-2xl border border-glass-border/70 bg-card/40">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-glass-border/70 px-4 py-4 sm:px-6">
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-secondary">
              Latest activity
            </p>

            <h3 className="mt-1 text-lg font-bold sm:text-xl">
              Recent orders
            </h3>
          </div>

          <Link
            href="/admin/orders"
            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg py-2 text-sm font-semibold text-cyan-300 transition hover:text-cyan-200"
          >
            View orders
            <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>

        <div className="min-w-0 p-3 sm:p-5">
          {loading && recentOrders.length === 0 ? (
            <div
              className="flex min-h-40 items-center justify-center text-sm text-secondary"
              aria-live="polite"
            >
              <RefreshCw
                className="mr-2 h-4 w-4 animate-spin"
                aria-hidden="true"
              />
              Loading recent orders...
            </div>
          ) : error && recentOrders.length === 0 ? (
            <div className="rounded-xl border border-amber-400/20 bg-amber-400/5 p-4 text-sm text-secondary">
              Recent orders are unavailable until the dashboard API succeeds.
            </div>
          ) : (
            <RecentOrders
              orders={recentOrders}
              onOrderUpdated={refreshDashboard}
            />
          )}
        </div>
      </section>
    </div>
  );
}
