import express from "express";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "../../lib/firebaseAdmin.js";
import { requireAdmin } from "../../lib/adminAuthorization.js";

const router = express.Router();

// PATCH /api/admin/orders/:orderId
router.patch("/:orderId", async (req, res) => {
  const auth = await requireAdmin(req);
  if (!auth.ok) return res.status(auth.status).json({ error: auth.error });

  const { orderId } = req.params;
  if (!orderId || orderId.includes("/")) {
    return res.status(400).json({ error: "Invalid order reference." });
  }

  const body = req.body;
  if (!body || typeof body !== "object") {
    return res.status(400).json({ error: "Invalid request body." });
  }

  const decision = body.decision;
  const note =
    typeof body.note === "string" ? body.note.trim().slice(0, 500) : "";

  if (!["approve", "reject"].includes(decision)) {
    return res
      .status(400)
      .json({ error: "Decision must be approve or reject." });
  }

  if (decision === "reject" && !note) {
    return res
      .status(400)
      .json({ error: "Add a short reason when rejecting an order." });
  }

  const ref = adminDb.collection("orders").doc(orderId);

  try {
    const result = await adminDb.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists) {
        throw Object.assign(new Error("Order not found."), { status: 404 });
      }

      const order = snap.data();
      if (order.paymentStatus === "verified" || order.status === "Verified") {
        throw Object.assign(
          new Error("This order has already been marked verified."),
          { status: 409 }
        );
      }

      if (
        !Number.isFinite(order.totalAmount) ||
        order.totalAmount <= 0 ||
        order.currency !== "INR"
      ) {
        throw Object.assign(
          new Error("Order amount is invalid; status cannot be updated."),
          { status: 409 }
        );
      }

      const approved = decision === "approve";
      const updatePayload = {
        paymentStatus: approved ? "verified" : "rejected",
        status: approved ? "Verified" : "Rejected",
        reviewedBy: auth.user.uid,
        reviewedByEmail: auth.user.email || null,
        reviewedAt: FieldValue.serverTimestamp(),
        reviewNote: note || null,
        updatedAt: FieldValue.serverTimestamp(),
      };

      if (order.paymentSubmission) {
        updatePayload.paymentSubmission = {
          ...order.paymentSubmission,
          status: approved ? "approved" : "rejected",
          reviewNote: note || null,
          reviewedBy: auth.user.uid,
          reviewedByEmail: auth.user.email || null,
          reviewedAt: FieldValue.serverTimestamp(),
        };
      }

      tx.update(ref, updatePayload);

      return {
        orderId,
        paymentStatus: updatePayload.paymentStatus,
        status: updatePayload.status,
      };
    });

    return res.json({ ok: true, ...result });
  } catch (error) {
    const status = error?.status || 500;
    if (status !== 500) {
      return res.status(status).json({ error: error.message });
    }
    console.error("Admin order status update failed:", error);
    return res.status(500).json({ error: "Could not update order status." });
  }
});

export default router;
