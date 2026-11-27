import { randomUUID } from "node:crypto";
import express from "express";
import { v2 as cloudinary } from "cloudinary";
import { requireAdmin } from "../../lib/adminAuthorization.js";

const router = express.Router();

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

function configureCloudinary() {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;

  if (!cloudName || !apiKey || !apiSecret) {
    throw new Error("Cloudinary server environment variables are missing.");
  }

  cloudinary.config({
    cloud_name: cloudName,
    api_key: apiKey,
    api_secret: apiSecret,
    secure: true,
  });

  return { cloudName, apiKey, apiSecret };
}

// POST /api/admin/cloudinary-signature
router.post("/", async (req, res) => {
  const auth = await requireAdmin(req);

  if (!auth.ok) {
    return res.status(auth.status).json({ error: auth.error });
  }

  try {
    const { cloudName, apiKey, apiSecret } = configureCloudinary();

    const body = req.body || {};
    const size = Number(body.size);
    const format = String(body.format || "").toLowerCase();

    const allowedFormats = new Set(["jpg", "jpeg", "png", "webp"]);

    if (!Number.isFinite(size) || size <= 0 || size > MAX_IMAGE_BYTES) {
      return res.status(400).json({
        error: "Image must be larger than 0 bytes and no larger than 5 MB.",
      });
    }

    if (!allowedFormats.has(format)) {
      return res
        .status(400)
        .json({ error: "Only JPG, PNG, and WebP images are allowed." });
    }

    const timestamp = Math.floor(Date.now() / 1000);
    const publicId = `nexus-games/${randomUUID()}`;

    const paramsToSign = {
      timestamp,
      public_id: publicId,
    };

    const signature = cloudinary.utils.api_sign_request(
      paramsToSign,
      apiSecret
    );

    return res
      .set("Cache-Control", "no-store, private")
      .json({
        cloudName,
        apiKey,
        timestamp,
        publicId,
        signature,
      });
  } catch (error) {
    console.error("Cloudinary signature creation failed:", error);

    return res.status(500).json({
      error:
        "Could not prepare the image upload. Check server Cloudinary configuration.",
    });
  }
});

export default router;
