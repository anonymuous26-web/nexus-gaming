import express from "express";
import { adminDb, verifyRequestUser } from "../lib/firebaseAdmin.js";

const router = express.Router();

const MAX_ITEMS = 30;
const MAX_QUANTITY_PER_GAME = 10;
const MAX_GAME_ID_LENGTH = 150;

const COUPONS_COLLECTION = "coupons";
const GAMES_COLLECTION = "games";

class ValidationError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.name = "ValidationError";
    this.status = status;
  }
}

function jsonResponse(res, data, status = 200) {
  return res
    .status(status)
    .set("Cache-Control", "no-store, max-age=0")
    .json(data);
}

function jsonError(res, message, status = 400) {
  return jsonResponse(res, { valid: false, error: message }, status);
}

function normalizeCode(value) {
  return typeof value === "string" ? value.trim().toUpperCase() : "";
}

function roundMoney(value) {
  if (!Number.isFinite(value)) {
    throw new ValidationError("Unable to calculate the cart total.");
  }

  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function getExpiryMillis(value) {
  if (value == null) return null;

  if (typeof value.toMillis === "function") {
    return value.toMillis();
  }

  if (value instanceof Date) {
    return value.getTime();
  }

  if (typeof value === "object" && Number.isFinite(value.seconds)) {
    const nanoseconds = Number.isFinite(value.nanoseconds)
      ? value.nanoseconds
      : 0;

    return value.seconds * 1000 + nanoseconds / 1_000_000;
  }

  if (typeof value === "string" || typeof value === "number") {
    const result = new Date(value).getTime();
    return Number.isFinite(result) ? result : NaN;
  }

  return NaN;
}

function parseItems(items) {
  if (
    !Array.isArray(items) ||
    items.length === 0 ||
    items.length > MAX_ITEMS
  ) {
    throw new ValidationError(
      "Your cart is empty or contains too many items."
    );
  }

  const quantities = new Map();

  for (const item of items) {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      throw new ValidationError("One or more cart items are invalid.");
    }

    const rawId =
      typeof item.gameId === "string"
        ? item.gameId
        : typeof item.productId === "string"
          ? item.productId
          : typeof item.id === "string"
            ? item.id
            : "";

    const gameId = rawId.trim();
    const quantity = item.quantity;

    if (
      !gameId ||
      gameId.length > MAX_GAME_ID_LENGTH ||
      gameId.includes("/") ||
      gameId.includes("\\")
    ) {
      throw new ValidationError("One or more cart item IDs are invalid.");
    }

    if (
      !Number.isSafeInteger(quantity) ||
      quantity < 1 ||
      quantity > MAX_QUANTITY_PER_GAME
    ) {
      throw new ValidationError(
        `Quantity must be a whole number between 1 and ${MAX_QUANTITY_PER_GAME}.`
      );
    }

    const combined = (quantities.get(gameId) || 0) + quantity;

    if (combined > MAX_QUANTITY_PER_GAME) {
      throw new ValidationError(
        `A game cannot be ordered more than ${MAX_QUANTITY_PER_GAME} times.`
      );
    }

    quantities.set(gameId, combined);
  }

  return quantities;
}

async function readPromoConfiguration(code) {
  const snapshot = await adminDb
    .collection(COUPONS_COLLECTION)
    .doc(code)
    .get();

  if (!snapshot.exists) {
    throw new ValidationError("The promo code is invalid or expired.");
  }

  const coupon = snapshot.data() || {};
  const configuredCode = normalizeCode(coupon.code || snapshot.id);
  const discountPercent = Number(coupon.discountPercent);

  if (
    configuredCode !== code ||
    coupon.isActive !== true ||
    !Number.isInteger(discountPercent) ||
    discountPercent < 1 ||
    discountPercent > 99
  ) {
    throw new ValidationError("The promo code is invalid or expired.");
  }

  if (coupon.expiresAt != null) {
    const expiryMillis = getExpiryMillis(coupon.expiresAt);

    if (!Number.isFinite(expiryMillis)) {
      throw new ValidationError(
        "Coupon expiry is configured incorrectly.",
        500
      );
    }

    if (expiryMillis <= Date.now()) {
      throw new ValidationError("This promo code has expired.");
    }
  }

  return { configuredCode, discountPercent };
}

async function calculateCartTotals(quantities, discountPercent) {
  const entries = [...quantities.entries()];

  const lineResults = await Promise.all(
    entries.map(async ([gameId, quantity]) => {
      const snapshot = await adminDb
        .collection(GAMES_COLLECTION)
        .doc(gameId)
        .get();

      if (!snapshot.exists) {
        throw new ValidationError(
          "A game in your cart is no longer available."
        );
      }

      const game = snapshot.data() || {};

      if (
        game.available === false ||
        game.inStock === false ||
        game.active === false ||
        game.isActive === false
      ) {
        throw new ValidationError(
          `${game.title || "A game"} is currently unavailable.`
        );
      }

      const price = game.price;

      if (
        typeof price !== "number" ||
        !Number.isFinite(price) ||
        price <= 0
      ) {
        throw new ValidationError(
          `${game.title || "A game"} has an invalid price.`
        );
      }

      if (game.stockCount != null) {
        if (
          !Number.isSafeInteger(game.stockCount) ||
          game.stockCount < 0
        ) {
          throw new ValidationError(
            `${game.title || "A game"} has invalid stock information.`
          );
        }

        if (game.stockCount < quantity) {
          throw new ValidationError(
            `${game.title || "A game"} is unavailable in the requested quantity.`
          );
        }
      }

      const priceInCents = Math.round(price * 100);

      return priceInCents * quantity;
    })
  );

  const subtotalInCents = lineResults.reduce(
    (sum, lineTotal) => sum + lineTotal,
    0
  );

  if (
    !Number.isSafeInteger(subtotalInCents) ||
    subtotalInCents <= 0
  ) {
    throw new ValidationError(
      "The cart total must be greater than zero."
    );
  }

  const subtotal = roundMoney(subtotalInCents / 100);
  const discountAmount = roundMoney(
    subtotal * (discountPercent / 100)
  );
  const totalAmount = roundMoney(subtotal - discountAmount);

  if (totalAmount <= 0) {
    throw new ValidationError(
      "The final order amount must be greater than zero."
    );
  }

  return { subtotal, discountAmount, totalAmount };
}

router.post("/validate", async (req, res) => {
  let user;

  try {
    user = await verifyRequestUser(req);
  } catch (error) {
    console.error("Promo authentication failed:", error);

    return jsonError(
      res,
      "Unable to verify your session. Please sign in again.",
      401
    );
  }

  if (!user?.uid) {
    return jsonError(
      res,
      "Please sign in to validate a promo code.",
      401
    );
  }

  const body = req.body;

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return jsonError(res, "Invalid request body.", 400);
  }

  const rawCode =
    typeof body.promoCode === "string"
      ? body.promoCode
      : typeof body.code === "string"
        ? body.code
        : "";

  const submittedCode = normalizeCode(rawCode);

  if (!/^[A-Z0-9_-]{3,30}$/.test(submittedCode)) {
    return jsonError(res, "Enter a valid promo code.", 400);
  }

  let quantities;

  try {
    quantities = parseItems(body.items);
  } catch (error) {
    if (error instanceof ValidationError) {
      return jsonError(res, error.message, error.status);
    }

    console.error("Promo cart parsing failed:", error);
    return jsonError(res, "Unable to validate your cart.", 400);
  }

  try {
    const { configuredCode, discountPercent } =
      await readPromoConfiguration(submittedCode);

    if (configuredCode !== submittedCode) {
      return jsonError(res, "The promo code is invalid.", 400);
    }

    const totals = await calculateCartTotals(
      quantities,
      discountPercent
    );

    return jsonResponse(res, {
      valid: true,
      promoCode: configuredCode,
      discountPercent,
      ...totals,
      currency: "INR",
    });
  } catch (error) {
    if (error instanceof ValidationError) {
      return jsonError(res, error.message, error.status);
    }

    console.error("Promo validation failed:", error);

    return jsonError(
      res,
      "Unable to validate your promo code right now.",
      500
    );
  }
});

export default router;
