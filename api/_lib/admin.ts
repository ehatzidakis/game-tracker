// Firestore with admin rights, for the server functions only. Bypasses the security rules,
// so every function must check who it's acting for before reading or writing.
import { cert, getApps, initializeApp, type App } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import { FIREBASE_PROJECT_ID } from './auth.js';

let db: Firestore | null = null;

function adminApp(): App {
  return (
    getApps()[0] ??
    initializeApp({ credential: cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT ?? '{}')) })
  );
}

export function adminDb(): Firestore {
  if (db) return db;
  db = getFirestore(adminApp());
  db.settings({ ignoreUndefinedProperties: true });
  return db;
}

/** Firebase Authentication refused to make the account; `code` is its reason, like EMAIL_EXISTS. */
export class AccountError extends Error {
  constructor(readonly code: string) {
    super(`Firebase Authentication: ${code}`);
  }
}

/**
 * Makes an email and password account, with admin rights, so it works with public sign-up off.
 * Answers with its uid. Calls Firebase Authentication's own API (what the admin SDK's createUser
 * calls) rather than firebase-admin/auth, whose jwks-rsa can't load jose on Vercel and would take
 * every function that imports this file down with it.
 */
export async function createAccount(email: string, password: string): Promise<string> {
  const { access_token } = await adminApp().options.credential!.getAccessToken();
  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/accounts`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${access_token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    },
  );
  const body = (await res.json().catch(() => ({}))) as {
    localId?: string;
    error?: { message?: string };
  };
  if (!res.ok || !body.localId) {
    throw new AccountError(body.error?.message ?? `HTTP ${res.status}`);
  }
  return body.localId;
}
