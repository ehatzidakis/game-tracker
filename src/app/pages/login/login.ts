import { Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../core/auth.service';

const MESSAGES: Record<string, string> = {
  'auth/invalid-credential': 'Wrong email or password.',
  'auth/invalid-email': "That doesn't look like an email address.",
  'auth/user-disabled': 'This account is disabled.',
  'auth/too-many-requests': 'Too many attempts. Wait a few minutes and try again.',
  'auth/network-request-failed': 'No connection. Check your internet and try again.',
};

@Component({
  selector: 'app-login',
  template: `
    <main class="min-h-dvh grid place-items-center px-4">
      <form class="w-full max-w-xs space-y-6" (submit)="signIn($event)">
        <div class="space-y-2 text-center">
          <h1 class="text-3xl font-semibold tracking-tight">Game Tracker</h1>
          <p class="text-zinc-400">Upcoming releases and the games you're playing.</p>
        </div>

        <div class="space-y-3">
          <label class="block space-y-1">
            <span class="text-sm text-zinc-400">Email</span>
            <input
              type="email"
              name="email"
              autocomplete="username"
              required
              class="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2.5 outline-none focus:border-zinc-400"
              [value]="email()"
              (input)="email.set(value($event))"
            />
          </label>
          <label class="block space-y-1">
            <span class="text-sm text-zinc-400">Password</span>
            <input
              type="password"
              name="password"
              autocomplete="current-password"
              required
              class="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2.5 outline-none focus:border-zinc-400"
              [value]="password()"
              (input)="password.set(value($event))"
            />
          </label>
        </div>

        <button
          type="submit"
          class="w-full rounded-lg bg-zinc-100 text-zinc-950 font-medium py-2.5 hover:bg-white disabled:opacity-60"
          [disabled]="busy()"
        >
          {{ busy() ? 'Signing in…' : 'Sign in' }}
        </button>

        @if (error()) {
          <p class="text-sm text-red-400 text-center" role="alert">{{ error() }}</p>
        } @else if (notice()) {
          <p class="text-sm text-zinc-300 text-center" role="status">{{ notice() }}</p>
        }

        <button
          type="button"
          class="block mx-auto text-sm text-zinc-400 hover:text-zinc-100"
          (click)="resetPassword()"
        >
          Forgot password?
        </button>
      </form>
    </main>
  `,
})
export class LoginPage {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  protected readonly email = signal('');
  protected readonly password = signal('');
  protected readonly busy = signal(false);
  protected readonly error = signal('');
  protected readonly notice = signal('');

  protected value(event: Event): string {
    return (event.target as HTMLInputElement).value;
  }

  protected async signIn(event: Event): Promise<void> {
    event.preventDefault();
    this.busy.set(true);
    this.error.set('');
    this.notice.set('');
    try {
      await this.auth.signIn(this.email(), this.password());
      await this.router.navigateByUrl('/');
    } catch (e) {
      this.showError(e);
    } finally {
      this.busy.set(false);
    }
  }

  protected async resetPassword(): Promise<void> {
    this.error.set('');
    this.notice.set('');
    if (!this.email().trim()) {
      this.error.set('Enter your email first, then tap "Forgot password?" again.');
      return;
    }
    try {
      await this.auth.sendPasswordReset(this.email());
      this.notice.set('If that email has an account, a reset link is on its way.');
    } catch (e) {
      this.showError(e);
    }
  }

  private showError(e: unknown): void {
    console.error('Sign-in failed', e);
    const code = (e as { code?: string }).code ?? '';
    this.error.set(MESSAGES[code] ?? "Couldn't sign in. Please try again.");
  }
}
