import { Injectable, signal } from '@angular/core';
import {
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
  User,
} from 'firebase/auth';
import { auth } from './firebase';

// Email and password only. Firebase's public sign-up is off: new accounts come from invite links
// (Settings → Invite a friend), made by our server (api/signup.ts), or the Firebase console.
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

  /** Makes a one-time invite link for a friend. It works for 7 days. */
  async createInvite(): Promise<{ url: string; expiresAt: number }> {
    const res = await fetch('/api/invite', {
      method: 'POST',
      headers: { Authorization: `Bearer ${await this.idToken()}` },
    });
    const body = (await res.json().catch(() => ({}))) as {
      code?: string;
      expiresAt?: number;
      error?: string;
    };
    if (!res.ok || !body.code) throw new Error(body.error ?? "Couldn't make an invite link.");
    return { url: `${location.origin}/signup?invite=${body.code}`, expiresAt: body.expiresAt ?? 0 };
  }

  /** Null when the invite is still good, else what to tell the person. */
  async checkInvite(code: string): Promise<string | null> {
    const res = await fetch(`/api/signup?invite=${encodeURIComponent(code)}`);
    if (res.ok) return null;
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    return body.error ?? "Couldn't check the invite link. Try again in a moment.";
  }

  /**
   * Makes an account with an invite, then signs in to it. Answers with a PlayStation problem, if
   * linking the Online ID failed (the account is made anyway). Throws with a message to show.
   */
  async signUp(invite: string, email: string, password: string, onlineId: string) {
    const res = await fetch('/api/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ invite, email: email.trim(), password, onlineId: onlineId.trim() }),
    });
    const body = (await res.json().catch(() => ({}))) as { psnError?: string; error?: string };
    if (!res.ok) throw new Error(body.error ?? "Couldn't make the account. Try again in a moment.");
    await this.signIn(email, password);
    return { psnError: body.psnError };
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
