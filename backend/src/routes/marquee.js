import express from "express";
import { adminDb } from "../lib/firebaseAdmin.js";

const router = express.Router();

router.get("/", async (_req, res) => {
  try {
    const snapshot = await adminDb
      .collection("config")
      .doc("settings")
      .get();

    const data = snapshot.exists ? snapshot.data() : {};

    return res
      .set("Cache-Control", "no-store")
      .json({
        marqueeText:
          typeof data.marqueeText === "string" &&
          data.marqueeText.trim()
            ? data.marqueeText.trim()
            : "Welcome to Nexus Gaming!",
      });
  } catch (error) {
    console.error("Public marquee loading failed:", error);

    return res.status(500).json({ error: "Unable to load marquee." });
  }
});

export default router;
