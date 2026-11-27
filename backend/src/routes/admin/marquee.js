import express from "express";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { adminDb } from "../../lib/firebaseAdmin.js";
import { requireAdmin } from "../../lib/adminAuthorization.js";

const router = express.Router();

const configRef = () => adminDb.collection("config").doc("settings");

// GET /api/admin/marquee
router.get("/", async (req, res) => {
  const auth = await requireAdmin(req);

  if (!auth.ok) {
    return res.status(auth.status).json({ error: auth.error });
  }

  try {
    const snapshot = await configRef().get();

    if (!snapshot.exists) {
      return res.json({
        config: {
          marqueeText: "Welcome to Nexus Gaming!",
          promoCode: "WELCOME12",
          expiresAt: null,
        },
      });
    }

    const data = snapshot.data();

    return res.json({
      config: {
        marqueeText: data.marqueeText || "",
        promoCode: data.promoCode || data.couponCode || "",
        expiresAt: data.expiresAt?.toDate
          ? data.expiresAt.toDate().toISOString().slice(0, 10)
          : typeof data.expiresAt === "string"
            ? data.expiresAt.slice(0, 10)
            : null,
      },
    });
  } catch (error) {
    console.error("Load marquee configuration failed:", error);

    return res
      .status(500)
      .json({ error: "Unable to load marquee configuration." });
  }
});

// PUT /api/admin/marquee
router.put("/", async (req, res) => {
  const auth = await requireAdmin(req);

  if (!auth.ok) {
    return res.status(auth.status).json({ error: auth.error });
  }

  try {
    const body = req.body || {};

    if (typeof body.marqueeText === "string") {
      const marqueeText = body.marqueeText.trim();

      if (!marqueeText || marqueeText.length > 200) {
        return res
          .status(400)
          .json({ error: "Marquee text must contain 1–200 characters." });
      }

      await configRef().set(
        {
          marqueeText,
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

      return res.json({ ok: true });
    }

    const promoCode = String(
      body.promoCode || body.couponCode || ""
    )
      .trim()
      .toUpperCase();

    const expirationDate = String(body.expiresAt || "");

    if (!promoCode || !expirationDate) {
      return res.status(400).json({
        error:
          "For legacy coupon updates, provide a coupon code and expiration date. Manage new coupons through the coupons API.",
      });
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(expirationDate)) {
      return res
        .status(400)
        .json({ error: "Invalid expiration date. Use YYYY-MM-DD." });
    }

    const [year, month, day] = expirationDate.split("-").map(Number);
    const endOfDay = new Date(year, month - 1, day, 23, 59, 59, 999);

    if (
      endOfDay.getFullYear() !== year ||
      endOfDay.getMonth() !== month - 1 ||
      endOfDay.getDate() !== day
    ) {
      return res
        .status(400)
        .json({ error: "The expiration date is invalid." });
    }

    await configRef().set(
      {
        promoCode,
        expiresAt: Timestamp.fromDate(endOfDay),
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    return res.json({ ok: true });
  } catch (error) {
    console.error("Save marquee configuration failed:", error);

    return res
      .status(500)
      .json({ error: "Unable to save configuration. Check server logs." });
  }
});

export default router;
