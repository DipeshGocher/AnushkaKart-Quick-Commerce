import dotenv from "dotenv";
import admin from "firebase-admin";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

let firebaseAdminApp = null;

/**
 * Reads the service account from, in order:
 *  - FIREBASE_SERVICE_ACCOUNT: the JSON itself
 *  - FIREBASE_SERVICE_ACCOUNT_BASE64: base64 of the JSON (single-line, safe for hosting dashboards)
 *  - GOOGLE_APPLICATION_CREDENTIALS: path to the downloaded key file
 * Returns null when none is configured.
 */
function loadServiceAccount() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (raw && raw.trim()) {
    try {
      return JSON.parse(raw);
    } catch (error) {
      // Some .env loaders escape double quotes as \"; only retry that way when
      // the raw value is not valid JSON, so a correct key is never rewritten.
      return JSON.parse(raw.replace(/\\"/g, '"'));
    }
  }

  const base64 = process.env.FIREBASE_SERVICE_ACCOUNT_BASE64;
  if (base64 && base64.trim()) {
    return JSON.parse(Buffer.from(base64.trim(), "base64").toString("utf8"));
  }

  const filePath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (filePath && filePath.trim()) {
    return JSON.parse(fs.readFileSync(path.resolve(filePath.trim()), "utf8"));
  }

  return null;
}

/**
 * Returns a firebase-admin app when a service account is configured (see
 * loadServiceAccount). FIREBASE_DATABASE_URL is optional (Realtime DB only).
 */
export const getFirebaseAdminApp = () => {
  if (firebaseAdminApp) return firebaseAdminApp;

  const databaseURL = process.env.FIREBASE_DATABASE_URL;

  try {
    const serviceAccount = loadServiceAccount();
    if (!serviceAccount) {
      return null;
    }
    if (serviceAccount.private_key) {
      serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');
    }
    const config = {
      credential: admin.credential.cert(serviceAccount),
    };
    if (databaseURL) {
      config.databaseURL = databaseURL;
    }
    firebaseAdminApp = admin.initializeApp(config);
    return firebaseAdminApp;
  } catch (e) {
    console.warn("[Firebase] Init skipped:", e.message);
    return null;
  }
};

export const getFirebaseRealtimeDb = () => {
  const app = getFirebaseAdminApp();
  if (!app) return null;
  return admin.database(app);
};

