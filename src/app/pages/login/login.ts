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
    <main class="grid min-h-dvh place-items-center bg-ground px-4">
      <form class="w-full max-w-sm" (submit)="signIn($event)">
        <div class="text-center">
          <img
            src="icons/apple-touch-icon.png"
            alt=""
            class="mx-auto size-[72px] rounded-[16px] ring-[0.5px] ring-white/15"
          />
          <h1 class="mt-4 text-[28px] leading-[34px] font-bold">Game Tracker</h1>
          <p class="mt-1 text-[15px] leading-5 text-muted">
            Upcoming releases and the games you're playing.
          </p>
        </div>

        <div class="grouped mt-8">
          <label class="row">
            <span class="w-20 shrink-0">Email</span>
            <input
              type="email"
              name="email"
              autocomplete="username"
              required
              placeholder="you@example.com"
              class="min-w-0 flex-1 bg-transparent text-[17px] outline-none"
              [value]="email()"
              (input)="email.set(value($event))"
            />
          </label>
          <label class="row">
            <span class="w-20 shrink-0">Password</span>
            <input
              type="password"
              name="password"
              autocomplete="current-password"
              required
              placeholder="Required"
              class="min-w-0 flex-1 bg-transparent text-[17px] outline-none"
              [value]="password()"
              (input)="password.set(value($event))"
            />
          </label>
        </div>

        <button type="submit" class="button-primary mt-6" [disabled]="busy()">
          {{ busy() ? 'Signing In…' : 'Sign In' }}
        </button>

        @if (error()) {
          <p class="mt-4 text-center text-[15px] leading-5 text-danger" role="alert">{{ error() }}</p>
        } @else if (notice()) {
          <p class="mt-4 text-center text-[15px] leading-5 text-muted" role="status">{{ notice() }}</p>
        }

        <button
          type="button"
          class="mx-auto mt-4 block text-[15px] text-accent active:opacity-60"
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
