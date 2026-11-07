import { Injectable, signal } from '@angular/core';
import {
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
  User,
} from 'firebase/auth';
import { auth } from './firebase';

// Email and password only. There is no sign-up screen: accounts are created in the
// Firebase console (Authentication → Users → Add user).
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly currentUser = signal<User | null>(auth.currentUser);
  readonly user = this.currentUser.asReadonly();

  constructor() {
    onAuthStateChanged(auth, (user) => this.currentUser.set(user));
  }

  async signIn(email: string, password: string): Promise<void> {
    await signInWithEmailAndPassword(auth, email.trim(), password);
  }

  sendPasswordReset(email: string): Promise<void> {
    return sendPasswordResetEmail(auth, email.trim());
  }

  signOut(): Promise<void> {
    return signOut(auth);
  }

  /** Firebase ID token for calls to our /api functions. Refreshed automatically when it expires. */
  async idToken(): Promise<string> {
    await auth.authStateReady();
    if (!auth.currentUser) throw new Error('Not signed in');
    return auth.currentUser.getIdToken();
  }
}
