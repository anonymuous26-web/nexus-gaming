
"use client";

import { useCallback, useEffect, useState } from "react";
import {
  RefreshCw,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  Clock3,
  AlertCircle,
  ExternalLink,
} from "lucide-react";

import { useAuth } from "@/contexts/AuthContext";
import { apiUrl } from "@/lib/api";

function formatDate(value) {
  if (!value) return "—";

  let date;

  if (typeof value.toDate === "function") {
    date = value.toDate();
  } else if (typeof value.seconds === "number") {
    date = new Date(value.seconds * 1000);
  } else if (typeof value._seconds === "number") {
    date = new Date(value._seconds * 1000);
  } else if (typeof value === "number") {
    date = new Date(value < 1e12 ? value * 1000 : value);
  } else {
    date = new Date(value);
  }

  if (Number.isNaN(date.getTime())) return "—";

  return date.toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function formatMoney(value) {
  const amount = Number(value);

  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(Number.isFinite(amount) ? amount : 0);
}

export default function AdminOrdersPage() {
  const {
    firebaseUser,
    loading: authLoading,
  } = useAuth();

  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busyId, setBusyId] = useState("");

  const loadSubmissions = useCallback(
    async ({ silent = false } = {}) => {
      if (!firebaseUser) {
        setOrders([]);
        setLoading(false);
        setRefreshing(false);
        return;
      }

      if (silent) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setError("");

      try {
        const token = await firebaseUser.getIdToken();

        const response = await fetch(apiUrl("/api/admin/payment-submissions"), {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
          },
          cache: "no-store",
        });

        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
          throw new Error(
            data.error ||
              (response.status === 403
                ? "Your account is not authorized to access payment moderation."
                : "Could not load payment submissions.")
          );
        }

        setOrders(Array.isArray(data.orders) ? data.orders : []);
      } catch (err) {
        console.error("Failed to load admin payment submissions:", err);
        setError(
          err instanceof Error
            ? err.message
            : "An unexpected error occurred."
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [firebaseUser]
  );

  useEffect(() => {
    if (authLoading) return;

    if (!firebaseUser) {
      setOrders([]);
      setLoading(false);
      return;
    }

    loadSubmissions();
  }, [authLoading, firebaseUser, loadSubmissions]);

  const handleDecision = async (order, decision) => {
    if (!firebaseUser || busyId) return;

    let note = "";

    if (decision === "reject") {
      const response = window.prompt(
        "Enter the reason for rejecting this payment submission:"
      );

      if (response === null) return;

      note = response.trim();

      if (!note) {
        setError("A rejection reason is required.");
        return;
      }
    }

    if (decision === "approve") {
      const confirmed = window.confirm(
        `Have you verified the transaction in the merchant's actual UPI records and confirmed receipt of ${formatMoney(order.totalAmount)} for order ${order.orderId || order.id}?`
      );

      if (!confirmed) return;
    }

    setBusyId(order.id);
    setError("");
    setNotice("");

    try {
      const token = await firebaseUser.getIdToken();

      const response = await fetch(
        apiUrl(`/api/admin/payment-submissions/${encodeURIComponent(order.id)}`),
        {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            decision,
            note,
          }),
        }
      );

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          data.error || "The payment decision could not be saved."
        );
      }

      setNotice(
        decision === "approve"
          ? `Payment verified for order ${order.orderId || order.id}.`
          : `Payment submission rejected for order ${order.orderId || order.id}.`
      );

      await loadSubmissions({ silent: true });
    } catch (err) {
      console.error("Failed to update payment decision:", err);
      setError(
        err instanceof Error
          ? err.message
          : "The payment decision could not be saved."
      );
    } finally {
      setBusyId("");
    }
  };

  if (authLoading || loading) {
    return (
      <main
        className="container mx-auto min-h-[60vh] px-4 py-10"
        aria-busy="true"
      >
        <h1 className="text-2xl font-bold">Payment Verification</h1>

        <div className="mt-6 space-y-4">
          {[1, 2].map((item) => (
            <div
              key={item}
              className="glass animate-pulse rounded-xl p-6"
            >
              <div className="mb-4 h-5 w-48 rounded bg-accent/20" />
              <div className="mb-2 h-4 w-64 rounded bg-accent/10" />
              <div className="h-4 w-36 rounded bg-accent/10" />
            </div>
          ))}
        </div>

        <p className="sr-only">Loading payment submissions…</p>
      </main>
    );
  }

  if (!firebaseUser) {
    return (
      <main className="container mx-auto flex min-h-[60vh] flex-col items-center justify-center px-4 py-12 text-center">
        <ShieldCheck
          className="mb-4 h-12 w-12 text-accent"
          aria-hidden="true"
        />

        <h1 className="text-2xl font-bold">Admin access required</h1>

        <p className="mt-2 max-w-md text-secondary">
          Sign in with an authorized administrator account to review payment
          submissions.
        </p>
      </main>
    );
  }

  return (
    <main className="container mx-auto min-h-[60vh] px-4 py-8">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="mb-1 text-sm text-accent">ADMINISTRATION</p>
          <h1 className="text-2xl font-bold sm:text-3xl">
            Payment Verification
          </h1>
          <p className="mt-2 text-sm text-secondary">
            Review customer UPI submissions before marking orders as paid.
          </p>
        </div>

        <button
          type="button"
          onClick={() => loadSubmissions({ silent: true })}
          disabled={refreshing || Boolean(busyId)}
          className="inline-flex items-center gap-2 rounded-lg border border-glass-border px-4 py-2 text-sm font-medium transition hover:border-accent disabled:cursor-not-allowed disabled:opacity-60"
        >
          <RefreshCw
            className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`}
            aria-hidden="true"
          />
          {refreshing ? "Refreshing…" : "Refresh"}
        </button>
      </header>

      <div className="mb-6 rounded-lg border border-yellow-500/30 bg-yellow-500/10 p-4 text-sm text-yellow-200">
        <strong>Verification rule:</strong> A UTR or screenshot alone does not
        prove payment. Check the transaction in the merchant's actual UPI
        records, confirm the amount received, and only then approve.
      </div>

      {error && (
        <div
          role="alert"
          className="mb-4 flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300"
        >
          <AlertCircle
            className="mt-0.5 h-5 w-5 shrink-0"
            aria-hidden="true"
          />
          <span>{error}</span>
        </div>
      )}

      {notice && (
        <div
          role="status"
          className="mb-4 rounded-lg border border-green-500/30 bg-green-500/10 p-4 text-sm text-green-300"
        >
          {notice}
        </div>
      )}

      {orders.length === 0 ? (
        <section className="glass rounded-xl border border-glass-border/50 p-10 text-center">
          <CheckCircle2
            className="mx-auto mb-4 h-12 w-12 text-green-400"
            aria-hidden="true"
          />

          <h2 className="text-xl font-semibold">
            No submissions awaiting review
          </h2>

          <p className="mt-2 text-secondary">
            New customer payment submissions will appear here.
          </p>

          {error && (
            <button
              type="button"
              onClick={() => loadSubmissions()}
              className="mt-4 rounded-lg border border-glass-border px-4 py-2"
            >
              Retry loading
            </button>
          )}
        </section>
      ) : (
        <section aria-label="Payment submissions" className="space-y-5">
          <p className="text-sm text-secondary">
            {orders.length}{" "}
            {orders.length === 1 ? "submission" : "submissions"} awaiting review
          </p>

          {orders.map((order) => {
            const isBusy = busyId === order.id;

            return (
              <article
                key={order.id}
                className="glass rounded-xl border border-glass-border/50 p-4 sm:p-6"
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0">
                    <h2 className="break-words text-lg font-bold">
                      Order #{order.orderId || order.id}
                    </h2>

                    <p className="mt-1 break-all text-sm text-secondary">
                      Customer UID: {order.userId || "Unavailable"}
                    </p>

                    <p className="mt-3 text-2xl font-bold">
                      {formatMoney(order.totalAmount)}
                    </p>
                  </div>

                  <span className="inline-flex items-center gap-2 rounded-full bg-yellow-500/10 px-3 py-1.5 text-sm text-yellow-300">
                    <Clock3 className="h-4 w-4" aria-hidden="true" />
                    Awaiting verification
                  </span>
                </div>

                <div className="mt-5 grid gap-4 rounded-lg border border-glass-border/50 p-4 text-sm sm:grid-cols-2">
                  <div className="min-w-0">
                    <p className="text-secondary">UPI transaction reference</p>
                    <p className="mt-1 break-all font-mono">
                      {order.paymentSubmission?.utr || "Not provided"}
                    </p>
                  </div>

                  <div>
                    <p className="text-secondary">Submission date</p>
                    <p className="mt-1">
                      {formatDate(order.paymentSubmission?.submittedAt)}
                    </p>
                  </div>

                  <div>
                    <p className="text-secondary">Order reference</p>
                    <p className="mt-1 break-all">
                      {order.orderId || order.id}
                    </p>
                  </div>

                  <div>
                    <p className="text-secondary">Order date</p>
                    <p className="mt-1">{formatDate(order.createdAt)}</p>
                  </div>
                </div>

                {order.paymentSubmission?.screenshotUrl && (
                  <a
                    href={order.paymentSubmission.screenshotUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-accent underline underline-offset-4"
                  >
                    View submitted screenshot
                    <ExternalLink
                      className="h-4 w-4"
                      aria-hidden="true"
                    />
                  </a>
                )}

                <div className="mt-5 flex flex-wrap gap-3">
                  <button
                    type="button"
                    disabled={isBusy || Boolean(busyId)}
                    onClick={() => handleDecision(order, "approve")}
                    className="inline-flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2.5 font-semibold text-white transition hover:bg-green-500 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                    {isBusy ? "Saving…" : "Verify payment"}
                  </button>

                  <button
                    type="button"
                    disabled={isBusy || Boolean(busyId)}
                    onClick={() => handleDecision(order, "reject")}
                    className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2.5 font-semibold text-white transition hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <XCircle className="h-4 w-4" aria-hidden="true" />
                    Reject submission
                  </button>
                </div>
              </article>
            );
          })}
        </section>
      )}
    </main>
  );
}
