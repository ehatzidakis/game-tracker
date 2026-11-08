import { Component, computed, DestroyRef, effect, inject, input, signal } from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';
import { NgTemplateOutlet } from '@angular/common';
import { RouterLink } from '@angular/router';
import { injectQuery } from '@tanstack/angular-query-experimental';
import { LucideChevronRight, LucidePlay, LucidePlus } from '@lucide/angular';
import { releaseDatesOf } from '../../../../api/_lib/igdb-sync.js';
import {
  COMPLETIONS,
  STATUSES,
  type Completion,
  type Release,
  type Status,
} from '../../../../api/_lib/models.js';
import {
  PLATFORMS,
  platformIgdbId,
  platformLabel,
  type PlatformKey,
} from '../../../../api/_lib/platforms.js';
import { pickRelease } from '../../../../api/_lib/release.js';
import { countdown, dateFieldValue, fromDateField, isReleased, today } from '../../core/dates';
import { coverUrl, DLC_GAME_TYPES, dlcsOf, IgdbService, type DlcSummary } from '../../core/igdb';
import { LibraryService } from '../../core/library.service';
import { PageTitle } from '../../core/page-title';
import { PushService } from '../../core/push.service';
import { ToastService } from '../../core/toast.service';
import { Cover } from '../../shared/cover';
import { ChoiceSheet } from '../../shared/choice-sheet';
import { parsePrice, PreorderSheet } from '../../shared/preorder-sheet';

/** How many DLC a game's page lists before "Show all". */
const SHOWN_DLCS = 6;
const SHORT_DATE = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});

const COMMON_STORES = ['PlayStation Store', 'Amazon', 'Xbox Store', 'Steam', 'Nintendo eShop'];

@Component({
  selector: 'app-game',
  imports: [Cover, NgTemplateOutlet, RouterLink, LucideChevronRight, LucidePlay, LucidePlus],
  templateUrl: './game.html',
})
export class GamePage {
  /** Route parameter: the IGDB game ID. */
  readonly id = input.required<string>();

  private readonly igdb = inject(IgdbService);
  private readonly sheet = inject(ChoiceSheet);
  private readonly preorderSheet = inject(PreorderSheet);
  private readonly toast = inject(ToastService);
  protected readonly library = inject(LibraryService);
  protected readonly push = inject(PushService);

  protected readonly gameId = computed(() => Number(this.id()));

  protected readonly details = injectQuery(() => ({
    queryKey: ['igdb-game', this.gameId()],
    queryFn: () => this.igdb.game(this.gameId()),
    enabled: Number.isInteger(this.gameId()),
    staleTime: 60 * 60_000,
  }));

  /** Your copy, if the game is in your library. Works offline. */
  protected readonly tracked = computed(() => this.library.byId().get(this.gameId()));

  protected readonly name = computed(() => this.details.data()?.name ?? this.tracked()?.name ?? '');
  protected readonly coverId = computed(
    () => this.tracked()?.coverId ?? this.details.data()?.cover?.image_id ?? null,
  );
  protected readonly developer = computed(
    () =>
      this.tracked()?.developer ??
      this.details.data()?.involved_companies?.find((c) => c.developer)?.company?.name ??
      null,
  );
  protected readonly heroUrl = computed(() => {
    const d = this.details.data();
    // Screenshots first: IGDB "artworks" are often logos or text.
    const id = d?.screenshots?.[0]?.image_id ?? d?.artworks?.[0]?.image_id;
    return id ? coverUrl(id, 'screenshot_big') : null;
  });

  /** The release for your platform (or your default platform if the game isn't added yet). */
  protected readonly release = computed<Release>(() => {
    const t = this.tracked();
    if (t) return { date: t.releaseDate, precision: t.releasePrecision, label: t.releaseLabel };
    const d = this.details.data();
    const platform = platformIgdbId(this.library.settings().defaultPlatform);
    return d
      ? pickRelease(releaseDatesOf(d), platform)
      : { date: null, precision: 'tbd', label: '' };
  });
  protected readonly countdown = computed(() =>
    countdown({ releaseDate: this.release().date, releasePrecision: this.release().precision }),
  );
  protected readonly released = computed(() =>
    isReleased({ releaseDate: this.release().date, releasePrecision: this.release().precision }),
  );

  /** Our four platforms this game is on; all four if IGDB doesn't say. */
  protected readonly ourPlatforms = computed(() => {
    const on = new Set(
      this.details.data()?.platforms?.map((p) => p.id) ?? this.tracked()?.platforms ?? [],
    );
    const ours = PLATFORMS.filter((p) => on.has(p.igdbId));
    return ours.length ? ours : PLATFORMS;
  });
  protected readonly otherPlatforms = computed(() =>
    (this.details.data()?.platforms ?? [])
      .filter((p) => !PLATFORMS.some((ours) => ours.igdbId === p.id))
      .map((p) => p.abbreviation ?? p.name),
  );

  protected readonly video = computed(() => {
    const v = this.details.data()?.videos?.[0];
    // YouTube IDs only, so the embed URL below can't point anywhere else.
    return v && /^[\w-]{6,20}$/.test(v.video_id) ? v : null;
  });
  private readonly sanitizer = inject(DomSanitizer);
  protected readonly videoEmbedUrl = computed(() => {
    const v = this.video();
    return v
      ? this.sanitizer.bypassSecurityTrustResourceUrl(
          `https://www.youtube-nocookie.com/embed/${v.video_id}?autoplay=1&playsinline=1`,
        )
      : null;
  });
  protected readonly screenshots = computed(() => this.details.data()?.screenshots ?? []);
  protected readonly genres = computed(
    () => this.details.data()?.genres?.map((g) => g.name) ?? this.tracked()?.genres ?? [],
  );

  /** "1 day before, at 13:00". */
  protected readonly alertWhen = computed(() => {
    const { notifyDaysBefore: days, notifyTime } = this.library.settings();
    const when = days === 0 ? 'On the day' : `${days} ${days === 1 ? 'day' : 'days'} before`;
    return `${when}, at ${notifyTime}`;
  });

  /** Stores you've bought from before, then common ones, as suggestions. */
  protected readonly stores = computed(() => {
    const used = this.library
      .games()
      .map((g) => g.boughtFrom)
      .filter((s): s is string => !!s);
    return [...new Set([...used, ...COMMON_STORES])];
  });

  /** A DLC or expansion: it gets owned / completed switches instead of the full game controls. */
  protected readonly isDlcPage = computed(
    () =>
      this.tracked()?.parentId != null ||
      DLC_GAME_TYPES.includes(this.details.data()?.game_type ?? -1),
  );
  /** For DLC: the main game. */
  protected readonly parent = computed(() => {
    const p = this.details.data()?.parent_game;
    if (p) return { id: p.id, name: p.name };
    const t = this.tracked();
    return t?.parentId ? { id: t.parentId, name: t.parentName ?? '' } : null;
  });
  protected readonly dlcOwned = computed(() => {
    const t = this.tracked();
    return !!t && t.status !== 'wishlist';
  });

  /** For main games: their DLC and expansions, the first few unless you ask for all. */
  protected readonly dlcs = computed(() => {
    const d = this.details.data();
    return d ? dlcsOf(d) : [];
  });
  protected readonly allDlcs = signal(false);
  protected readonly shownDlcs = computed(() =>
    this.allDlcs() ? this.dlcs() : this.dlcs().slice(0, SHOWN_DLCS),
  );

  protected readonly playingVideo = signal(false);
  protected readonly summaryOpen = signal(false);

  protected readonly statuses = STATUSES;
  protected readonly completions = COMPLETIONS;
  protected readonly ratings = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  protected readonly platformLabel = platformLabel;
  protected readonly coverUrl = coverUrl;
  protected readonly dateFieldValue = dateFieldValue;

  constructor() {
    // The top bar shows the game's name once you scroll past the artwork.
    const pageTitle = inject(PageTitle);
    effect(() => pageTitle.override.set(this.name() || null));
    inject(DestroyRef).onDestroy(() => pageTitle.override.set(null));

    // Going from a game to one of its DLC reuses this screen: start it fresh.
    effect(() => {
      this.gameId();
      this.playingVideo.set(false);
      this.summaryOpen.set(false);
      this.allDlcs.set(false);
    });

    // Keep your copy of the IGDB data current (e.g. a release date that moved).
    effect(() => {
      const t = this.tracked();
      const d = this.details.data();
      if (t && d) this.library.refresh(t, d);
    });
  }

  protected async add(): Promise<void> {
    const d = this.details.data();
    if (!d) return;
    const choice = await this.sheet.addTo(d.name, this.released() ? 'backlog' : 'wishlist');
    if (choice) this.library.add(d, choice.status, choice.completion);
  }

  protected async setStatus(status: Status): Promise<void> {
    const t = this.tracked();
    if (!t || t.status === status) return;
    if (status === 'completed') {
      // Completing a game always asks how far you got. Cancel leaves the status as it was.
      const completion = await this.sheet.completion(t.name);
      const now = this.tracked();
      if (!completion || !now) return;
      this.library.setStatus(now, status, completion);
    } else {
      this.library.setStatus(t, status);
    }
    // Moving a released game out of Wishlist means you bought it: ask what you paid (optional),
    // unless you already entered that when you pre-ordered it.
    if (t.status === 'wishlist' && status !== 'shelved' && this.released() && !t.preordered) {
      const details = await this.preorderSheet.ask('purchase', t.name, today(), this.stores());
      const now = this.tracked();
      if (details && now) this.library.edit(now, details);
    }
  }

  protected setCompletion(completion: Completion): void {
    const t = this.tracked();
    if (t && t.completion !== completion) this.library.edit(t, { completion });
  }

  protected setRating(rating: number): void {
    const t = this.tracked();
    if (t) this.library.edit(t, { rating: t.rating === rating ? null : rating });
  }

  protected setHours(event: Event): void {
    const t = this.tracked();
    const input = event.target as HTMLInputElement;
    if (!t) return;
    const text = input.value.trim().replace(',', '.');
    const hours = text === '' ? null : Math.round(Number(text) * 10) / 10;
    if (hours !== null && (!Number.isFinite(hours) || hours < 0 || hours > 100_000)) {
      input.value = t.hoursPlayed?.toString() ?? '';
      this.toast.error('Hours should be a number, like 12 or 12.5.');
      return;
    }
    if (hours !== t.hoursPlayed) this.library.edit(t, { hoursPlayed: hours });
  }

  protected async togglePreorder(): Promise<void> {
    const t = this.tracked();
    if (!t) return;
    const on = !t.preordered;
    this.library.setPreordered(t, on);
    if (!on) return;
    const details = await this.preorderSheet.ask('preorder', t.name, today(), this.stores());
    const now = this.tracked();
    if (details && now) this.library.edit(now, details);
  }

  protected setPrice(event: Event): void {
    const t = this.tracked();
    const input = event.target as HTMLInputElement;
    if (!t) return;
    const price = parsePrice(input.value);
    if (price === undefined) {
      input.value = t.pricePaid != null ? t.pricePaid.toFixed(2) : '';
      this.toast.error('Price should be a number, like 69.99.');
      return;
    }
    input.value = price != null ? price.toFixed(2) : '';
    if (price !== (t.pricePaid ?? null)) this.library.edit(t, { pricePaid: price });
  }

  protected setStore(event: Event): void {
    const t = this.tracked();
    const store = (event.target as HTMLInputElement).value.trim().slice(0, 60) || null;
    if (t && store !== (t.boughtFrom ?? null)) this.library.edit(t, { boughtFrom: store });
  }

  protected setOrderedOn(event: Event): void {
    const t = this.tracked();
    const value = (event.target as HTMLInputElement).value;
    const date = /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null;
    if (t && date !== (t.orderedOn ?? null)) this.library.edit(t, { orderedOn: date });
  }

  protected setCompletedOn(event: Event): void {
    const t = this.tracked();
    const completedAt = fromDateField((event.target as HTMLInputElement).value);
    if (t && completedAt !== t.completedAt) this.library.edit(t, { completedAt });
  }

  /** "Completed 3 Mar 2027", "Owned", "On wishlist", or its release date if you don't track it. */
  protected dlcState(dlc: DlcSummary): string {
    const t = this.library.byId().get(dlc.id);
    if (t?.status === 'completed') {
      return t.completedAt ? `Completed ${SHORT_DATE.format(t.completedAt)}` : 'Completed';
    }
    if (t && t.status !== 'wishlist') return 'Owned';
    if (t) return t.preordered ? 'On wishlist · Pre-ordered' : 'On wishlist';
    if (!dlc.first_release_date) return 'TBA';
    const ms = dlc.first_release_date * 1000;
    return ms > Date.now() ? `Out ${SHORT_DATE.format(ms)}` : String(new Date(ms).getFullYear());
  }

  protected toggleDlcWishlist(): void {
    const t = this.tracked();
    if (t) {
      this.library.remove(t);
      return;
    }
    const d = this.details.data();
    if (d) this.library.add(d, 'wishlist', null, this.parent());
  }

  protected toggleDlcOwned(): void {
    const t = this.tracked();
    if (t && t.status !== 'wishlist') {
      this.remove();
    } else if (t) {
      this.library.setStatus(t, 'backlog');
    } else {
      const d = this.details.data();
      if (d) this.library.add(d, 'backlog', null, this.parent());
    }
  }

  protected toggleDlcCompleted(): void {
    const t = this.tracked();
    if (!t) return;
    if (t.status === 'completed') {
      this.library.setStatus(t, 'backlog');
      this.library.edit(t, { completedAt: null });
    } else {
      this.library.setStatus(t, 'completed');
    }
  }

  protected setNotes(event: Event): void {
    const t = this.tracked();
    const notes = (event.target as HTMLTextAreaElement).value;
    if (t && notes !== t.notes) this.library.edit(t, { notes });
  }

  protected toggleNotify(): void {
    const t = this.tracked();
    if (!t) return;
    const notify = !t.notify;
    this.library.edit(t, { notify });
    if (notify && !this.push.enabledHere()) {
      this.toast.show('Alert saved. Turn on notifications in Settings to get it on this phone.');
    }
  }

  protected setPlatform(key: PlatformKey): void {
    const t = this.tracked();
    const d = this.details.data();
    if (!t || t.myPlatform === key) return;
    if (!d) {
      this.toast.error('Game details are still loading. Try again in a moment.');
      return;
    }
    this.library.setPlatform(t, d, key);
  }

  protected remove(): void {
    const t = this.tracked();
    if (!t || !confirm(`Remove ${t.name} from your library?`)) return;
    this.library.remove(t);
  }
}
