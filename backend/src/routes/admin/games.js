import express from "express";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "../../lib/firebaseAdmin.js";
import { requireAdmin } from "../../lib/adminAuthorization.js";

const router = express.Router();

function cleanGame(input) {
  if (!input || typeof input !== "object") return null;
  const title = String(input.title || "").trim();
  const description = String(input.description || "").trim();
  const category = String(input.category || "").trim();
  const price = Number(input.price);
  const stockCount = Number(input.stockCount);
  const imageUrl = String(input.imageUrl || "").trim();
  if (!title || !description || !category || !imageUrl) return null;
  if (
    !Number.isFinite(price) ||
    price < 0 ||
    !Number.isInteger(stockCount) ||
    stockCount < 0
  ) {
    return null;
  }
  return {
    title,
    description,
    category,
    price,
    stockCount,
    imageUrl,
    featured: input.featured === true,
    draft: input.draft === true,
    upcoming: input.upcoming === true,
  };
}

// POST /api/admin/games
router.post("/", async (req, res) => {
  const auth = await requireAdmin(req);
  if (!auth.ok) return res.status(auth.status).json({ error: auth.error });

  try {
    const body = req.body || {};
    const game = cleanGame(body.game);
    if (!game) {
      return res.status(400).json({
        error:
          "Enter a title, description, category, valid price and stock count, and upload an image.",
      });
    }
    const ref = adminDb.collection("games").doc();
    await ref.set({
      ...game,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    return res.status(201).json({ ok: true, gameId: ref.id });
  } catch (error) {
    console.error("Admin create game failed:", error);
    return res.status(500).json({
      error:
        "The game could not be created. Check server Firebase Admin configuration.",
    });
  }
});

// PATCH /api/admin/games
router.patch("/", async (req, res) => {
  const auth = await requireAdmin(req);
  if (!auth.ok) return res.status(auth.status).json({ error: auth.error });

  try {
    const body = req.body || {};
    const gameId = String(body.gameId || "").trim();
    if (!gameId || gameId.includes("/")) {
      return res.status(400).json({ error: "Invalid game ID." });
    }

    const ref = adminDb.collection("games").doc(gameId);
    const existing = await ref.get();
    if (!existing.exists) {
      return res.status(404).json({ error: "This game no longer exists." });
    }

    if (body.updates && typeof body.updates === "object") {
      const updates = {};
      for (const field of ["featured", "draft", "upcoming"]) {
        if (typeof body.updates[field] === "boolean") {
          updates[field] = body.updates[field];
        }
      }
      if (Object.keys(updates).length === 0) {
        return res
          .status(400)
          .json({ error: "No valid game status was supplied." });
      }
      await ref.update({
        ...updates,
        updatedAt: FieldValue.serverTimestamp(),
      });
      return res.json({ ok: true, gameId, updates });
    }

    const game = cleanGame(body.game);
    if (!game) {
      return res.status(400).json({ error: "Invalid game details." });
    }
    await ref.set(
      { ...game, updatedAt: FieldValue.serverTimestamp() },
      { merge: true }
    );
    return res.json({ ok: true, gameId });
  } catch (error) {
    console.error("Admin update game failed:", error);
    return res.status(500).json({
      error:
        "The game could not be updated. Check server Firebase Admin configuration.",
    });
  }
});

// DELETE /api/admin/games
router.delete("/", async (req, res) => {
  const auth = await requireAdmin(req);
  if (!auth.ok) return res.status(auth.status).json({ error: auth.error });

  try {
    const body = req.body || {};
    const id = String(body.gameId || "").trim();
    if (!id || id.includes("/")) {
      return res.status(400).json({ error: "Invalid game ID." });
    }
    const ref = adminDb.collection("games").doc(id);
    const existing = await ref.get();
    if (!existing.exists) {
      return res.status(404).json({ error: "This game no longer exists." });
    }
    await ref.delete();
    return res.json({ ok: true, gameId: id });
  } catch (error) {
    console.error("Admin delete game failed:", error);
    return res.status(500).json({ error: "The game could not be deleted." });
  }
});

export default router;
