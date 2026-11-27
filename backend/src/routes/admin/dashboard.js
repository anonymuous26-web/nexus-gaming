import express from "express";
import { adminDb } from "../../lib/firebaseAdmin.js";
import { requireAdmin } from "../../lib/adminAuthorization.js";

const router = express.Router();

function toMillis(value) {
  if (!value) return 0;
  if (typeof value.toMillis === "function") return value.toMillis();
  if (typeof value.seconds === "number") return value.seconds * 1000;

  const result = new Date(value).getTime();
  return Number.isFinite(result) ? result : 0;
}

// GET /api/admin/dashboard
router.get("/", async (req, res) => {
  const auth = await requireAdmin(req);

  if (!auth.ok) {
    return res.status(auth.status).json({ error: auth.error });
  }

  try {
    const [ordersSnapshot, gamesSnapshot] = await Promise.all([
      adminDb.collection("orders").get(),
      adminDb.collection("games").get(),
    ]);

    const orders = ordersSnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    const isVerified = (order) =>
      String(order.paymentStatus || order.status || "").toLowerCase() ===
      "verified";

    const verified = orders.filter(isVerified);

    const pendingOrders = orders.filter(
      (order) => String(order.status || "").toLowerCase() === "pending"
    );

    const pendingPayments = orders.filter((order) => {
      const paymentStatus = String(order.paymentStatus || "").toLowerCase();
      const submissionStatus = String(
        order.paymentSubmission?.status || ""
      ).toLowerCase();

      return (
        paymentStatus === "awaiting_verification" ||
        submissionStatus === "submitted"
      );
    });

    const rejectedPayments = orders.filter((order) => {
      const paymentStatus = String(order.paymentStatus || "").toLowerCase();
      const submissionStatus = String(
        order.paymentSubmission?.status || ""
      ).toLowerCase();

      return paymentStatus === "rejected" || submissionStatus === "rejected";
    });

    const recentOrders = [...orders]
      .sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt))
      .slice(0, 5)
      .map((order) => ({
        ...order,
        createdAt: toMillis(order.createdAt),
        updatedAt: toMillis(order.updatedAt),
      }));

    const stats = {
      totalRevenue: verified.reduce(
        (sum, order) => sum + (Number(order.totalAmount) || 0),
        0
      ),
      pendingOrders: pendingOrders.length,
      pendingPayments: pendingPayments.length,
      verifiedOrders: verified.length,
      rejectedPayments: rejectedPayments.length,
      totalGames: gamesSnapshot.size,
    };

    return res
      .set("Cache-Control", "no-store")
      .json({ stats, recentOrders });
  } catch (error) {
    console.error("Admin dashboard API failed:", error);

    return res
      .status(500)
      .json({ error: "Unable to load dashboard metrics from the server." });
  }
});

export default router;
