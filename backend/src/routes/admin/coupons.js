import express from "express";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { adminDb } from "../../lib/firebaseAdmin.js";
import { requireAdmin } from "../../lib/adminAuthorization.js";

const router = express.Router();

const coupons = () => adminDb.collection("coupons");

const normalize = (value) =>
  typeof value === "string" ? value.trim().toUpperCase() : "";

function expiryFromBody(body) {
  if (body.lifetime === true) return null;

  if (
    typeof body.expiresAt !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(body.expiresAt)
  ) {
    throw new Error("Choose an expiration date or select Lifetime.");
  }

  const [year, month, day] = body.expiresAt.split("-").map(Number);
  const date = new Date(year, month - 1, day, 23, 59, 59, 999);

  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    throw new Error("Expiration date is invalid.");
  }

  if (date.getTime() <= Date.now()) {
    throw new Error("Expiration date must be in the future.");
  }

  return Timestamp.fromDate(date);
}

function serialize(snapshot) {
  const data = snapshot.data() || {};

  return {
    code: data.code || snapshot.id,
    discountPercent: data.discountPercent,
    isActive: data.isActive !== false,
    expiresAt: data.expiresAt?.toDate
      ? data.expiresAt.toDate().toISOString().slice(0, 10)
      : null,
    lifetime: data.expiresAt == null,
    createdAt: data.createdAt?.toDate?.()?.toISOString() || null,
    updatedAt: data.updatedAt?.toDate?.()?.toISOString() || null,
  };
}

async function migrateLegacyCoupons() {
  const [settingsSnapshot, mainSnapshot] = await Promise.all([
    adminDb.collection("config").doc("settings").get(),
    adminDb.collection("config").doc("main").get(),
  ]);

  const legacy = [];

  if (settingsSnapshot.exists) {
    const data = settingsSnapshot.data() || {};
    const code = normalize(data.promoCode || data.couponCode);

    if (code) {
      legacy.push({
        code,
        discountPercent:
          Number(data.discountPercent) ||
          (code === "WELCOME12" ? 12 : 10),
        expiresAt: data.expiresAt ?? null,
      });
    }
  }

  if (mainSnapshot.exists) {
    const data = mainSnapshot.data() || {};
    const code = normalize(data.promoCode || data.couponCode);

    if (code) {
      legacy.push({
        code,
        discountPercent: Number(data.discountPercent) || 10,
        expiresAt: data.expiresAt ?? null,
      });
    }
  }

  for (const item of legacy) {
    if (!/^[A-Z0-9_-]{3,30}$/.test(item.code)) {
      console.warn("Skipping invalid legacy coupon code:", item.code);
      continue;
    }

    const reference = coupons().doc(item.code);

    await adminDb.runTransaction(async (transaction) => {
      const existing = await transaction.get(reference);

      if (!existing.exists) {
        transaction.create(reference, {
          code: item.code,
          discountPercent: item.discountPercent,
          isActive: true,
          expiresAt: item.expiresAt,
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
          migratedFrom: "legacy-config",
        });
      }
    });
  }
}

// GET /api/admin/coupons
router.get("/", async (req, res) => {
  const auth = await requireAdmin(req);

  if (!auth.ok) {
    return res.status(auth.status).json({ error: auth.error });
  }

  try {
    await migrateLegacyCoupons();

    const snapshot = await coupons().get();

    const data = snapshot.docs
      .map(serialize)
      .sort((a, b) => a.code.localeCompare(b.code));

    return res
      .set("Cache-Control", "no-store")
      .json({ coupons: data });
  } catch (error) {
    console.error("List coupons failed:", error);

    return res.status(500).json({ error: "Unable to load coupons." });
  }
});

// POST /api/admin/coupons
router.post("/", async (req, res) => {
  const auth = await requireAdmin(req);

  if (!auth.ok) {
    return res.status(auth.status).json({ error: auth.error });
  }

  try {
    const body = req.body || {};
    const code = normalize(body.code);
    const discountPercent = Number(body.discountPercent);

    if (!/^[A-Z0-9_-]{3,30}$/.test(code)) {
      return res.status(400).json({
        error:
          "Code must be 3–30 characters using letters, numbers, _ or -.",
      });
    }

    if (
      !Number.isFinite(discountPercent) ||
      discountPercent < 1 ||
      discountPercent > 99
    ) {
      return res
        .status(400)
        .json({ error: "Discount must be between 1 and 99 percent." });
    }

    let expiresAt;

    try {
      expiresAt = expiryFromBody(body);
    } catch (error) {
      return res.status(400).json({ error: error.message });
    }

    const reference = coupons().doc(code);

    await reference.create({
      code,
      discountPercent,
      isActive: true,
      expiresAt,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    return res.status(201).json({
      ok: true,
      coupon: {
        code,
        discountPercent,
        isActive: true,
        lifetime: expiresAt === null,
        expiresAt:
          expiresAt?.toDate?.().toISOString().slice(0, 10) || null,
      },
    });
  } catch (error) {
    if (error?.code === 6 || error?.code === "already-exists") {
      return res.status(409).json({
        error:
          "That coupon code already exists. Edit the existing coupon instead.",
      });
    }

    console.error("Create coupon failed:", error);

    return res.status(500).json({ error: "Unable to create coupon." });
  }
});

// PATCH /api/admin/coupons/:code
router.patch("/:code", async (req, res) => {
  const auth = await requireAdmin(req);

  if (!auth.ok) {
    return res.status(auth.status).json({ error: auth.error });
  }

  try {
    const code = String(req.params.code || "").trim().toUpperCase();

    if (!/^[A-Z0-9_-]{3,30}$/.test(code)) {
      return res.status(400).json({ error: "Invalid coupon code." });
    }

    const reference = adminDb.collection("coupons").doc(code);
    const snapshot = await reference.get();

    if (!snapshot.exists) {
      return res.status(404).json({ error: "Coupon not found." });
    }

    const body = req.body || {};
    const update = {
      updatedAt: FieldValue.serverTimestamp(),
    };

    if (typeof body.isActive === "boolean") {
      update.isActive = body.isActive;
    }

    if (body.discountPercent !== undefined) {
      const discount = Number(body.discountPercent);

      if (
        !Number.isFinite(discount) ||
        discount < 1 ||
        discount > 99
      ) {
        return res
          .status(400)
          .json({ error: "Discount must be between 1 and 99 percent." });
      }

      update.discountPercent = discount;
    }

    if (body.lifetime === true) {
      update.expiresAt = null;
    } else if (body.expiresAt !== undefined) {
      if (
        typeof body.expiresAt !== "string" ||
        !/^\d{4}-\d{2}-\d{2}$/.test(body.expiresAt)
      ) {
        return res
          .status(400)
          .json({ error: "Choose a valid date or select Lifetime." });
      }

      const [year, month, day] = body.expiresAt.split("-").map(Number);
      const date = new Date(year, month - 1, day, 23, 59, 59, 999);

      if (
        date.getFullYear() !== year ||
        date.getMonth() !== month - 1 ||
        date.getDate() !== day ||
        date.getTime() <= Date.now()
      ) {
        return res
          .status(400)
          .json({ error: "Expiration date must be a valid future date." });
      }

      update.expiresAt = Timestamp.fromDate(date);
    }

    await reference.update(update);

    const savedSnapshot = await reference.get();
    const saved = savedSnapshot.data() || {};

    return res.json({
      ok: true,
      coupon: {
        code,
        discountPercent: saved.discountPercent,
        isActive: saved.isActive !== false,
        lifetime: saved.expiresAt == null,
        expiresAt: saved.expiresAt?.toDate
          ? saved.expiresAt.toDate().toISOString().slice(0, 10)
          : null,
      },
    });
  } catch (error) {
    console.error("Update coupon failed:", error);

    return res.status(500).json({ error: "Unable to update coupon." });
  }
});

export default router;
