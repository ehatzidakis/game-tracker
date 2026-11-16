// Firestore with admin rights, for the server functions only. Bypasses the security rules,
// so every function must check who it's acting for before reading or writing.
import { cert, getApps, initializeApp, type App } from 'firebase-admin/app';
import { getAuth, type Auth } from 'firebase-admin/auth';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';

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

/** Firebase Authentication with admin rights: creates accounts even with public sign-up off. */
export function adminAuth(): Auth {
  return getAuth(adminApp());
}
