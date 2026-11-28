"use client";

import { useState } from "react";
import { CheckCircle, AlertTriangle } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { apiUrl } from "@/lib/api";

function formatDateTime(value) {
  if (!value) return "Date unavailable";

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

  if (Number.isNaN(date.getTime())) return "Date unavailable";

  return date.toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function formatItemsSummary(items) {
  if (!Array.isArray(items) || items.length === 0) {
    return { countLabel: "0 items", namesLabel: "No item details" };
  }

  const totalCount = items.reduce(
    (sum, item) => sum + (Number(item?.quantity) > 0 ? Number(item.quantity) : 1),
    0
  );

  const countLabel = `${totalCount} ${totalCount === 1 ? "item" : "items"}`;
  const namesLabel = items
    .map((item) => {
      const title = item?.title || item?.name || "Game";
      const qty = Number(item?.quantity) > 1 ? ` × ${Number(item.quantity)}` : "";
      return `${title}${qty}`;
    })
    .join(", ");

  return { countLabel, namesLabel };
}

function getStatusBadgeClass(status) {
  const normalized = String(status || "").toLowerCase();

  if (normalized === "pending") return "bg-accent/20 text-accent";
  if (normalized === "verified") return "bg-green-500/20 text-green-400";
  if (normalized === "rejected") return "bg-red-500/20 text-red-400";
  return "bg-orange-500/20 text-orange-400";
}

export default function RecentOrders({ orders, onOrderUpdated }) {
  const auth = useAuth();
  const firebaseUser = auth?.firebaseUser || auth?.currentUser || null;

  const [busyId, setBusyId] = useState("");
  const [actionError, setActionError] = useState("");

  if (!orders || orders.length === 0) {
    return (
      <div className="min-h-[40vh] flex flex-col items-center justify-center py-12">
        <p className="text-secondary text-center">No recent orders</p>
      </div>
    );
  }

  async function handleOrderDecision(order, decision) {
    if (!firebaseUser || busyId) return;

    const orderRef = order.orderId || order.id;
    let note = "";

    if (decision === "reject") {
      const input = window.prompt(
        `Enter a short reason for rejecting order #${orderRef}:`
      );
      if (input === null) return;
      note = input.trim();
      if (!note) {
        setActionError("A rejection reason is required.");
        return;
      }
    } else {
      const confirmed = window.confirm(
        `Verify payment of ₹${Number(order.totalAmount || 0).toFixed(2)} for order #${orderRef}?`
      );
      if (!confirmed) return;
    }

    setBusyId(order.id);
    setActionError("");

    try {
      const token = await firebaseUser.getIdToken();
      const response = await fetch(
        apiUrl(`/api/admin/orders/${encodeURIComponent(order.id)}`),
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ decision, note }),
        }
      );

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || "Failed to update order status.");
      }

      onOrderUpdated?.();
    } catch (error) {
      console.error("Error updating order status:", error);
      setActionError(
        error instanceof Error ? error.message : "Failed to update order status."
      );
    } finally {
      setBusyId("");
    }
  }

  return (
    <div className="space-y-4">
      {actionError && (
        <div
          role="alert"
          className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300"
        >
          {actionError}
        </div>
      )}

      <div className="space-y-4">
        {orders.map((order) => {
          const { countLabel, namesLabel } = formatItemsSummary(order.items);
          const isPending =
            String(order.status || "").toLowerCase() === "pending";
          const isBusy = busyId === order.id;

          return (
            <div
              key={order.id}
              className="p-4 bg-card/50 glass rounded-xl border border-glass-border/50 transition-all duration-300"
            >
              <div className="flex flex-wrap justify-between items-start gap-3 mb-3">
                <div className="flex-1 min-w-0">
                  <h4 className="font-medium text-accent break-all">
                    Order #{order.orderId || order.id}
                  </h4>
                  <p className="text-sm text-secondary mt-0.5">
                    {formatDateTime(order.createdAt)}
                  </p>
                </div>
                <span
                  className={`text-xs px-3 py-1.5 rounded-full font-medium ${getStatusBadgeClass(
                    order.status
                  )}`}
                >
                  {order.status || "Pending"}
                </span>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="min-w-0">
                  <p className="font-medium text-secondary mb-1">
                    Items ({countLabel}):
                  </p>
                  <p className="text-sm text-secondary break-words">
                    {namesLabel}
                  </p>
                </div>
                <div>
                  <p className="font-medium text-secondary mb-1">Amount:</p>
                  <p className="text-accent font-bold">
                    ₹{Number(order.totalAmount || 0).toFixed(2)}
                  </p>
                </div>
              </div>

              {isPending && (
                <div className="mt-4 flex gap-3">
                  <button
                    type="button"
                    disabled={isBusy || Boolean(busyId)}
                    onClick={() => handleOrderDecision(order, "approve")}
                    className="flex-1 px-4 py-2 bg-green-500/20 text-green-400 flex items-center justify-center gap-2 border border-green-500/30 rounded text-sm font-medium transition-all duration-200 hover:bg-green-500/30 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <CheckCircle className="h-4 w-4" />
                    {isBusy ? "Saving..." : "Verify"}
                  </button>
                  <button
                    type="button"
                    disabled={isBusy || Boolean(busyId)}
                    onClick={() => handleOrderDecision(order, "reject")}
                    className="flex-1 px-4 py-2 bg-red-500/20 text-red-400 flex items-center justify-center gap-2 border border-red-500/30 rounded text-sm font-medium transition-all duration-200 hover:bg-red-500/30 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <AlertTriangle className="h-4 w-4" />
                    Reject
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
