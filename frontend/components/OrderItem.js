
"use client";

import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Clock3,
  CreditCard,
  Package,
  ReceiptText,
} from "lucide-react";

function formatDate(value) {
  if (!value) return "Date unavailable";

  let date;

  if (typeof value.toDate === "function") {
    date = value.toDate();
  } else if (typeof value.seconds === "number") {
    date = new Date(value.seconds * 1000);
  } else {
    date = new Date(value);
  }

  if (Number.isNaN(date.getTime())) return "Date unavailable";

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

function getOrderStatus(status) {
  const normalized = String(status || "Pending").toLowerCase();

  if (normalized === "verified" || normalized === "completed") {
    return {
      label: status,
      Icon: CheckCircle2,
      color: "text-green-400",
      background: "bg-green-500/10",
      border: "border-green-500/30",
    };
  }

  if (normalized === "rejected" || normalized === "cancelled") {
    return {
      label: status,
      Icon: XCircle,
      color: "text-red-400",
      background: "bg-red-500/10",
      border: "border-red-500/30",
    };
  }

  if (normalized === "expired") {
    return {
      label: "Expired",
      Icon: AlertTriangle,
      color: "text-orange-400",
      background: "bg-orange-500/10",
      border: "border-orange-500/30",
    };
  }

  return {
    label: status || "Pending",
    Icon: Clock3,
    color: "text-yellow-300",
    background: "bg-yellow-500/10",
    border: "border-yellow-500/30",
  };
}

function getPaymentStatus(paymentStatus) {
  const normalized = String(paymentStatus || "unverified").toLowerCase();

  if (normalized === "verified" || normalized === "paid") {
    return {
      label: "Payment verified",
      description: "The store has confirmed receipt of your payment.",
      Icon: CheckCircle2,
      color: "text-green-400",
      background: "bg-green-500/10",
      border: "border-green-500/30",
    };
  }

  if (
    normalized === "awaiting_verification" ||
    normalized === "submitted"
  ) {
    return {
      label: "Awaiting verification",
      description:
        "Your payment details have been submitted and are awaiting review.",
      Icon: Clock3,
      color: "text-yellow-300",
      background: "bg-yellow-500/10",
      border: "border-yellow-500/30",
    };
  }

  if (normalized === "rejected") {
    return {
      label: "Payment submission rejected",
      description:
        "Your submitted payment details were rejected. Check the review note or contact support before submitting again.",
      Icon: XCircle,
      color: "text-red-400",
      background: "bg-red-500/10",
      border: "border-red-500/30",
    };
  }

  return {
    label: "Not yet verified",
    description:
      "The store has not confirmed this payment. If you have paid, submit your transaction reference below.",
    Icon: CreditCard,
    color: "text-secondary",
    background: "bg-card/40",
    border: "border-glass-border/50",
  };
}

export default function OrderItem({ order = {} }) {
  const items = Array.isArray(order.items) ? order.items : [];

  const orderReference = order.orderId || order.id || "Unavailable";
  const paymentReference =
    order.paymentReference || order.paymentId || order.id || "Unavailable";

  const orderStatus = getOrderStatus(order.status);
  const paymentStatus = getPaymentStatus(order.paymentStatus);

  const OrderStatusIcon = orderStatus.Icon;
  const PaymentStatusIcon = paymentStatus.Icon;

  const totalAmount = Number(order.totalAmount ?? order.subtotal ?? 0);
  const safeTotal = Number.isFinite(totalAmount) ? totalAmount : 0;

  return (
    <div className="space-y-5">
      {/* Order header */}
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="mb-2 flex items-center gap-2 text-sm text-secondary">
            <ReceiptText className="h-4 w-4" aria-hidden="true" />
            Order reference
          </div>

          <h2 className="break-all text-lg font-bold sm:text-xl">
            #{orderReference}
          </h2>

          <p className="mt-2 text-sm text-secondary">
            Placed on {formatDate(order.createdAt)}
          </p>
        </div>

        <span
          className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-medium ${orderStatus.background} ${orderStatus.border} ${orderStatus.color}`}
        >
          <OrderStatusIcon className="h-4 w-4" aria-hidden="true" />
          {orderStatus.label}
        </span>
      </header>

      {/* Purchased items */}
      <section aria-label="Order items">
        <h3 className="mb-3 flex items-center gap-2 font-semibold">
          <Package className="h-4 w-4 text-accent" aria-hidden="true" />
          Items
        </h3>

        {items.length === 0 ? (
          <p className="rounded-lg border border-glass-border/50 p-3 text-sm text-secondary">
            Item details are unavailable for this order.
          </p>
        ) : (
          <div className="divide-y divide-glass-border/50 rounded-lg border border-glass-border/50">
            {items.map((item, index) => {
              const quantity = Math.max(
                0,
                Number(item?.quantity ?? 1) || 1
              );
              const price = Number(item?.price ?? 0);
              const safePrice = Number.isFinite(price) ? price : 0;

              return (
                <div
                  key={item?.id || item?.gameId || `${orderReference}-${index}`}
                  className="flex flex-wrap items-start justify-between gap-3 p-3"
                >
                  <div className="min-w-0">
                    <p className="break-words font-medium">
                      {item?.title || item?.name || "Game item"}
                    </p>

                    <p className="mt-1 text-sm text-secondary">
                      {formatMoney(safePrice)} × {quantity}
                    </p>
                  </div>

                  <p className="shrink-0 text-sm font-semibold">
                    {formatMoney(safePrice * quantity)}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Payment status */}
      <section
        className={`rounded-lg border p-4 ${paymentStatus.background} ${paymentStatus.border}`}
        aria-label="Payment status"
      >
        <div className="flex items-start gap-3">
          <PaymentStatusIcon
            className={`mt-0.5 h-5 w-5 shrink-0 ${paymentStatus.color}`}
            aria-hidden="true"
          />

          <div className="min-w-0">
            <h3 className={`font-semibold ${paymentStatus.color}`}>
              {paymentStatus.label}
            </h3>

            <p className="mt-1 text-sm text-secondary">
              {paymentStatus.description}
            </p>
          </div>
        </div>
      </section>

      {/* Payment and order totals */}
      <section aria-label="Order summary">
        <h3 className="mb-3 font-semibold">Order summary</h3>

        <div className="space-y-2 rounded-lg border border-glass-border/50 p-4 text-sm">
          <div className="flex flex-wrap justify-between gap-2">
            <span className="text-secondary">Payment reference</span>
            <span className="break-all text-right font-mono">
              {paymentReference}
            </span>
          </div>

          {order.promoCodeUsed && (
            <div className="flex flex-wrap justify-between gap-2">
              <span className="text-secondary">Promo code</span>
              <span>{order.promoCodeUsed}</span>
            </div>
          )}

          {Number.isFinite(Number(order.subtotal)) &&
            order.subtotal !== undefined && (
              <div className="flex flex-wrap justify-between gap-2">
                <span className="text-secondary">Subtotal</span>
                <span>{formatMoney(order.subtotal)}</span>
              </div>
            )}

          <div className="flex flex-wrap justify-between gap-2 border-t border-glass-border/50 pt-3">
            <span className="font-semibold">Total</span>
            <span className="text-lg font-bold">
              {formatMoney(safeTotal)}
            </span>
          </div>
        </div>
      </section>

      {/* Customer-facing next steps */}
      {order.paymentStatus === "verified" ||
      order.status === "Verified" ? (
        <div className="rounded-lg bg-green-500/10 p-4 text-sm text-green-300">
          <p className="font-semibold">Payment confirmed</p>
          <p className="mt-1">
            Your payment has been verified. Any game delivery or credential
            sharing will follow the store's fulfilment process.
          </p>
        </div>
      ) : order.paymentStatus === "awaiting_verification" ? (
        <div className="rounded-lg bg-yellow-500/10 p-4 text-sm text-yellow-200">
          <p className="font-semibold">Payment review in progress</p>
          <p className="mt-1">
            No further submission is needed unless the store contacts you.
          </p>
        </div>
      ) : order.paymentStatus === "rejected" ? (
        <div className="rounded-lg bg-red-500/10 p-4 text-sm text-red-300">
          <p className="font-semibold">Payment needs attention</p>
          <p className="mt-1">
            Review the rejection message if available. If you believe the
            transaction was successful, contact support before trying again.
          </p>
        </div>
      ) : order.status === "expired" ? (
        <div className="rounded-lg bg-orange-500/10 p-4 text-sm text-orange-300">
          <p className="font-semibold">Order expired</p>
          <p className="mt-1">
            This order has expired. Check the marketplace for the current
            availability before placing a new order.
          </p>
        </div>
      ) : null}
    </div>
  );
}
