import { Component, computed, inject, input, OnInit, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { LucideCheck, LucideCircle } from '@lucide/angular';
import { PASSWORD_MAX, PASSWORD_RULES, passwordOk } from '../../../../api/_lib/signup.js';
import { AuthService } from '../../core/auth.service';
import { ToastService } from '../../core/toast.service';
import { Wordmark } from '../../shared/wordmark';

/**
 * Sign-up, opened from an invite link (/signup?invite=<code>). Email, a password that meets
 * PASSWORD_RULES, and optionally a PlayStation Online ID, linked straight away. The server makes
 * the account (Firebase's own sign-up is off), then this page signs in to it.
 */
@Component({
  selector: 'app-signup',
  imports: [RouterLink, Wordmark, LucideCheck, LucideCircle],
  template: `
    <main class="grid min-h-dvh place-items-center bg-ground px-4 py-10">
      <form class="w-full max-w-sm" (submit)="create($event)" novalidate>
        <div class="text-center">
          <img
            src="icons/apple-touch-icon.png?v=3"
            alt=""
            class="mx-auto size-18 rounded-2xl ring-[0.5px] ring-white/15"
          />
          <h1 class="mt-4 text-[28px] leading-8.5 font-bold"><app-wordmark /></h1>
          <p class="mt-1 text-[15px] leading-5 text-muted">
            You're invited. Make your account to track your releases and games.
          </p>
        </div>

        @if (inviteError(); as message) {
          <p class="mt-8 text-center text-[15px] leading-5 text-danger" role="alert">
            {{ message }}
          </p>
        } @else if (checking()) {
          <p class="mt-8 text-center text-[15px] leading-5 text-muted" role="status">
            Checking your invite…
          </p>
        } @else {
          <!-- 17px: 16px or more stops iOS zooming in on focus. -->
          <div class="grouped mt-8">
            <label class="row">
              <span class="w-20 shrink-0">Email</span>
              <input
                type="email"
                name="email"
                autocomplete="username"
                autocapitalize="off"
                spellcheck="false"
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
                autocomplete="new-password"
                passwordrules="minlength: 8; required: digit; required: special;"
                required
                [attr.maxlength]="passwordMax"
                placeholder="Required"
                aria-describedby="password-rules"
                class="min-w-0 flex-1 bg-transparent text-[17px] outline-none"
                [value]="password()"
                (input)="password.set(value($event))"
              />
            </label>
          </div>
          <ul
            id="password-rules"
            class="mt-2 flex flex-col gap-1 px-4"
            aria-label="Your password needs"
          >
            @for (rule of rules(); track rule.label) {
              <li
                class="flex items-center gap-2 text-[13px] leading-4.5"
                [class.text-muted]="!rule.met"
              >
                @if (rule.met) {
                  <svg lucideCheck [size]="14" [strokeWidth]="3" class="shrink-0 text-accent"></svg>
                } @else {
                  <svg lucideCircle [size]="14" [strokeWidth]="2" class="shrink-0 text-faint"></svg>
                }
                {{ rule.label }}
                <span class="sr-only">{{ rule.met ? '(done)' : '(not yet)' }}</span>
              </li>
            }
          </ul>

          <h2 class="group-header">PlayStation (optional)</h2>
          <div class="grouped">
            <label class="row">
              <span class="sr-only">PlayStation Online ID</span>
              <input
                type="text"
                name="onlineId"
                placeholder="Online ID, like Tatius94"
                autocomplete="off"
                autocapitalize="off"
                spellcheck="false"
                maxlength="16"
                class="min-w-0 flex-1 bg-transparent text-[17px] outline-none"
                [value]="onlineId()"
                (input)="onlineId.set(value($event))"
              />
            </label>
          </div>
          <p class="group-footer">
            Your PlayStation name, not your email. Playtime and trophies then come from your
            profile. You can also add it later in Settings.
          </p>

          <button type="submit" class="button-primary mt-6" [disabled]="busy()">
            {{ busy() ? 'Making Your Account…' : 'Create Account' }}
          </button>

          @if (error()) {
            <p class="mt-4 text-center text-[15px] leading-5 text-danger" role="alert">
              {{ error() }}
            </p>
          }
        }

        <a
          routerLink="/login"
          class="mx-auto mt-4 block w-fit text-[15px] text-accent active:opacity-60"
        >
          Already have an account? Sign in
        </a>
      </form>
    </main>
  `,
})
export class SignupPage implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);

  /** The invite code, from ?invite= in the link. */
  readonly invite = input('');

  protected readonly passwordMax = PASSWORD_MAX;
  protected readonly email = signal('');
  protected readonly password = signal('');
  protected readonly onlineId = signal('');
  protected readonly checking = signal(true);
  protected readonly inviteError = signal('');
  protected readonly busy = signal(false);
  protected readonly error = signal('');

  protected readonly rules = computed(() =>
    PASSWORD_RULES.map((rule) => ({ label: rule.label, met: rule.test(this.password()) })),
  );

  async ngOnInit(): Promise<void> {
    if (!this.invite()) {
      this.inviteError.set('You need an invite link to make an account. Ask a friend for one.');
      this.checking.set(false);
      return;
    }
    try {
      this.inviteError.set((await this.auth.checkInvite(this.invite())) ?? '');
    } catch {
      this.inviteError.set('No connection. Check your internet and open the link again.');
    } finally {
      this.checking.set(false);
    }
  }

  protected value(event: Event): string {
    return (event.target as HTMLInputElement).value;
  }

  protected async create(event: Event): Promise<void> {
    event.preventDefault();
    this.error.set('');
    if (!/^\S+@\S+\.\S+$/.test(this.email().trim())) {
      this.error.set('Enter your email address.');
      return;
    }
    if (!passwordOk(this.password())) {
      this.error.set('Your password needs everything in the list above.');
      return;
    }
    this.busy.set(true);
    try {
      const { psnError } = await this.auth.signUp(
        this.invite(),
        this.email(),
        this.password(),
        this.onlineId(),
      );
      await this.router.navigateByUrl('/');
      if (psnError) {
        this.toast.error(`Account made, but PlayStation didn't connect: ${psnError}`);
      } else {
        this.toast.show('Welcome to Questloggd');
      }
    } catch (e) {
      console.error('Sign-up failed', e);
      this.error.set(
        e instanceof TypeError
          ? 'No connection. Check your internet and try again.'
          : (e as Error).message,
      );
    } finally {
      this.busy.set(false);
    }
  }
}
