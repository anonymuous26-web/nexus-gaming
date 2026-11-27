import fs from "node:fs";
import path from "node:path";

import {
  cert,
  getApps,
  initializeApp,
} from "firebase-admin/app";

import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";

const ADMIN_APP_NAME = "nexus-admin";

function readServiceAccount() {
  const configured = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;

  if (!configured || !configured.trim()) {
    throw new Error(
      "FIREBASE_SERVICE_ACCOUNT_KEY is missing. Configure it in your server environment."
    );
  }

  let serviceAccount;

  try {
    if (configured.trim().startsWith("{")) {
      // Hosting environment: service-account JSON stored as a string.
      serviceAccount = JSON.parse(configured);
    } else {
      // Local development: path to a private service-account JSON file.
      const keyPath = path.isAbsolute(configured)
        ? configured
        : path.resolve(process.cwd(), configured);

      serviceAccount = JSON.parse(
        fs.readFileSync(keyPath, "utf8")
      );
    }
  } catch {
    throw new Error(
      "FIREBASE_SERVICE_ACCOUNT_KEY is invalid. Check that it contains valid service-account JSON or a valid file path."
    );
  }

  const { project_id, client_email, private_key } =
    serviceAccount ?? {};

  if (!project_id || !client_email || !private_key) {
    throw new Error(
      "The Firebase service account must include project_id, client_email, and private_key."
    );
  }

  return {
    ...serviceAccount,
    project_id,
    client_email,
    // Support environment values in which newlines are escaped.
    private_key: private_key.replace(/\\n/g, "\n"),
  };
}

function getAdminApp() {
  const existingApp = getApps().find(
    (app) => app.name === ADMIN_APP_NAME
  );

  if (existingApp) {
    return existingApp;
  }

  const serviceAccount = readServiceAccount();

  return initializeApp(
    {
      credential: cert(serviceAccount),
      projectId: serviceAccount.project_id,
    },
    ADMIN_APP_NAME
  );
}

const app = getAdminApp();

export const adminAuth = getAuth(app);
export const adminDb = getFirestore(app);

// Configure FIREBASE_STORAGE_BUCKET (for example, project-id.appspot.com).
export const adminStorage = getStorage(app);

/**
 * Verifies the Firebase ID token supplied in the Authorization header.
 *
 * Supports both Express request objects (`req.headers.authorization`)
 * and Web Fetch Request objects (`request.headers.get("authorization")`).
 */
export async function verifyRequestUser(request) {
  let authorization = "";

  if (typeof request?.headers?.get === "function") {
    authorization = request.headers.get("authorization") ?? "";
  } else if (typeof request?.headers?.authorization === "string") {
    authorization = request.headers.authorization;
  }

  if (!authorization) {
    return null;
  }

  // Require exactly one bearer token value.
  const match = authorization.match(
    /^Bearer\s+(\S+)$/i
  );

  if (!match) {
    return null;
  }

  const idToken = match[1];

  try {
    // Check token validity and whether it has been revoked.
    const decodedToken = await adminAuth.verifyIdToken(
      idToken,
      true
    );

    if (!decodedToken.uid) {
      return null;
    }

    return decodedToken;
  } catch {
    // Invalid, expired, revoked, or otherwise unverifiable tokens
    // must never be treated as authenticated users.
    return null;
  }
}
