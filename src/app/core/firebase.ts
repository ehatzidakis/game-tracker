import { initializeApp } from 'firebase/app';
import { browserLocalPersistence, indexedDBLocalPersistence, initializeAuth } from 'firebase/auth';
import { environment } from '../../environments/environment';

export const firebaseApp = initializeApp(environment.firebase);

// Not getAuth(): that also sets up Google popup/redirect sign-in, which on iPhone loads a hidden
// firebaseapp.com page before the signed-in check and could stall startup for up to 30 seconds.
// We only use email/password, so we just keep the session on the device.
export const auth = initializeAuth(firebaseApp, {
  persistence: [indexedDBLocalPersistence, browserLocalPersistence],
});
