"use client";

import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { apiUrl } from "@/lib/api";

export default function PaymentSubmissionForm({ order, onSubmitted }) {
  const { firebaseUser } = useAuth();
  const [utr, setUtr] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const alreadySubmitted = order.paymentStatus === "awaiting_verification" || order.paymentSubmission?.status === "submitted";
  const isPaid = order.paymentStatus === "verified" || order.status === "Verified";
  if (alreadySubmitted || isPaid) {
    return <p className="mt-3 text-sm text-secondary">{isPaid ? "Payment verified." : "Payment details submitted. Awaiting admin verification."}</p>;
  }

  async function submit(event) {
    event.preventDefault();
    setBusy(true); setError(""); setMessage("");
    try {
      if (!firebaseUser) throw new Error("Please sign in again.");
      const form = new FormData();
      form.set("utr", utr);
      const token = await firebaseUser.getIdToken();
      const response = await fetch(
        apiUrl(`/api/orders/${encodeURIComponent(order.id)}/payment-submission`),
        {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Could not submit payment details.");
      setMessage(data.message || "Submitted for review.");
      setUtr("");
      event.currentTarget.reset();
      onSubmitted?.();
    } catch (e) { setError(e.message || "Submission failed."); }
    finally { setBusy(false); }
  }

  return (
    <form onSubmit={submit} className="mt-4 space-y-3 border-t border-glass-border/50 pt-4">
      <h4 className="font-semibold">Submit UPI payment details</h4>
      <p className="text-sm text-secondary">Order amount: <strong>₹{Number(order.totalAmount || 0).toFixed(2)}</strong>. Enter the UTR/transaction reference from your UPI app. A screenshot is optional. The order remains unpaid until the store verifies the transaction.</p>
      <label className="block text-sm">UPI transaction reference / UTR
        <input required value={utr} onChange={(e) => setUtr(e.target.value)} minLength={8} maxLength={35} autoComplete="off" className="mt-1 w-full rounded-lg border border-glass-border bg-card px-3 py-2" placeholder="e.g. 123456789012" />
      </label>
      {error && <p role="alert" className="text-sm text-red-400">{error}</p>}
      {message && <p role="status" className="text-sm text-green-400">{message}</p>}
      <button disabled={busy} className="rounded-lg bg-accent px-4 py-2 font-semibold text-black disabled:opacity-50">{busy ? "Submitting…" : "Submit payment details"}</button>
    </form>
  );
}