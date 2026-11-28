import "dotenv/config";
import express from "express";
import cors from "cors";

import chatRouter from "./routes/chat.js";
import marqueeRouter from "./routes/marquee.js";
import promosRouter from "./routes/promos.js";
import ordersRouter from "./routes/orders.js";

import adminAccessRouter from "./routes/admin/access.js";
import adminDashboardRouter from "./routes/admin/dashboard.js";
import adminGamesRouter from "./routes/admin/games.js";
import adminMarqueeRouter from "./routes/admin/marquee.js";
import adminCouponsRouter from "./routes/admin/coupons.js";
import adminCloudinaryRouter from "./routes/admin/cloudinary.js";
import adminOrdersRouter from "./routes/admin/orders.js";
import adminPaymentSubmissionsRouter from "./routes/admin/paymentSubmissions.js";

const app = express();
const PORT = Number(process.env.PORT) || 5000;

const allowedOrigins = String(
  process.env.FRONTEND_URL || "http://localhost:3000"
)
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(
  cors({
    origin(origin, callback) {
      // Allow server-to-server / curl requests without an Origin header,
      // or requests from configured frontend origins.
      if (!origin || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(new Error(`Origin ${origin} is not allowed by CORS.`));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "Accept"],
  })
);

// /api/chat parses raw text directly to enforce byte-size limits.
app.use("/api/chat", chatRouter);

app.use(express.json({ limit: "1mb" }));

// Handle malformed JSON payloads gracefully.
app.use((err, _req, res, next) => {
  if (err?.type === "entity.parse.failed") {
    return res.status(400).json({ error: "Invalid request body." });
  }
  return next(err);
});

app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "nexus-backend" });
});

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, service: "nexus-backend" });
});

// Public & customer routes
app.use("/api/marquee", marqueeRouter);
app.use("/api/promos", promosRouter);
app.use("/api/orders", ordersRouter);

// Admin routes
// Note: /api/admin/payment-submissions/access must come before /:orderId inside paymentSubmissionsRouter
app.use("/api/admin/payment-submissions", adminAccessRouter);
app.use("/api/admin/payment-submissions", adminPaymentSubmissionsRouter);
app.use("/api/admin/dashboard", adminDashboardRouter);
app.use("/api/admin/games", adminGamesRouter);
app.use("/api/admin/marquee", adminMarqueeRouter);
app.use("/api/admin/coupons", adminCouponsRouter);
app.use("/api/admin/cloudinary-signature", adminCloudinaryRouter);
app.use("/api/admin/orders", adminOrdersRouter);

app.use((_req, res) => {
  res.status(404).json({ error: "API route not found." });
});

app.use((err, _req, res, _next) => {
  console.error("Unhandled backend error:", err);
  res.status(500).json({ error: "Internal server error." });
});

app.listen(PORT, () => {
  console.log(`Nexus Gaming backend listening on http://localhost:${PORT}`);
});
