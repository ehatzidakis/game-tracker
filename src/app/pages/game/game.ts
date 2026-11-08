import { Component, computed, DestroyRef, effect, inject, input, signal } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { RouterLink } from '@angular/router';
import { injectQuery } from '@tanstack/angular-query-experimental';
import {
  LucideCalendarCheck,
  LucideChevronRight,
  LucideCircleCheck,
  LucideClock,
  LucideDisc3,
  LucideEuro,
  LucideExternalLink,
  LucidePencil,
  LucidePlus,
  LucideStore,
} from '@lucide/angular';
import { releaseDatesOf } from '../../../../api/_lib/igdb-sync.js';
import {
  COMPLETIONS,
  isDlc,
  statusLabel,
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
import { formatPlaytime } from '../../core/playtime';
import {
  coverUrl,
  DLC_GAME_TYPES,
  dlcsOf,
  IgdbService,
  linksOf,
  seriesOf,
  type GameSummary,
} from '../../core/igdb';
import { OpenCriticService } from '../../core/opencritic';
import { LibraryService } from '../../core/library.service';
import { PageTitle } from '../../core/page-title';
import { PushService } from '../../core/push.service';
import { ToastService } from '../../core/toast.service';
import { Cover } from '../../shared/cover';
import { RatingSlider } from '../../shared/rating-slider';
import { ChoiceSheet } from '../../shared/choice-sheet';
import { DetailsSheet, parsePrice, type SheetFields } from '../../shared/details-sheet';
import { FitWidth, Grow } from '../../shared/fit-content';

/** How many DLC (or series games) a game's page lists before "Show all". */
const SHOWN_DLCS = 6;
const COUNT = new Intl.NumberFormat('en-GB');
const SHORT_DATE = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});

const COMMON_STORES = ['PlayStation Store', 'Amazon'];

/** IGDB's time to beat, in your completion levels. */
const TIME_TO_BEAT = [
  { field: 'hastily', label: 'Main story', completion: 'main' },
  { field: 'normally', label: 'Main + sides', completion: 'main_sides' },
  { field: 'completely', label: 'Completionist', completion: 'platinum' },
] as const;

@Component({
  selector: 'app-game',
  imports: [
    Cover,
    RatingSlider,
    NgTemplateOutlet,
    RouterLink,
    FitWidth,
    Grow,
    LucideCalendarCheck,
    LucideChevronRight,
    LucideCircleCheck,
    LucideClock,
    LucideDisc3,
    LucideEuro,
    LucideExternalLink,
    LucidePencil,
    LucidePlus,
    LucideStore,
  ],
  templateUrl: './game.html',
})
export class GamePage {
  /** Route parameter: the IGDB game ID. */
  readonly id = input.required<string>();

  private readonly igdb = inject(IgdbService);
  private readonly openCriticService = inject(OpenCriticService);
  private readonly sheet = inject(ChoiceSheet);
  private readonly detailsSheet = inject(DetailsSheet);
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

  private readonly ttb = injectQuery(() => ({
    queryKey: ['igdb-time-to-beat', this.gameId()],
    queryFn: () => this.igdb.timeToBeat(this.gameId()),
    enabled: Number.isInteger(this.gameId()),
    staleTime: 24 * 60 * 60_000,
  }));

  /** OpenCritic's verdict. The server keeps it fresh, so it's fine to keep for a few hours here. */
  private readonly openCriticQuery = injectQuery(() => ({
    queryKey: ['opencritic', this.gameId()],
    queryFn: () => this.openCriticService.score(this.gameId()),
    enabled: Number.isInteger(this.gameId()),
    staleTime: 6 * 60 * 60_000,
    retry: false,
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

  protected readonly genres = computed(
    () => this.details.data()?.genres?.map((g) => g.name) ?? this.tracked()?.genres ?? [],
  );

  /** "1 day before, at 13:00". */
  protected readonly alertWhen = computed(() => {
    const { notifyDaysBefore: days, notifyTime } = this.library.settings();
    const when = days === 0 ? 'On the day' : `${days} ${days === 1 ? 'day' : 'days'} before`;
    return `${when}, at ${notifyTime}`;
  });

  /**
   * Which of your fields apply: hours once a game is out and yours, the completed date once
   * it's completed, purchase details once you own or pre-ordered it. Null when none do.
   */
  protected readonly editableFields = computed<SheetFields | null>(() => {
    const t = this.tracked();
    if (!t) return null;
    const owned = t.status !== 'wishlist';
    const fields = {
      hours: owned && this.released(),
      completed: t.status === 'completed',
      purchase: owned || !!t.preordered,
    };
    return fields.hours || fields.completed || fields.purchase ? fields : null;
  });

  /** "34h 21m playtime", "Completed 7 Nov 2026", "€69.99", … Only what you've filled in. */
  protected readonly myData = computed(() => {
    const t = this.tracked();
    const fields = this.editableFields();
    if (!t || !fields) return [];
    const items: { icon: string; label: string }[] = [];
    const played = formatPlaytime(t.hoursPlayed);
    if (fields.hours && played) items.push({ icon: 'hours', label: `${played} playtime` });
    if (fields.completed && t.completedAt) {
      items.push({ icon: 'completed', label: `Completed ${SHORT_DATE.format(t.completedAt)}` });
    }
    if (fields.purchase) {
      if (t.pricePaid) items.push({ icon: 'price', label: t.pricePaid.toFixed(2) });
      if (t.boughtFrom) items.push({ icon: 'store', label: t.boughtFrom });
      if (t.orderedOn) {
        const when = SHORT_DATE.format(new Date(`${t.orderedOn}T12:00:00`));
        items.push({ icon: 'date', label: `${t.preordered ? 'Preordered' : 'Bought'} ${when}` });
      }
      if (t.physical) items.push({ icon: 'physical', label: 'Physical copy' });
    }
    return items;
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

  /** "Main story 46 h", with your completion level in bold. Null when IGDB has no numbers. */
  protected readonly timeToBeat = computed(() => {
    const t = this.ttb.data();
    if (!t) return null;
    const yours = this.tracked()?.completion;
    const rows = TIME_TO_BEAT.flatMap((row) => {
      const seconds = t[row.field];
      return seconds
        ? [{ label: row.label, hours: Math.round(seconds / 3600), yours: yours === row.completion }]
        : [];
    });
    return rows.length ? rows : null;
  });
  /** HowLongToBeat's search for this game (it has no API to ask directly). */
  protected readonly hltbUrl = computed(
    () => `https://howlongtobeat.com/?q=${encodeURIComponent(this.name())}`,
  );
  protected readonly ttbPlayers = computed(() => COUNT.format(this.ttb.data()?.count ?? 0));

  /**
   * OpenCritic's Top Critic Average with a link to the reviews, and the players' score from IGDB
   * (OpenCritic has none). Null when OpenCritic has no page for the game (or can't be asked
   * today): the section hides.
   */
  protected readonly openCritic = computed(() => {
    const score = this.openCriticQuery.data();
    if (score?.status !== 'found') return null;
    const critics = score.numTopCriticReviews;
    const d = this.details.data();
    const players = d?.rating && d.rating_count ? d.rating_count : 0;
    return {
      url: score.url,
      topCriticScore: score.topCriticScore,
      topCritics: `${COUNT.format(critics)} ${critics === 1 ? 'top critic' : 'top critics'}`,
      playerRating: players ? Math.round(d!.rating!) : null,
      players: `${COUNT.format(players)} ${players === 1 ? 'rating' : 'ratings'} on IGDB`,
    };
  });

  /** Other games in the same series. */
  protected readonly series = computed(() => {
    const d = this.details.data();
    return d ? seriesOf(d) : null;
  });
  protected readonly allSeries = signal(false);
  /** Series, Details and Links start folded on every game; tap the heading to open. */
  private readonly opened = signal<ReadonlySet<string>>(new Set());
  protected isOpen(section: string): boolean {
    return this.opened().has(section);
  }
  protected toggleOpen(section: string): void {
    this.opened.update((open) => {
      const next = new Set(open);
      if (next.has(section)) next.delete(section);
      else next.add(section);
      return next;
    });
  }
  protected readonly shownSeries = computed(() => {
    const games = this.series()?.games ?? [];
    return this.allSeries() ? games : games.slice(0, SHOWN_DLCS);
  });

  /** Genres, themes, modes, publisher and age rating. */
  protected readonly facts = computed(() => {
    const d = this.details.data();
    const list = (items?: { name: string }[]) => (items ?? []).map((i) => i.name).join(', ');
    const pegi = d?.age_ratings?.find((a) => a.organization?.name === 'PEGI')?.rating_category;
    const publishers = (d?.involved_companies ?? [])
      .filter((c) => c.publisher && c.company)
      .map((c) => c.company!.name);
    return [
      { label: 'Genres', value: this.genres().join(', ') },
      { label: 'Themes', value: list(d?.themes) },
      { label: 'Modes', value: list(d?.game_modes) },
      { label: publishers.length > 1 ? 'Publishers' : 'Publisher', value: publishers.join(', ') },
      { label: 'Age rating', value: pegi ? `PEGI ${pegi.rating}` : '' },
    ].filter((f) => f.value);
  });

  /** Official website and stores. */
  protected readonly links = computed(() => {
    const d = this.details.data();
    return d ? linksOf(d) : [];
  });

  protected readonly statuses = STATUSES;
  protected readonly completions = COMPLETIONS;
  /** The rating under your finger while you slide, shown in the heading. */
  protected readonly ratingPreview = signal<number | null>(null);
  /** The rating bar only moves after you tap Edit. */
  protected readonly editingRating = signal(false);
  protected readonly platformLabel = platformLabel;
  protected readonly coverUrl = coverUrl;
  protected readonly dateFieldValue = dateFieldValue;
  protected readonly formatPlaytime = formatPlaytime;

  constructor() {
    // The top bar shows the game's name once you scroll past the artwork.
    const pageTitle = inject(PageTitle);
    effect(() => pageTitle.override.set(this.name() || null));
    inject(DestroyRef).onDestroy(() => pageTitle.override.set(null));

    // Going from a game to one of its DLC reuses this screen: start it fresh.
    effect(() => {
      this.gameId();
      this.allDlcs.set(false);
      this.allSeries.set(false);
      this.opened.set(new Set());
      this.editingRating.set(false);
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
      const details = await this.detailsSheet.askPurchase(
        'purchase',
        t.name,
        today(),
        this.stores(),
      );
      const now = this.tracked();
      if (details && now) this.library.edit(now, details);
    }
  }

  protected setCompletion(completion: Completion): void {
    const t = this.tracked();
    if (t && t.completion !== completion) this.library.edit(t, { completion });
  }

  /** 1–10 in half points, or null to clear it. */
  protected setRating(rating: number | null): void {
    const t = this.tracked();
    if (t && t.rating !== rating) this.library.edit(t, { rating });
  }

  protected async togglePreorder(): Promise<void> {
    const t = this.tracked();
    if (!t) return;
    const on = !t.preordered;
    this.library.setPreordered(t, on);
    if (!on) return;
    const details = await this.detailsSheet.askPurchase('preorder', t.name, today(), this.stores());
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

  /**
   * For DLC and series rows: "Completed 3 Mar 2027", "Owned", "On wishlist", your status for a
   * game, or its release date if you don't track it.
   */
  protected rowState(dlc: GameSummary): string {
    const t = this.library.byId().get(dlc.id);
    if (t && !isDlc(t)) {
      return t.preordered ? `${statusLabel(t.status)} · Pre-ordered` : statusLabel(t.status);
    }
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

  /** The completed date of a DLC, set on its own page. */
  protected setCompletedOn(event: Event): void {
    const t = this.tracked();
    const completedAt = fromDateField((event.target as HTMLInputElement).value);
    if (t && completedAt !== t.completedAt) this.library.edit(t, { completedAt });
  }

  /** "Edit my data": hours, completed date and purchase details in a sheet. */
  protected async editMyData(): Promise<void> {
    const t = this.tracked();
    const fields = this.editableFields();
    if (!t || !fields) return;
    const data = await this.detailsSheet.edit(t, fields, today(), this.stores());
    const now = this.tracked();
    if (data && now) this.library.edit(now, data);
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
