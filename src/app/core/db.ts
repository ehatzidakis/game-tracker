import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
} from 'firebase/firestore';
import { firebaseApp } from './firebase';

// Kept out of firebase.ts so the sign-in screen doesn't download Firestore.
// The on-device cache makes the library show instantly on reopen and work offline;
// changes made offline sync when the connection comes back.
export const db = initializeFirestore(firebaseApp, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
  ignoreUndefinedProperties: true,
});
