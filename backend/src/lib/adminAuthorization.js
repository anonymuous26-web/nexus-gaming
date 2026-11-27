import { adminDb, verifyRequestUser } from "./firebaseAdmin.js";

export async function requireAdmin(request) {
  const user = await verifyRequestUser(request);

  if (!user?.uid) {
    console.warn("[Admin auth] No verified Firebase ID token.");
    return {
      ok: false,
      status: 401,
      error: "Sign in required.",
    };
  }

  const email = String(user.email || "").trim().toLowerCase();

  const allowedEmails = String(process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);

  const emailVerified = user.email_verified === true;
  const emailAllowed = allowedEmails.includes(email);

  console.info("[Admin auth] Authorization check:", {
    uidPresent: Boolean(user.uid),
    emailPresent: Boolean(email),
    emailVerified,
    emailAllowed,
    allowlistConfigured: allowedEmails.length > 0,
  });

  if (!email || !emailVerified || !emailAllowed) {
    return {
      ok: false,
      status: 403,
      error: "Administrator access required.",
    };
  }

  return { ok: true, user };
}

export async function getOrderOrNull(orderId) {
  if (
    typeof orderId !== "string" ||
    !orderId.trim() ||
    orderId.includes("/")
  ) {
    return null;
  }

  const snap = await adminDb.collection("orders").doc(orderId).get();

  return snap.exists
    ? { ref: snap.ref, data: snap.data() }
    : null;
}
