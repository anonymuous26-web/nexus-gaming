
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  RefreshCw,
  ShoppingBag,
  AlertCircle,
  CheckCircle2,
  Clock3,
  ShieldCheck,
  ArrowRight,
  PackageCheck,
  CircleDollarSign,
} from "lucide-react";

import { useAuth } from "@/contexts/AuthContext";
import OrderItem from "@/components/OrderItem";
import PaymentSubmissionForm from "@/components/payment/PaymentSubmissionForm";
import { apiUrl } from "@/lib/api";

const ORDERS_ENDPOINT = apiUrl("/api/orders/mine");

function getTimestamp(value) {
  if (!value) return 0;

  try {
    if (typeof value.toDate === "function") {
      return value.toDate().getTime();
    }

    if (typeof value.seconds === "number") {
      return value.seconds * 1000;
    }

    if (typeof value === "number") {
      return value < 1e12 ? value * 1000 : value;
    }

    if (typeof value === "string") {
      const parsed = Date.parse(value);
      return Number.isFinite(parsed) ? parsed : 0;
    }

    if (value instanceof Date) {
      return value.getTime();
    }
  } catch {
    return 0;
  }

  return 0;
}

function normalizeOrder(order) {
  if (!order || typeof order !== "object") return null;

  const id =
    typeof order.id === "string" || typeof order.id === "number"
      ? String(order.id)
      : "";

  if (!id) return null;

  return {
    ...order,
    id,
    orderId: order.orderId || id,
    paymentId: order.paymentReference || order.paymentId || id,
  };
}

function getPaymentState(order) {
  const paymentStatus = String(order?.paymentStatus || "")
    .trim()
    .toLowerCase();

  const status = String(order?.status || "")
    .trim()
    .toLowerCase();

  if (
    paymentStatus === "verified" ||
    paymentStatus === "approved" ||
    status === "verified"
  ) {
    return "verified";
  }

  if (
    paymentStatus === "rejected" ||
    paymentStatus === "failed" ||
    paymentStatus === "declined" ||
    status === "rejected"
  ) {
    return "rejected";
  }

  if (
    paymentStatus === "awaiting_verification" ||
    paymentStatus === "pending" ||
    paymentStatus === "submitted" ||
    status === "pending"
  ) {
    return "pending";
  }

  return "other";
}

function getErrorMessage(error) {
  if (!(error instanceof Error)) {
    return "Something went wrong while loading your orders.";
  }

  if (error.name === "AbortError") {
    return "The request was cancelled. Please try again.";
  }

  return error.message || "Something went wrong while loading your orders.";
}

function SummaryTile({ icon, label, value, tone }) {
  const styles = {
    cyan: "bg-cyan-400/10 text-cyan-300",
    green: "bg-emerald-400/10 text-emerald-300",
    amber: "bg-amber-400/10 text-amber-300",
    violet: "bg-violet-400/10 text-violet-300",
  };

  return (
    <div className="flex min-w-0 items-center gap-3 rounded-2xl border border-glass-border/70 bg-card/50 p-4">
      <span
        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${
          styles[tone] || styles.cyan
        }`}
        aria-hidden="true"
      >
        {icon}
      </span>

      <div className="min-w-0">
        <p className="text-xs text-secondary">{label}</p>
        <p className="mt-1 text-2xl font-bold tabular-nums">{value}</p>
      </div>
    </div>
  );
}

function OrderSkeleton() {
  return (
    <div
      className="space-y-4"
      aria-label="Loading orders"
      aria-busy="true"
    >
      {[1, 2, 3].map((item) => (
        <div
          key={item}
          className="glass animate-pulse rounded-2xl border border-glass-border/60 p-5"
        >
          <div className="mb-4 h-5 w-40 rounded bg-accent/20" />
          <div className="mb-3 h-4 w-3/4 max-w-sm rounded bg-accent/10" />
          <div className="mb-5 h-4 w-1/2 max-w-xs rounded bg-accent/10" />
          <div className="h-10 w-32 rounded-lg bg-accent/10" />
        </div>
      ))}

      <p className="sr-only">Loading your orders…</p>
    </div>
  );
}

function EmptyOrders() {
  return (
    <section className="glass rounded-2xl border border-glass-border/60 px-5 py-12 text-center">
      <ShoppingBag className="mx-auto mb-4 h-12 w-12 text-accent/70" />

      <h2 className="text-xl font-semibold">No orders yet</h2>

      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-secondary">
        Your purchases will appear here after you place an order in the
        marketplace.
      </p>

      <Link
        href="/"
        className="mt-6 inline-flex items-center justify-center gap-2 rounded-lg bg-accent px-5 py-3 font-semibold text-black transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
      >
        Browse games
        <ArrowRight className="h-4 w-4" />
      </Link>
    </section>
  );
}

export default function OrdersPage() {
  const {
    firebaseUser,
    currentUser,
    loading: authLoading,
  } = useAuth();

  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  // Prevent a previous request from overwriting a newer request.
  const requestSequence = useRef(0);
  const mountedRef = useRef(false);

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
      requestSequence.current += 1;
    };
  }, []);

  const loadOrders = useCallback(
    async ({ silent = false } = {}) => {
      if (!firebaseUser) {
        setOrders([]);
        setError("");
        setLoading(false);
        setRefreshing(false);
        return;
      }

      const requestId = ++requestSequence.current;

      if (silent) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setError("");

      try {
        const token = await firebaseUser.getIdToken();

        if (
          !mountedRef.current ||
          requestId !== requestSequence.current
        ) {
          return;
        }

        const response = await fetch(ORDERS_ENDPOINT, {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/json",
          },
          cache: "no-store",
        });

        const data = await response.json().catch(() => ({}));

        if (
          !mountedRef.current ||
          requestId !== requestSequence.current
        ) {
          return;
        }

        if (!response.ok) {
          if (response.status === 401) {
            throw new Error(
              "Your session may have expired. Please sign in again."
            );
          }

          if (response.status === 403) {
            throw new Error(
              "You do not have permission to view these orders."
            );
          }

          if (response.status >= 500) {
            throw new Error(
              "The order service is temporarily unavailable. Please try again."
            );
          }

          throw new Error(
            typeof data.error === "string"
              ? data.error
              : "We couldn't load your orders. Please try again."
          );
        }

        if (!Array.isArray(data.orders)) {
          throw new Error(
            "The server returned an unexpected order response. Please try again."
          );
        }

        const safeOrders = data.orders
          .map(normalizeOrder)
          .filter(Boolean)
          .sort(
            (a, b) => getTimestamp(b.createdAt) - getTimestamp(a.createdAt)
          );

        if (
          !mountedRef.current ||
          requestId !== requestSequence.current
        ) {
          return;
        }

        setOrders(safeOrders);
        setError("");
      } catch (err) {
        if (
          !mountedRef.current ||
          requestId !== requestSequence.current
        ) {
          return;
        }

        console.error("Failed to load customer orders:", err);
        setError(getErrorMessage(err));
      } finally {
        if (
          mountedRef.current &&
          requestId === requestSequence.current
        ) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [firebaseUser]
  );

  useEffect(() => {
    if (authLoading) return;

    if (!firebaseUser) {
      requestSequence.current += 1;
      setOrders([]);
      setError("");
      setLoading(false);
      setRefreshing(false);
      return;
    }

    loadOrders();

    return () => {
      // Ignore any response belonging to this effect's previous request.
      requestSequence.current += 1;
    };
  }, [authLoading, firebaseUser, loadOrders]);

  const summary = useMemo(() => {
    let verified = 0;
    let pending = 0;
    let rejected = 0;

    for (const order of orders) {
      const state = getPaymentState(order);

      if (state === "verified") verified += 1;
      else if (state === "pending") pending += 1;
      else if (state === "rejected") rejected += 1;
    }

    return {
      total: orders.length,
      verified,
      pending,
      rejected,
    };
  }, [orders]);

  const handleRefresh = () => {
    if (!refreshing) {
      loadOrders({ silent: true });
    }
  };

  if (authLoading || loading) {
    return (
      <main
        className="container mx-auto min-h-[60vh] px-4 py-8"
        aria-busy="true"
      >
        <header className="mb-7">
          <h1 className="text-3xl font-black tracking-tight">My Orders</h1>
          <p className="mt-2 text-sm text-secondary">
            Loading your purchase history…
          </p>
        </header>

        <OrderSkeleton />
      </main>
    );
  }

  if (!firebaseUser || !currentUser) {
    return (
      <main className="container mx-auto flex min-h-[60vh] flex-col items-center justify-center px-4 py-12 text-center">
        <ShoppingBag className="mb-4 h-12 w-12 text-accent" />

        <h1 className="mb-2 text-2xl font-bold">My Orders</h1>

        <p className="max-w-md text-secondary">
          Sign in to view your orders, check payment status, and submit your
          UPI transaction details.
        </p>

        <Link
          href="/"
          className="mt-5 inline-flex items-center gap-2 rounded-lg border border-glass-border px-5 py-3 font-medium transition hover:border-accent hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          Return to marketplace
          <ArrowRight className="h-4 w-4" />
        </Link>
      </main>
    );
  }

  if (error && orders.length === 0) {
    return (
      <main className="container mx-auto flex min-h-[60vh] flex-col items-center justify-center px-4 py-12 text-center">
        <AlertCircle className="mb-4 h-10 w-10 text-red-400" />

        <h1 className="mb-2 text-2xl font-bold">Unable to load orders</h1>

        <p role="alert" className="max-w-lg text-sm leading-6 text-red-400">
          {error}
        </p>

        <button
          type="button"
          onClick={() => loadOrders()}
          className="mt-5 inline-flex items-center gap-2 rounded-lg bg-accent px-5 py-3 font-semibold text-black transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          <RefreshCw className="h-4 w-4" />
          Try again
        </button>

        <Link
          href="/"
          className="mt-4 text-sm text-secondary underline underline-offset-4 hover:text-accent"
        >
          Return to marketplace
        </Link>
      </main>
    );
  }

  return (
    <main className="container mx-auto min-h-[60vh] px-4 py-8">
      <header className="relative mb-7 overflow-hidden rounded-3xl border border-cyan-300/15 bg-gradient-to-br from-cyan-400/[0.12] via-card/70 to-violet-500/[0.10] p-5 sm:p-8">
        <div
          className="pointer-events-none absolute -right-10 -top-16 h-48 w-48 rounded-full bg-cyan-300/10 blur-3xl"
          aria-hidden="true"
        />

        <div className="relative flex flex-wrap items-end justify-between gap-5">
          <div className="min-w-0">
            <p className="mb-2 inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-cyan-300">
              <ShieldCheck className="h-4 w-4" />
              Your account
            </p>

            <h1 className="text-3xl font-black tracking-tight sm:text-4xl">
              My Orders
            </h1>

            <p className="mt-2 max-w-xl text-sm leading-6 text-secondary sm:text-base">
              Your purchase history, payment submissions, and verification
              updates in one place.
            </p>
          </div>

          <button
            type="button"
            onClick={handleRefresh}
            disabled={refreshing}
            aria-label={refreshing ? "Refreshing orders" : "Refresh orders"}
            className="inline-flex items-center gap-2 rounded-lg border border-glass-border px-4 py-3 text-sm font-semibold transition hover:border-accent hover:text-accent disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            <RefreshCw
              className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`}
            />
            {refreshing ? "Refreshing…" : "Refresh"}
          </button>
        </div>
      </header>

      {orders.length > 0 && (
        <section
          aria-label="Order summary"
          className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4"
        >
          <SummaryTile
            icon={<ShoppingBag className="h-5 w-5" />}
            label="Total orders"
            value={summary.total}
            tone="cyan"
          />

          <SummaryTile
            icon={<CheckCircle2 className="h-5 w-5" />}
            label="Verified payments"
            value={summary.verified}
            tone="green"
          />

          <SummaryTile
            icon={<Clock3 className="h-5 w-5" />}
            label="Awaiting review"
            value={summary.pending}
            tone="amber"
          />

          <SummaryTile
            icon={<CircleDollarSign className="h-5 w-5" />}
            label="Rejected payments"
            value={summary.rejected}
            tone="violet"
          />
        </section>
      )}

      {error && (
        <div
          role="alert"
          className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300"
        >
          <span className="flex min-w-0 items-start gap-2">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error} Your displayed orders may be from the last successful load.</span>
          </span>

          <button
            type="button"
            onClick={handleRefresh}
            disabled={refreshing}
            className="shrink-0 font-semibold underline underline-offset-4 disabled:opacity-60"
          >
            {refreshing ? "Retrying…" : "Retry"}
          </button>
        </div>
      )}

      {refreshing && (
        <p className="mb-4 text-xs text-secondary" role="status">
          Checking for order updates…
        </p>
      )}

      {orders.length === 0 ? (
        <EmptyOrders />
      ) : (
        <section aria-label="Your order history" className="space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-bold">Order history</h2>

            <p className="text-sm text-secondary">
              {orders.length} {orders.length === 1 ? "order" : "orders"}
            </p>
          </div>

          {orders.map((order) => (
            <article
              key={order.id}
              className="group rounded-2xl border border-glass-border/70 bg-card/45 p-4 transition hover:border-cyan-300/20 sm:p-6"
            >
              <OrderItem order={order} />

              <div className="mt-4 border-t border-glass-border/60 pt-4">
                <div className="mb-3 flex items-center gap-2 text-xs text-secondary">
                  <PackageCheck className="h-4 w-4 shrink-0" />
                  Payment submission and verification
                </div>

                <PaymentSubmissionForm
                  order={order}
                  onSubmitted={() => loadOrders({ silent: true })}
                />
              </div>
            </article>
          ))}
        </section>
      )}

      <footer className="mt-8 border-t border-glass-border/60 pt-5 text-xs leading-5 text-secondary">
        <p>
          Payment status is based on the order information returned by the
          server. If you have submitted a transaction but the status has not
          changed, refresh your orders or contact marketplace support.
        </p>
      </footer>
    </main>
  );
}
