"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { useCart } from "@/contexts/CartContext";
import { apiUrl } from "@/lib/api";

const formatINR = (amount) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(Number(amount) || 0);

export default function CheckoutPage() {
  const router = useRouter();
  const { currentUser, loading: authLoading } = useAuth();
  const { cartItems, clearCart, isInitialized } = useCart();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [createdOrder, setCreatedOrder] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);

  useEffect(() => {
    if (!authLoading) {
      setAuthChecked(true);
    }
  }, [authLoading]);

  const safeItems = Array.isArray(cartItems) ? cartItems : [];

  const totalItems = safeItems.reduce(
    (sum, item) => sum + Math.max(0, Number(item.quantity) || 0),
    0
  );

  // This is a display estimate only. The server calculates the real order total.
  const estimatedTotal = safeItems.reduce((sum, item) => {
    const price = Number(item.price);
    const quantity = Number(item.quantity);

    if (
      !Number.isFinite(price) ||
      price < 0 ||
      !Number.isInteger(quantity) ||
      quantity < 1
    ) {
      return sum;
    }

    return sum + price * quantity;
  }, 0);

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");

    if (!currentUser) {
      setError("Please sign in before placing your order.");
      return;
    }

    if (!safeItems.length) {
      setError("Your cart is empty. Add a game before checking out.");
      return;
    }

    if (safeItems.some(
      (item) =>
        typeof item.id !== "string" ||
        !item.id.trim() ||
        !Number.isInteger(Number(item.quantity)) ||
        Number(item.quantity) < 1
    )) {
      setError("Your cart contains an invalid item. Please refresh your cart.");
      return;
    }

    setLoading(true);

    try {
      const idToken = await currentUser.getIdToken();

      const response = await fetch(apiUrl("/api/orders"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          items: safeItems.map((item) => ({
            gameId: item.id,
            quantity: Number(item.quantity),
          })),
        }),
      });

      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          result.error || "We couldn't create your order. Please try again."
        );
      }

      if (!result.orderId) {
        throw new Error(
          "The server response did not include an order reference. Please check your orders before retrying."
        );
      }

      // The server has confirmed order creation. Do not report order failure
      // just because clearing the local/Firestore cart subsequently fails.
      setCreatedOrder(result);

      try {
        await clearCart();
      } catch (cartError) {
        console.error(
          "Order created, but the cart could not be cleared:",
          cartError
        );
      }
    } catch (submitError) {
      console.error("Checkout request failed:", submitError);
      setError(
        submitError.message ||
          "Something went wrong while placing your order."
      );
    } finally {
      setLoading(false);
    }
  }

  if (!authChecked || authLoading || !isInitialized) {
    return (
      <main className="min-h-[80vh] flex items-center justify-center px-4">
        <div className="text-center">
          <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-accent/20 border-t-accent" />
          <p className="text-secondary">Preparing your secure checkout...</p>
        </div>
      </main>
    );
  }

  if (createdOrder) {
    return (
      <main className="min-h-[80vh] px-4 py-12">
        <section className="mx-auto max-w-2xl rounded-2xl border border-glass-border/50 bg-card/60 p-6 text-center shadow-xl sm:p-10">
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full border border-green-400/30 bg-green-400/10">
            <svg
              className="h-8 w-8 text-green-400"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              aria-hidden="true"
            >
              <path
                d="m5 12 4 4L19 6"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>

          <p className="mb-2 text-sm font-semibold uppercase tracking-[0.2em] text-accent">
            Order received
          </p>

          <h1 className="mb-4 text-3xl font-bold text-white">
            Your order is created
          </h1>

          <p className="mb-6 leading-7 text-secondary">
            Your order has been recorded. It is still pending, and payment has
            not been verified by this checkout.
          </p>

          <div className="mb-6 space-y-3 rounded-xl border border-glass-border/50 bg-background/50 p-4 text-left">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm text-secondary">Order reference</span>
              <span className="break-all font-mono text-sm text-accent">
                {createdOrder.orderId}
              </span>
            </div>

            <div className="flex items-center justify-between gap-3">
              <span className="text-sm text-secondary">Order status</span>
              <span className="rounded-full border border-amber-400/30 bg-amber-400/10 px-3 py-1 text-sm text-amber-300">
                {createdOrder.status || "Pending"}
              </span>
            </div>

            <div className="flex items-center justify-between gap-3">
              <span className="text-sm text-secondary">Payment status</span>
              <span className="text-sm text-amber-300">
                {createdOrder.paymentStatus || "Unverified"}
              </span>
            </div>

            <div className="flex items-center justify-between gap-3 border-t border-glass-border/50 pt-3">
              <span className="text-secondary">Order total</span>
              <span className="text-xl font-bold text-accent">
                {formatINR(createdOrder.totalAmount)}
              </span>
            </div>
          </div>

          <p className="mb-6 text-sm text-secondary">
            Do not treat this confirmation as proof of payment. Check your
            order details for the next payment instructions.
          </p>

          <div className="flex flex-col justify-center gap-3 sm:flex-row">
            <Link
              href="/orders"
              className="rounded-xl bg-accent px-6 py-3 font-semibold text-white transition hover:opacity-90"
            >
              View my orders
            </Link>

            <Link
              href="/"
              className="rounded-xl border border-glass-border/50 bg-card px-6 py-3 font-semibold text-white transition hover:bg-accent/10"
            >
              Continue shopping
            </Link>
          </div>
        </section>
      </main>
    );
  }

  if (!currentUser) {
    return (
      <main className="min-h-[80vh] px-4 py-12">
        <section className="mx-auto max-w-xl rounded-2xl border border-glass-border/50 bg-card/60 p-8 text-center">
          <h1 className="mb-3 text-2xl font-bold text-white">
            Sign in to continue
          </h1>

          <p className="mb-6 text-secondary">
            Sign in to place your order and access your order history.
          </p>

          <Link
            href="/login"
            className="inline-flex rounded-xl bg-accent px-6 py-3 font-semibold text-white transition hover:opacity-90"
          >
            Sign in
          </Link>
        </section>
      </main>
    );
  }

  if (!safeItems.length) {
    return (
      <main className="min-h-[80vh] px-4 py-12">
        <section className="mx-auto max-w-xl rounded-2xl border border-glass-border/50 bg-card/60 p-8 text-center">
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-accent/10">
            <svg
              className="h-8 w-8 text-accent"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              aria-hidden="true"
            >
              <path
                d="M3 3h2l2.2 11.2a2 2 0 0 0 2 1.6h7.9a2 2 0 0 0 2-1.6L21 8H6"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <circle cx="10" cy="20" r="1" />
              <circle cx="18" cy="20" r="1" />
            </svg>
          </div>

          <h1 className="mb-3 text-2xl font-bold text-white">
            Your cart is empty
          </h1>

          <p className="mb-6 text-secondary">
            Discover your next game and come back when you're ready to check out.
          </p>

          <Link
            href="/"
            className="inline-flex rounded-xl bg-accent px-6 py-3 font-semibold text-white transition hover:opacity-90"
          >
            Explore games
          </Link>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-[80vh]">
      <div className="container mx-auto max-w-6xl px-4 py-8 sm:py-12">
        <div className="mb-8">
          <p className="mb-2 text-sm font-semibold uppercase tracking-[0.2em] text-accent">
            Nexus Gaming Marketplace
          </p>

          <h1 className="text-3xl font-bold text-white sm:text-4xl">
            Secure checkout
          </h1>

          <p className="mt-3 text-secondary">
            Review your order before submitting it.
          </p>
        </div>

        {error && (
          <div
            role="alert"
            className="mb-6 flex items-start gap-3 rounded-xl border border-red-400/30 bg-red-500/10 p-4 text-red-300"
          >
            <svg
              className="mt-0.5 h-5 w-5 shrink-0"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              aria-hidden="true"
            >
              <circle cx="12" cy="12" r="9" strokeWidth="2" />
              <path
                d="M12 8v5m0 3h.01"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
            <p>{error}</p>
          </div>
        )}

        <div className="grid items-start gap-8 lg:grid-cols-[1.4fr_0.8fr]">
          <div className="space-y-6">
            <section className="rounded-2xl border border-glass-border/50 bg-card/50 p-5 sm:p-6">
              <div className="mb-5 flex items-center justify-between gap-3">
                <h2 className="text-xl font-bold text-white">Order summary</h2>
                <span className="rounded-full bg-accent/10 px-3 py-1 text-sm text-accent">
                  {totalItems} {totalItems === 1 ? "item" : "items"}
                </span>
              </div>

              <div className="divide-y divide-glass-border/50">
                {safeItems.map((item) => {
                  const price = Number(item.price) || 0;
                  const quantity = Number(item.quantity) || 0;

                  return (
                    <div
                      key={item.id}
                      className="flex items-start justify-between gap-4 py-4 first:pt-0 last:pb-0"
                    >
                      <div className="min-w-0 flex-1">
                        <h3 className="break-words font-semibold text-white">
                          {item.title || item.name || "Untitled game"}
                        </h3>

                        <p className="mt-1 text-sm text-secondary">
                          {formatINR(price)} × {quantity}
                        </p>
                      </div>

                      <span className="shrink-0 font-semibold text-accent">
                        {formatINR(price * quantity)}
                      </span>
                    </div>
                  );
                })}
              </div>

              <div className="mt-5 border-t border-glass-border/50 pt-5">
                <div className="flex items-center justify-between gap-4">
                  <span className="text-secondary">Estimated subtotal</span>
                  <span className="text-xl font-bold text-accent">
                    {formatINR(estimatedTotal)}
                  </span>
                </div>

                <p className="mt-3 text-xs leading-5 text-secondary">
                  Final pricing is recalculated by the server when your order
                  is submitted. This estimate is not a payment confirmation.
                </p>
              </div>
            </section>

            <section className="rounded-2xl border border-glass-border/50 bg-card/50 p-5 sm:p-6">
              <h2 className="mb-5 text-xl font-bold text-white">
                Customer information
              </h2>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-xl border border-glass-border/40 bg-background/40 p-4">
                  <p className="mb-1 text-xs uppercase tracking-wider text-secondary">
                    Name
                  </p>
                  <p className="break-words font-medium text-white">
                    {currentUser.displayName ||
                      currentUser.email?.split("@")[0] ||
                      "Customer"}
                  </p>
                </div>

                <div className="rounded-xl border border-glass-border/40 bg-background/40 p-4">
                  <p className="mb-1 text-xs uppercase tracking-wider text-secondary">
                    Email
                  </p>
                  <p className="break-all font-medium text-white">
                    {currentUser.email || "Not provided"}
                  </p>
                </div>
              </div>

              <p className="mt-4 text-sm leading-6 text-secondary">
                Your signed-in account is associated with this order. Check
                your account's order history for updates.
              </p>
            </section>

            <section className="rounded-2xl border border-glass-border/50 bg-card/50 p-5 sm:p-6">
              <h2 className="mb-3 text-xl font-bold text-white">
                Payment information
              </h2>

              <div className="flex items-start gap-3 rounded-xl border border-amber-400/20 bg-amber-400/5 p-4">
                <svg
                  className="mt-0.5 h-5 w-5 shrink-0 text-amber-300"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  aria-hidden="true"
                >
                  <circle cx="12" cy="12" r="9" strokeWidth="1.8" />
                  <path
                    d="M12 8v4m0 4h.01"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                </svg>

                <div>
                  <p className="font-medium text-amber-200">
                    Payment is not processed here
                  </p>
                  <p className="mt-1 text-sm leading-6 text-secondary">
                    Submitting this form creates a pending order. Follow the
                    payment instructions provided by the marketplace. Your
                    order must not be considered paid until payment is verified.
                  </p>
                </div>
              </div>
            </section>
          </div>

          <aside className="lg:sticky lg:top-6">
            <section className="rounded-2xl border border-accent/20 bg-card/70 p-5 shadow-xl sm:p-6">
              <h2 className="mb-5 text-xl font-bold text-white">
                Order total
              </h2>

              <div className="mb-4 flex justify-between gap-4 text-sm">
                <span className="text-secondary">Items</span>
                <span className="text-white">{totalItems}</span>
              </div>

              <div className="mb-5 flex justify-between gap-4 text-sm">
                <span className="text-secondary">Estimated subtotal</span>
                <span className="text-white">
                  {formatINR(estimatedTotal)}
                </span>
              </div>

              <div className="border-t border-glass-border/50 pt-5">
                <div className="flex items-end justify-between gap-4">
                  <span className="text-secondary">Estimated total</span>
                  <span className="text-2xl font-bold text-accent">
                    {formatINR(estimatedTotal)}
                  </span>
                </div>
              </div>

              <form onSubmit={handleSubmit} className="mt-6 space-y-3">
                <button
                  type="submit"
                  disabled={loading || !safeItems.length}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-accent px-5 py-3.5 font-semibold text-white shadow-lg transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {loading && (
                    <span
                      className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white"
                      aria-hidden="true"
                    />
                  )}

                  {loading ? "Creating your order..." : "Place order"}
                </button>

                <Link
                  href="/"
                  className="block w-full rounded-xl border border-glass-border/50 px-5 py-3 text-center font-medium text-white transition hover:bg-accent/10"
                >
                  Continue shopping
                </Link>
              </form>

              <div className="mt-5 flex items-center justify-center gap-2 text-xs text-secondary">
                <svg
                  className="h-4 w-4"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  aria-hidden="true"
                >
                  <rect
                    x="4"
                    y="10"
                    width="16"
                    height="11"
                    rx="2"
                    strokeWidth="1.8"
                  />
                  <path
                    d="M8 10V7a4 4 0 0 1 8 0v3"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                  />
                </svg>
                <span>Authenticated order submission</span>
              </div>
            </section>
          </aside>
        </div>
      </div>
    </main>
  );
}
