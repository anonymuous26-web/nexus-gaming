import { createHash } from "node:crypto";
import express from "express";
import multer from "multer";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { adminDb, adminStorage, verifyRequestUser } from "../lib/firebaseAdmin.js";

const router = express.Router();

const MAX_ITEMS = 30;
const MAX_QUANTITY_PER_ITEM = 10;
const MAX_GAME_ID_LENGTH = 150;
const MAX_TITLE_LENGTH = 200;
const PAYMENT_WINDOW_MS = 3 * 60 * 1000;

const MAX_SCREENSHOT_BYTES = 5 * 1024 * 1024;
const UTR_PATTERN = /^[A-Z0-9-]{8,35}$/;

const ORDERS_COLLECTION = "orders";
const GAMES_COLLECTION = "games";
const COUPONS_COLLECTION = "coupons";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_SCREENSHOT_BYTES },
});

class OrderValidationError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.name = "OrderValidationError";
    this.status = status;
  }
}

function money(value) {
  if (!Number.isFinite(value)) {
    throw new OrderValidationError("The order amount is invalid.");
  }

  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function normalizePromoCode(value) {
  return typeof value === "string" ? value.trim().toUpperCase() : "";
}

function validGameId(value) {
  return (
    typeof value === "string" &&
    value.trim().length > 0 &&
    value.trim().length <= MAX_GAME_ID_LENGTH &&
    !value.includes("/") &&
    !value.includes("\\")
  );
}

function getCartGameId(item) {
  return item?.gameId ?? item?.productId ?? item?.id;
}

function getExpiryMillis(value) {
  if (value == null) return null;

  if (typeof value.toMillis === "function") {
    return value.toMillis();
  }

  if (value instanceof Date) {
    return value.getTime();
  }

  if (typeof value === "string" || typeof value === "number") {
    const result = new Date(value).getTime();
    return Number.isFinite(result) ? result : NaN;
  }

  return NaN;
}

function millis(value) {
  if (value?.toMillis) return value.toMillis();
  if (value?.seconds) return value.seconds * 1000;
  const n = new Date(value || 0).getTime();
  return Number.isFinite(n) ? n : 0;
}

function validateCartItems(items) {
  if (
    !Array.isArray(items) ||
    items.length < 1 ||
    items.length > MAX_ITEMS
  ) {
    throw new OrderValidationError(
      "Your cart is empty or contains too many items."
    );
  }

  const quantities = new Map();

  for (const item of items) {
    const rawGameId = getCartGameId(item);

    if (!validGameId(rawGameId)) {
      throw new OrderValidationError(
        "One or more cart items are invalid."
      );
    }

    const gameId = rawGameId.trim();
    const quantity = item.quantity;

    if (
      !Number.isSafeInteger(quantity) ||
      quantity < 1 ||
      quantity > MAX_QUANTITY_PER_ITEM
    ) {
      throw new OrderValidationError(
        `Quantity must be between 1 and ${MAX_QUANTITY_PER_ITEM}.`
      );
    }

    const combined = (quantities.get(gameId) || 0) + quantity;

    if (combined > MAX_QUANTITY_PER_ITEM) {
      throw new OrderValidationError(
        `A game cannot be ordered more than ${MAX_QUANTITY_PER_ITEM} times.`
      );
    }

    quantities.set(gameId, combined);
  }

  return quantities;
}

function validateCouponSnapshot(snapshot, submittedCode, nowMillis) {
  if (!snapshot?.exists) {
    throw new OrderValidationError("The promo code is invalid or expired.");
  }

  const coupon = snapshot.data() || {};
  const code = normalizePromoCode(coupon.code || snapshot.id);
  const discountPercent = Number(coupon.discountPercent);

  if (
    code !== submittedCode ||
    coupon.isActive !== true ||
    !Number.isInteger(discountPercent) ||
    discountPercent < 1 ||
    discountPercent > 99
  ) {
    throw new OrderValidationError("The promo code is invalid or expired.");
  }

  if (coupon.expiresAt != null) {
    const expiryMillis = getExpiryMillis(coupon.expiresAt);

    if (
      !Number.isFinite(expiryMillis) ||
      expiryMillis <= nowMillis
    ) {
      throw new OrderValidationError("The promo code is invalid or expired.");
    }
  }

  return { code, discountPercent };
}

function calculateTotals(items, discountPercent) {
  const subtotal = money(
    items.reduce((sum, item) => sum + item.subtotal, 0)
  );

  if (subtotal <= 0) {
    throw new OrderValidationError(
      "The order total must be greater than zero."
    );
  }

  const discountAmount = money(
    subtotal * (discountPercent / 100)
  );

  const totalAmount = money(subtotal - discountAmount);

  if (totalAmount <= 0) {
    throw new OrderValidationError(
      "The final order amount must be greater than zero."
    );
  }

  return { subtotal, discountAmount, totalAmount };
}

const normalizeUtr = (value) =>
  String(value || "").trim().toUpperCase().replace(/\s+/g, "");
const claimId = (utr) => createHash("sha256").update(utr).digest("hex");

// POST /api/orders
router.post("/", async (req, res) => {
  try {
    const user = await verifyRequestUser(req);

    if (!user?.uid) {
      return res
        .status(401)
        .json({ error: "Please sign in before placing an order." });
    }

    const body = req.body;

    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return res.status(400).json({ error: "Invalid request body." });
    }

    const quantities = validateCartItems(body.items);
    const gameEntries = [...quantities.entries()];
    const suppliedPromoCode = normalizePromoCode(body.promoCode);

    if (
      suppliedPromoCode &&
      !/^[A-Z0-9_-]{3,30}$/.test(suppliedPromoCode)
    ) {
      return res.status(400).json({ error: "The promo code format is invalid." });
    }

    const orderRef = adminDb.collection(ORDERS_COLLECTION).doc();

    const couponRef = suppliedPromoCode
      ? adminDb.collection(COUPONS_COLLECTION).doc(suppliedPromoCode)
      : null;

    const now = Timestamp.now();
    const paymentExpiresAt = Timestamp.fromMillis(
      now.toMillis() + PAYMENT_WINDOW_MS
    );

    const createdOrder = await adminDb.runTransaction(
      async (transaction) => {
        const couponSnapshot = suppliedPromoCode
          ? await transaction.get(couponRef)
          : null;

        const gameSnapshots = await Promise.all(
          gameEntries.map(([gameId]) =>
            transaction.get(
              adminDb.collection(GAMES_COLLECTION).doc(gameId)
            )
          )
        );

        let appliedPromoCode = null;
        let discountPercent = 0;

        if (suppliedPromoCode) {
          const coupon = validateCouponSnapshot(
            couponSnapshot,
            suppliedPromoCode,
            now.toMillis()
          );

          appliedPromoCode = coupon.code;
          discountPercent = coupon.discountPercent;
        }

        const items = gameSnapshots.map((snapshot, index) => {
          const [gameId, quantity] = gameEntries[index];

          if (!snapshot.exists) {
            throw new OrderValidationError(
              "A game in your cart is no longer available. Refresh your cart."
            );
          }

          const game = snapshot.data() || {};
          const rawPrice = game.price;

          if (
            typeof rawPrice !== "number" ||
            !Number.isFinite(rawPrice) ||
            rawPrice <= 0
          ) {
            throw new OrderValidationError(
              "A game has an invalid price. Please contact support."
            );
          }

          if (
            game.available === false ||
            game.inStock === false ||
            game.active === false ||
            game.isActive === false
          ) {
            throw new OrderValidationError(
              `${game.title || "A game"} is currently unavailable.`
            );
          }

          if (game.stockCount != null) {
            if (
              !Number.isSafeInteger(game.stockCount) ||
              game.stockCount < 0 ||
              game.stockCount < quantity
            ) {
              throw new OrderValidationError(
                `${game.title || "A game"} does not have enough stock.`
              );
            }
          }

          const price = money(rawPrice);
          const subtotal = money(price * quantity);

          if (subtotal <= 0) {
            throw new OrderValidationError(
              "The final order amount is invalid."
            );
          }

          return {
            gameId,
            title: String(game.title || game.name || "Game").slice(
              0,
              MAX_TITLE_LENGTH
            ),
            price,
            quantity,
            subtotal,
          };
        });

        const totals = calculateTotals(items, discountPercent);

        const orderData = {
          orderId: orderRef.id,
          userId: user.uid,
          items,
          subtotal: totals.subtotal,
          promoCodeUsed: appliedPromoCode,
          discountPercent,
          discountAmount: totals.discountAmount,
          totalAmount: totals.totalAmount,
          currency: "INR",

          status: "Pending",
          paymentStatus: "unverified",
          paymentMethod: "manual_upi",
          paymentReference: orderRef.id,

          createdAt: now,
          expiresAt: paymentExpiresAt,
          updatedAt: FieldValue.serverTimestamp(),
        };

        transaction.create(orderRef, orderData);

        return {
          orderId: orderRef.id,
          paymentReference: orderRef.id,
          items,
          subtotal: totals.subtotal,
          promoCode: appliedPromoCode,
          discountPercent,
          discountAmount: totals.discountAmount,
          totalAmount: totals.totalAmount,
          currency: "INR",
          status: "Pending",
          paymentStatus: "unverified",
          expiresAt: paymentExpiresAt.toMillis(),
        };
      }
    );

    return res
      .status(201)
      .set("Cache-Control", "no-store")
      .json(createdOrder);
  } catch (error) {
    if (error instanceof OrderValidationError) {
      return res.status(error.status).json({ error: error.message });
    }

    console.error("Order creation failed:", error);

    return res
      .status(500)
      .json({ error: "Could not create your order. Please try again." });
  }
});

// GET /api/orders/mine
router.get("/mine", async (req, res) => {
  const user = await verifyRequestUser(req);
  if (!user?.uid) {
    return res.status(401).json({ error: "Sign in required." });
  }

  try {
    const snap = await adminDb
      .collection("orders")
      .where("userId", "==", user.uid)
      .get();

    const orders = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    orders.sort((a, b) => millis(b.createdAt) - millis(a.createdAt));

    return res.json({ orders });
  } catch (error) {
    console.error("Customer order history failed:", error);
    return res.status(500).json({ error: "Could not load your orders." });
  }
});

// POST /api/orders/:orderId/payment-submission
router.post(
  "/:orderId/payment-submission",
  (req, res, next) => {
    upload.single("screenshot")(req, res, (err) => {
      if (err) {
        if (err instanceof multer.MulterError && err.code === "LIMIT_FILE_SIZE") {
          return res
            .status(400)
            .json({ error: "Screenshot must be 5 MB or smaller." });
        }
        return res.status(400).json({ error: "Invalid screenshot upload." });
      }
      return next();
    });
  },
  async (req, res) => {
    let uploadedPath = null;
    try {
      const user = await verifyRequestUser(req);
      if (!user?.uid) {
        return res
          .status(401)
          .json({ error: "Please sign in to submit payment details." });
      }

      const { orderId } = req.params;
      if (!orderId || orderId.includes("/")) {
        return res.status(400).json({ error: "Invalid order reference." });
      }

      const utr = normalizeUtr(req.body?.utr);
      const screenshot = req.file;

      if (!UTR_PATTERN.test(utr)) {
        return res.status(400).json({
          error:
            "Enter a valid UPI transaction reference (8–35 letters, numbers or hyphens). ",
        });
      }

      const hasScreenshot = Boolean(screenshot && screenshot.size > 0);
      if (hasScreenshot && screenshot.size > MAX_SCREENSHOT_BYTES) {
        return res
          .status(400)
          .json({ error: "Screenshot must be 5 MB or smaller." });
      }
      if (
        hasScreenshot &&
        !["image/jpeg", "image/png", "image/webp"].includes(screenshot.mimetype)
      ) {
        return res
          .status(400)
          .json({ error: "Screenshot must be a JPG, PNG or WebP image." });
      }

      const orderRef = adminDb.collection("orders").doc(orderId);
      const claimRef = adminDb.collection("paymentUtrClaims").doc(claimId(utr));
      const orderSnap = await orderRef.get();

      if (!orderSnap.exists) {
        return res.status(404).json({ error: "Order not found." });
      }

      const order = orderSnap.data();
      if (order.userId !== user.uid) {
        return res
          .status(403)
          .json({ error: "You cannot submit payment for this order." });
      }
      if (order.paymentStatus === "verified" || order.status === "Verified") {
        return res
          .status(409)
          .json({ error: "This order is already marked as paid." });
      }
      if (
        order.paymentStatus === "awaiting_verification" ||
        order.paymentSubmission?.status === "submitted"
      ) {
        return res.status(409).json({
          error:
            "A payment submission is already awaiting review for this order.",
        });
      }
      if (
        !Number.isFinite(order.totalAmount) ||
        order.totalAmount <= 0 ||
        order.currency !== "INR"
      ) {
        return res.status(409).json({
          error: "The order amount is invalid. Please contact support.",
        });
      }

      if (hasScreenshot) {
        const bucketName = process.env.FIREBASE_STORAGE_BUCKET;
        if (!bucketName) {
          return res.status(503).json({
            error:
              "Screenshot uploads are not configured. Remove the screenshot or contact the store.",
          });
        }
        const ext =
          screenshot.mimetype === "image/png"
            ? "png"
            : screenshot.mimetype === "image/webp"
              ? "webp"
              : "jpg";
        uploadedPath = `payment-evidence/${user.uid}/${orderId}/${Date.now()}-${claimId(utr).slice(0, 12)}.${ext}`;
        const bucket = adminStorage.bucket(bucketName);
        await bucket.file(uploadedPath).save(screenshot.buffer, {
          resumable: false,
          metadata: {
            contentType: screenshot.mimetype,
            cacheControl: "private, max-age=0, no-transform",
          },
          public: false,
        });
      }

      await adminDb.runTransaction(async (tx) => {
        const [freshOrderSnap, claimSnap] = await Promise.all([
          tx.get(orderRef),
          tx.get(claimRef),
        ]);
        if (!freshOrderSnap.exists) {
          throw Object.assign(new Error("Order not found."), { status: 404 });
        }
        const freshOrder = freshOrderSnap.data();
        if (freshOrder.userId !== user.uid) {
          throw Object.assign(
            new Error("You cannot submit payment for this order."),
            { status: 403 }
          );
        }
        if (
          freshOrder.paymentStatus === "verified" ||
          freshOrder.status === "Verified"
        ) {
          throw Object.assign(
            new Error("This order is already marked as paid."),
            { status: 409 }
          );
        }
        if (
          freshOrder.paymentStatus === "awaiting_verification" ||
          freshOrder.paymentSubmission?.status === "submitted"
        ) {
          throw Object.assign(
            new Error(
              "A payment submission is already awaiting review for this order."
            ),
            { status: 409 }
          );
        }
        if (claimSnap.exists) {
          throw Object.assign(
            new Error(
              "This transaction reference has already been submitted for another order."
            ),
            { status: 409 }
          );
        }

        tx.create(claimRef, {
          normalizedUtr: utr,
          orderId,
          userId: user.uid,
          createdAt: FieldValue.serverTimestamp(),
        });
        tx.update(orderRef, {
          paymentStatus: "awaiting_verification",
          paymentSubmission: {
            utr,
            status: "submitted",
            screenshotPath: uploadedPath,
            submittedAt: FieldValue.serverTimestamp(),
          },
          updatedAt: FieldValue.serverTimestamp(),
        });
      });

      return res.status(200).json({
        ok: true,
        message:
          "Payment details submitted. Your order remains unpaid until an admin verifies the transaction.",
      });
    } catch (error) {
      if (uploadedPath && process.env.FIREBASE_STORAGE_BUCKET) {
        try {
          await adminStorage
            .bucket(process.env.FIREBASE_STORAGE_BUCKET)
            .file(uploadedPath)
            .delete({ ignoreNotFound: true });
        } catch {}
      }
      const status = error?.status || 500;
      if (status !== 500) {
        return res.status(status).json({ error: error.message });
      }
      console.error("Payment submission failed:", error);
      return res.status(500).json({
        error: "Could not submit payment details. Please try again.",
      });
    }
  }
);

export default router;
