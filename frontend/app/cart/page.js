
"use client";

import { useCart } from "@/contexts/CartContext";
import {
  ShoppingCart,
  Trash2,
  Plus,
  Minus,
  ArrowLeft,
  CreditCard,
} from "lucide-react";
import Link from "next/link";

export default function CartPage() {
  const {
    cartItems,
    removeFromCart,
    updateQuantity,
    clearCart,
  } = useCart();

  const handleRemove = (itemId) => {
    removeFromCart(itemId);
  };

  const handleDecrease = (item) => {
    if (item.quantity > 1) {
      updateQuantity(item.id, -1);
    }
  };

  const handleIncrease = (item) => {
    updateQuantity(item.id, 1);
  };

  const handleClear = () => {
    if (
      window.confirm("Are you sure you want to clear your cart?")
    ) {
      clearCart();
    }
  };

  const totalPrice = cartItems.reduce(
    (sum, item) => sum + Number(item.price || 0) * Number(item.quantity || 0),
    0
  );

  const totalItems = cartItems.reduce(
    (sum, item) => sum + Number(item.quantity || 0),
    0
  );

  const formatPrice = (price) =>
    Number(price || 0).toLocaleString("en-IN");

  if (cartItems.length === 0) {
    return (
      <main className="mx-auto flex min-h-[70vh] w-full max-w-7xl flex-col items-center justify-center px-4 py-12 sm:px-6 lg:px-8">
        <div className="mb-5 flex h-20 w-20 items-center justify-center rounded-3xl border border-glass-border bg-accent/10 text-accent">
          <ShoppingCart className="h-9 w-9" />
        </div>

        <h1 className="text-center text-2xl font-bold text-primary sm:text-3xl">
          Your cart is empty
        </h1>

        <p className="mt-3 max-w-md text-center text-sm text-secondary sm:text-base">
          Looks like you have not added any games yet. Explore the
          marketplace and find something you like.
        </p>

        <Link
          href="/games"
          className="mt-7 inline-flex min-h-12 w-full max-w-xs items-center justify-center gap-2 rounded-xl border border-cyan-400/30 bg-cyan-400/10 px-5 py-3 text-center font-semibold text-cyan-300 transition hover:bg-cyan-400/20"
        >
          <ArrowLeft className="h-4 w-4" />
          Continue Shopping
        </Link>
      </main>
    );
  }

  return (
    <main className="min-h-screen w-full min-w-0">
      <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8 lg:py-10">
        <div className="mb-6 flex flex-col gap-4 sm:mb-8 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-300">
              Nexus Marketplace
            </p>

            <h1 className="mt-2 text-2xl font-black text-primary sm:text-3xl lg:text-4xl">
              Your Shopping Cart
            </h1>

            <p className="mt-2 text-sm text-secondary">
              Review your items before proceeding to checkout.
            </p>
          </div>

          <Link
            href="/games"
            className="inline-flex min-h-10 w-fit items-center gap-2 rounded-xl border border-glass-border px-4 py-2 text-sm font-medium text-secondary transition hover:border-cyan-400/30 hover:text-cyan-300"
          >
            <ArrowLeft className="h-4 w-4" />
            Continue Shopping
          </Link>
        </div>

        <div className="grid min-w-0 grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_340px] lg:gap-8">
          {/* Cart items */}
          <section className="min-w-0 space-y-4" aria-label="Cart items">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm text-secondary">
                {totalItems} {totalItems === 1 ? "item" : "items"}
              </p>

              <button
                type="button"
                onClick={handleClear}
                className="inline-flex min-h-10 items-center gap-2 rounded-lg px-3 py-2 text-sm text-red-300 transition hover:bg-red-400/10"
              >
                <Trash2 className="h-4 w-4" />
                Clear cart
              </button>
            </div>

            {cartItems.map((item) => (
              <article
                key={item.id}
                className="glass min-w-0 rounded-2xl p-3 sm:p-5"
              >
                <div className="flex min-w-0 flex-col gap-4 sm:flex-row">
                  <div className="flex min-w-0 items-start gap-3 sm:flex-1 sm:gap-4">
                    <div className="h-20 w-20 shrink-0 overflow-hidden rounded-xl border border-glass-border bg-card sm:h-24 sm:w-24">
                      <img
                        src={
                          item.imageUrl ||
                          "https://placehold.co/160x160/111a2b/00e5ff?text=Game"
                        }
                        alt={item.title || "Game"}
                        loading="lazy"
                        className="h-full w-full object-cover"
                      />
                    </div>

                    <div className="min-w-0 flex-1">
                      <h2 className="break-words text-base font-bold text-primary sm:text-lg">
                        {item.title}
                      </h2>

                      {item.description && (
                        <p className="mt-1 break-words text-sm leading-6 text-secondary">
                          {item.description.length > 120
                            ? `${item.description.substring(0, 120)}...`
                            : item.description}
                        </p>
                      )}

                      <p className="mt-2 font-semibold text-accent">
                        ₹{formatPrice(item.price)}
                      </p>
                    </div>
                  </div>

                  <div className="flex min-w-0 flex-wrap items-center justify-between gap-3 border-t border-glass-border/70 pt-3 sm:w-48 sm:shrink-0 sm:flex-col sm:items-end sm:justify-between sm:border-l sm:border-t-0 sm:pl-4 sm:pt-0">
                    <div className="inline-flex items-center rounded-xl border border-glass-border bg-black/20 p-1">
                      <button
                        type="button"
                        onClick={() => handleDecrease(item)}
                        disabled={item.quantity <= 1}
                        aria-label={`Decrease quantity of ${item.title}`}
                        className="flex h-10 w-10 items-center justify-center rounded-lg text-primary transition hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        <Minus className="h-4 w-4" />
                      </button>

                      <span
                        className="min-w-9 px-2 text-center text-sm font-semibold tabular-nums"
                        aria-label={`Quantity ${item.quantity}`}
                      >
                        {item.quantity}
                      </span>

                      <button
                        type="button"
                        onClick={() => handleIncrease(item)}
                        aria-label={`Increase quantity of ${item.title}`}
                        className="flex h-10 w-10 items-center justify-center rounded-lg text-primary transition hover:bg-white/5"
                      >
                        <Plus className="h-4 w-4" />
                      </button>
                    </div>

                    <div className="flex w-full items-center justify-between gap-3 sm:flex-col sm:items-end">
                      <p className="text-sm font-bold text-primary">
                        ₹
                        {formatPrice(
                          Number(item.price || 0) *
                            Number(item.quantity || 0)
                        )}
                      </p>

                      <button
                        type="button"
                        onClick={() => handleRemove(item.id)}
                        aria-label={`Remove ${item.title} from cart`}
                        className="inline-flex min-h-10 items-center gap-2 rounded-lg px-2 py-2 text-sm text-red-300 transition hover:bg-red-400/10"
                      >
                        <Trash2 className="h-4 w-4" />
                        Remove
                      </button>
                    </div>
                  </div>
                </div>
              </article>
            ))}
          </section>

          {/* Order summary */}
          <aside className="glass min-w-0 rounded-2xl p-5 sm:p-6 lg:sticky lg:top-24">
            <h2 className="text-lg font-bold text-primary">
              Order Summary
            </h2>

            <div className="mt-5 space-y-4">
              <div className="flex items-start justify-between gap-4 text-sm">
                <span className="text-secondary">
                  Items ({totalItems})
                </span>
                <span className="text-right font-medium text-primary">
                  ₹{formatPrice(totalPrice)}
                </span>
              </div>

              <div className="flex items-start justify-between gap-4 text-sm">
                <span className="text-secondary">Delivery</span>
                <span className="text-right font-medium text-emerald-300">
                  Digital delivery
                </span>
              </div>

              <div className="border-t border-glass-border pt-4">
                <div className="flex items-center justify-between gap-4">
                  <span className="font-semibold text-primary">
                    Total
                  </span>
                  <span className="text-xl font-black text-accent sm:text-2xl">
                    ₹{formatPrice(totalPrice)}
                  </span>
                </div>
              </div>
            </div>

            <Link
              href="/checkout"
              className="mt-6 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-accent px-5 py-3 text-center font-bold text-slate-950 transition hover:brightness-110"
            >
              <CreditCard className="h-5 w-5" />
              Proceed to Checkout
            </Link>

            <p className="mt-3 text-center text-xs leading-5 text-secondary">
              Review your order details on the checkout page before
              completing your purchase.
            </p>
          </aside>
        </div>
      </div>
    </main>
  );
}
