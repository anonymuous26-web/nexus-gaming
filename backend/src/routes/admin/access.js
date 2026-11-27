import express from "express";
import { requireAdmin } from "../../lib/adminAuthorization.js";

const router = express.Router();

// GET /api/admin/payment-submissions/access
router.get("/access", async (req, res) => {
  try {
    const result = await requireAdmin(req);

    if (!result.ok) {
      return res
        .status(result.status || 403)
        .set("Cache-Control", "no-store")
        .json({ error: result.error || "Administrator access required." });
    }

    return res
      .status(200)
      .set("Cache-Control", "no-store")
      .json({
        authorized: true,
        user: {
          uid: result.user.uid,
          email: result.user.email || null,
        },
      });
  } catch (error) {
    console.error("Admin access endpoint failed:", error);

    return res
      .status(500)
      .set("Cache-Control", "no-store")
      .json({ error: "Could not verify administrator access." });
  }
});

export default router;
