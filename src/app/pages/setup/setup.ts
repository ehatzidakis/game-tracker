import { Component, computed, effect, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { LucideCheck, LucideTrophy } from '@lucide/angular';
import type { PsnGameRecord } from '../../../../api/_lib/models.js';
import { LibraryService } from '../../core/library.service';
import { formatPlaytime } from '../../core/playtime';
import { PsnAddAll } from '../../core/psn-add-all.service';
import { PsnService } from '../../core/psn.service';
import { ToastService } from '../../core/toast.service';
import { Cover } from '../../shared/cover';
import { Wordmark } from '../../shared/wordmark';
import {
  initialMarks,
  SETUP_STEPS,
  setupChoices,
  setupCounts,
  shownAt,
  toggled,
  type SetupMarks,
} from './setup-steps';

/**
 * First-time setup (/setup): after making an account with a PlayStation name, or linking one in
 * Settings with an empty library. Your PlayStation catalog (the games found on IGDB, most played
 * first) in three steps: Completed (Platinums already marked), Shelved, Backlog; each step shows
 * only the games not marked before. Then a summary, and they're added (api/psn-import.ts).
 * Games left unmarked stay out, to add later from Settings → PlayStation.
 */
@Component({
  selector: 'app-setup',
  imports: [Cover, Wordmark, LucideCheck, LucideTrophy],
  template: `
    <main
      class="min-h-dvh bg-ground px-4 pt-[calc(env(safe-area-inset-top)+12px)] pb-[calc(env(safe-area-inset-bottom)+96px)]"
    >
      <div class="flex min-h-11 items-center justify-between">
        <app-wordmark class="text-[20px] leading-6 font-bold" />
        @if (!busy()) {
          <button
            type="button"
            class="-mr-2 min-h-11 px-2 text-[17px] text-accent active:opacity-60"
            (click)="later()"
          >
            Not now
          </button>
        }
      </div>

      @if (!ready()) {
        <p class="mt-16 text-center text-[15px] leading-5 text-muted" role="status">
          Reading your PlayStation games…
        </p>
      } @else if (!pool().length) {
        <h1 class="mt-6 text-[28px] leading-8.5 font-bold">Nothing to set up</h1>
        <p class="mt-2 text-[15px] leading-5 text-muted">
          Your PlayStation games are in your Library already, or IGDB doesn't have them. You'll find
          them all in Settings → PlayStation → Games.
        </p>
      } @else if (step() < steps.length) {
        @let s = steps[step()];
        <p class="mt-6 text-[13px] leading-4.5 font-semibold text-muted uppercase">
          Step {{ step() + 1 }} of {{ steps.length }} · {{ s.title }}
        </p>
        <h1 class="mt-1 text-[28px] leading-8.5 font-bold text-balance">{{ s.question }}</h1>
        <p class="mt-2 text-[15px] leading-5 text-muted">{{ s.hint }}</p>

        <div class="mt-4 flex min-h-11 items-center justify-between text-[15px] leading-5">
          <span class="num text-muted" aria-live="polite"
            >{{ markedHere() }} of {{ shown().length }} marked</span
          >
          @if (shown().length) {
            <button
              type="button"
              class="-mr-2 min-h-11 px-2 text-accent active:opacity-60"
              (click)="markAll()"
            >
              {{ allMarked() ? 'Clear' : 'Mark all' }}
            </button>
          }
        </div>

        @if (shown().length) {
          <ul class="mt-2 grid grid-cols-3 gap-x-3 gap-y-5">
            @for (g of shown(); track g.conceptId) {
              @let marked = marks().get(g.conceptId) === s.list;
              <li>
                <button
                  type="button"
                  class="block w-full text-left"
                  [attr.aria-pressed]="marked"
                  (click)="toggle(g)"
                >
                  <app-cover
                    [coverId]="g.igdb?.coverId"
                    [name]="nameOf(g)"
                    [class]="marked ? 'outline-2 outline-offset-2 outline-accent' : ''"
                  >
                    <!-- iOS photo-picker style: an empty ring, a blue check once marked. -->
                    <span
                      class="absolute top-1.5 right-1.5 grid size-6 place-items-center rounded-full"
                      [class]="
                        marked
                          ? 'bg-accent-fill text-white ring-[1.5px] ring-white'
                          : 'bg-black/30 ring-[1.5px] ring-white/80'
                      "
                      aria-hidden="true"
                    >
                      @if (marked) {
                        <svg lucideCheck [size]="14" [strokeWidth]="3"></svg>
                      }
                    </span>
                    @if (g.platinumEarned) {
                      <span
                        class="absolute right-1 bottom-1 grid size-5 place-items-center rounded-full bg-black/75 ring-[0.5px] ring-white/20 badge-glass"
                        aria-hidden="true"
                      >
                        <svg lucideTrophy [size]="11" [strokeWidth]="2.25"></svg>
                      </span>
                    }
                  </app-cover>
                  <p class="mt-1.5 line-clamp-2 text-[13px] leading-4 tracking-normal">
                    {{ nameOf(g) }}
                  </p>
                  <p class="num text-[12px] leading-4 tracking-normal text-muted">
                    {{ played(g) }}{{ g.platinumEarned ? ' · Platinum' : '' }}
                  </p>
                </button>
              </li>
            }
          </ul>
        } @else {
          <p class="mt-8 text-center text-[15px] leading-5 text-muted">
            Every game is marked already. Go on to the next step.
          </p>
        }
      } @else {
        @let c = counts();
        <p class="mt-6 text-[13px] leading-4.5 font-semibold text-muted uppercase">Ready</p>
        <h1 class="mt-1 text-[28px] leading-8.5 font-bold text-balance">
          @if (c.total) {
            Add {{ gamesLabel(c.total) }} to your Library?
          } @else {
            Nothing marked
          }
        </h1>
        <div class="grouped mt-6">
          @for (s of steps; track s.list) {
            <div class="row">
              <span class="flex-1">{{ s.title }}</span>
              <span class="row-value num">{{ c[s.list] }}</span>
            </div>
          }
        </div>
        <p class="group-footer">
          @if (c.leftOut) {
            {{ gamesLabel(c.leftOut) }} you didn't mark {{ c.leftOut === 1 ? 'is' : 'are' }} left
            out.
          }
          You can add more later from Settings → PlayStation, and move any game to another list from
          its page. Playtime and trophies come from PlayStation.
        </p>
      }
    </main>

    @if (ready() && pool().length) {
      <div
        class="fixed inset-x-0 bottom-0 z-10 border-t-[0.5px] border-sep bg-ground/85 px-4 pt-3 pb-[calc(env(safe-area-inset-bottom)+12px)] backdrop-blur-xl"
      >
        <div class="flex gap-3">
          @if (step() > 0) {
            <button
              type="button"
              class="min-h-12.5 flex-1 rounded-xl bg-raised text-[17px] text-accent-raised active:bg-pressed disabled:opacity-40"
              [disabled]="busy()"
              (click)="back()"
            >
              Back
            </button>
          }
          <button
            type="button"
            class="button-primary flex-2 disabled:opacity-60"
            [disabled]="busy()"
            (click)="next()"
          >
            {{ nextLabel() }}
          </button>
        </div>
      </div>
    }
  `,
})
export class SetupPage {
  private readonly psn = inject(PsnService);
  private readonly library = inject(LibraryService);
  private readonly addAll = inject(PsnAddAll);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);

  protected readonly steps = SETUP_STEPS;
  /** 0–2: the steps; 3: the summary. */
  protected readonly step = signal(0);
  protected readonly marks = signal<SetupMarks>(new Map());
  protected readonly busy = signal(false);
  private readonly addingCount = signal(0);
  private started = false;

  protected readonly ready = computed(() => this.psn.loaded() && this.library.loaded());
  /** Kept as it was while adding, so the games don't vanish one by one as they arrive. */
  private readonly frozen = signal<PsnGameRecord[] | null>(null);
  /** Your PlayStation games found on IGDB and not in the library, most played first. */
  protected readonly pool = computed(() => this.frozen() ?? this.addAll.addable());
  protected readonly shown = computed(() => shownAt(this.step(), this.pool(), this.marks()));
  protected readonly markedHere = computed(() => {
    const list = SETUP_STEPS[this.step()]?.list;
    return this.shown().filter((g) => this.marks().get(g.conceptId) === list).length;
  });
  protected readonly allMarked = computed(
    () => this.shown().length > 0 && this.markedHere() === this.shown().length,
  );
  protected readonly counts = computed(() => setupCounts(this.pool(), this.marks()));
  protected readonly nextLabel = computed(() => {
    if (this.busy()) return `Adding ${this.gamesLabel(this.addingCount())}…`;
    const next = SETUP_STEPS[this.step() + 1];
    if (this.step() < SETUP_STEPS.length - 1) return `Next: ${next.title}`;
    if (this.step() === SETUP_STEPS.length - 1) return 'Review';
    const total = this.counts().total;
    return total ? `Add ${this.gamesLabel(total)}` : 'Done';
  });

  constructor() {
    // Start with the Platinums marked, once the games are there.
    effect(() => {
      if (this.started || !this.ready() || !this.pool().length) return;
      this.started = true;
      this.marks.set(initialMarks(this.pool()));
    });
  }

  protected nameOf(game: PsnGameRecord): string {
    return game.igdb?.name ?? game.name;
  }

  protected played(game: PsnGameRecord): string {
    return formatPlaytime(game.playSeconds / 3600) || 'Under a minute';
  }

  protected gamesLabel(n: number): string {
    return n === 1 ? '1 game' : `${n} games`;
  }

  protected toggle(game: PsnGameRecord): void {
    const list = SETUP_STEPS[this.step()].list;
    this.marks.set(toggled(this.marks(), game.conceptId, list));
  }

  protected markAll(): void {
    const list = SETUP_STEPS[this.step()].list;
    const clear = this.allMarked();
    const next = new Map(this.marks());
    for (const g of this.shown()) {
      if (clear) next.delete(g.conceptId);
      else next.set(g.conceptId, list);
    }
    this.marks.set(next);
  }

  protected back(): void {
    this.step.update((s) => Math.max(0, s - 1));
    window.scrollTo({ top: 0 });
  }

  protected async next(): Promise<void> {
    if (this.step() < SETUP_STEPS.length) {
      this.step.update((s) => s + 1);
      window.scrollTo({ top: 0 });
      return;
    }
    const choices = setupChoices(this.pool(), this.marks());
    if (!choices.length) return this.later();
    this.addingCount.set(choices.length);
    this.frozen.set(this.pool());
    this.busy.set(true);
    try {
      const { added, synced } = await this.psn.importGames(choices);
      this.toast.show(
        `Added ${this.gamesLabel(added)} to your Library` +
          (synced ? '' : '. Playtime arrives with the next sync'),
      );
      await this.router.navigateByUrl('/library');
    } catch (error) {
      this.frozen.set(null);
      this.toast.error((error as Error).message, error);
    } finally {
      this.busy.set(false);
    }
  }

  protected later(): void {
    void this.router.navigateByUrl('/');
  }
}
