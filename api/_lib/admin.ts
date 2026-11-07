// Firestore with admin rights, for the server functions only. Bypasses the security rules,
// so every function must check who it's acting for before reading or writing.
import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';

let db: Firestore | null = null;

export function adminDb(): Firestore {
  if (db) return db;
  const app =
    getApps()[0] ??
    initializeApp({ credential: cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT ?? '{}')) });
  db = getFirestore(app);
  db.settings({ ignoreUndefinedProperties: true });
  return db;
}
