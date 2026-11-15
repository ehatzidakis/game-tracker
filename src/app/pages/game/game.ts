import { Component, computed, DestroyRef, effect, inject, input, signal } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { RouterLink } from '@angular/router';
import { injectQuery } from '@tanstack/angular-query-experimental';
import {
  LucideArchive,
  LucideBookmark,
  LucideCalendarCheck,
  LucideChevronRight,
  LucideCircleCheck,
  LucideClock,
  LucideDisc3,
  LucideEuro,
  LucideExternalLink,
  LucideLibraryBig,
  LucidePencil,
  LucidePlay,
  LucidePlus,
  LucideStar,
  LucideStore,
  LucideTrophy,
  LucideFlag,
  LucideGamepad2,
  LucideUsers,
} from '@lucide/angular';
import { eventCompany, igdbEventDocId } from '../../../../api/_lib/igdb-events.js';
import { releaseDatesOf } from '../../../../api/_lib/igdb-sync.js';
import {
  type TrophyCounts,
  MAX_PLAYING,
  completionLabel,
  isDlc,
  statusLabel,
  type Release,
} from '../../../../api/_lib/models.js';
import {
  PLATFORMS,
  platformIgdbId,
  type PlatformKey,
} from '../../../../api/_lib/platforms.js';
import { daysBetween, pickRelease } from '../../../../api/_lib/release.js';
import { countdown, isReleased, today } from '../../core/dates';
import { formatPlaytime } from '../../core/playtime';
import {
  coverUrl,
  DLC_GAME_TYPES,
  dlcsOf,
  IgdbService,
  linksOf,
  remakeOf,
  seriesOf,
  type GameSummary,
} from '../../core/igdb';
import { OpenCriticService } from '../../core/opencritic';
import type { OpenCriticScore } from '../../../../api/_lib/opencritic-match.js';
import { PLAYSTATION } from '../../shared/event-icon';
import { LibraryService } from '../../core/library.service';
import { PageTitle } from '../../core/page-title';
import { PushService } from '../../core/push.service';
import { ToastService } from '../../core/toast.service';
import {
  CardGrid,
  eventDateLine,
  gameMarks,
  yearOf,
  type GridCard,
  type GridFilter,
} from '../../shared/card-grid';
import { Cover } from '../../shared/cover';
import { ChoiceSheet } from '../../shared/choice-sheet';
import { DetailsSheet, parsePrice, type SheetFields } from '../../shared/details-sheet';
import { FitWidth, Grow } from '../../shared/fit-content';
import { ScoreRing } from '../../shared/score-ring';

/** IGDB game types counted as remakes and remasters in a series (remake, remaster, expanded). */
const REMADE_TYPES = [8, 9, 10];
const COUNT = new Intl.NumberFormat('en-GB');

const SHORT_DATE = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});

const COMMON_STORES = ['PlayStation Store', 'Amazon'];

@Component({
  selector: 'app-game',
  imports: [
    CardGrid,
    Cover,
    NgTemplateOutlet,
    RouterLink,
    FitWidth,
    Grow,
    ScoreRing,
    LucideArchive,
    LucideBookmark,
    LucideLibraryBig,
    LucidePlay,
    LucideStar,
    LucideUsers,
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
    LucideTrophy,
    LucideFlag,
    LucideGamepad2,
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

  /** The gaming events IGDB says the game was shown at. */
  private readonly eventsQuery = injectQuery(() => ({
    queryKey: ['igdb-game-events', this.gameId()],
    queryFn: () => this.igdb.eventsOf(this.gameId()),
    enabled: Number.isInteger(this.gameId()),
    staleTime: 6 * 60 * 60_000,
  }));

  /**
   * OpenCritic's verdict. The server keeps it fresh, so it's fine to keep for a few hours here;
   * "can't ask right now" is asked again on the next visit. While asking, the last answer on this
   * phone shows, so the section doesn't pop in late.
   */
  private readonly openCriticQuery = injectQuery(() => ({
    queryKey: ['opencritic', this.gameId()],
    queryFn: () => this.openCriticService.score(this.gameId()),
    enabled: Number.isInteger(this.gameId()),
    staleTime: (query: { state: { data?: OpenCriticScore } }) =>
      query.state.data?.status === 'later' ? 0 : 6 * 60 * 60_000,
    retry: false,
    placeholderData: () => this.openCriticService.cachedScore(this.gameId()),
  }));

  /**
   * OpenCritic's daily allowance is used up and this game hasn't been looked up yet: "Back in
   * about 5 hours". Null otherwise.
   */
  protected readonly openCriticLimit = computed(() => {
    const score = this.openCriticQuery.data();
    if (score?.status !== 'later' || !score.limit) return null;
    if (!score.retryAt) return { when: 'tomorrow' };
    const hours = Math.ceil((score.retryAt - Date.now()) / 3_600_000);
    return {
      when: hours <= 1 ? 'within the hour' : `in about ${hours} hours`,
    };
  });

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
  /**
   * "Santa Monica Studio · Sony Interactive Entertainment", each opening its company page once
   * IGDB's details are in (id null until then). IGDB doesn't mark a main publisher, so it's the
   * first one that isn't also the developer; a self-published game shows one name.
   */
  protected readonly makers = computed(() => {
    const developer = this.developer();
    const companies = this.details.data()?.involved_companies ?? [];
    const developerId = companies.find((c) => c.developer && c.company?.name === developer)?.company
      ?.id;
    const publisher = companies.find(
      (c) => c.publisher && !c.developer && c.company && c.company.name !== developer,
    )?.company;
    return [
      developer ? { id: developerId ?? null, name: developer } : null,
      publisher ? { id: publisher.id ?? null, name: publisher.name } : null,
    ].filter((m) => m !== null);
  });
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

  /**
   * The release dates the game had before, latest change first: "Was 26 May 2026 · delayed 177
   * days · changed 3 Sep 2026". Only moves seen since the app started saving them.
   */
  protected readonly earlierDates = computed(() => {
    const t = this.tracked();
    const history = t?.releaseHistory ?? [];
    const days = (n: number) => `${n} ${n === 1 ? 'day' : 'days'}`;
    return history
      .map((was, i) => {
        // What it changed to: the next entry, or the date the game has now.
        const next = history[i + 1] ?? { date: t!.releaseDate, precision: t!.releasePrecision };
        const exact = was.precision === 'day' && next.precision === 'day';
        const moved = exact && was.date && next.date ? daysBetween(was.date, next.date) : 0;
        return {
          key: was.changedAt,
          label: was.label,
          moved: moved > 0 ? `delayed ${days(moved)}` : moved < 0 ? `${days(-moved)} earlier` : '',
          changed: SHORT_DATE.format(was.changedAt),
        };
      })
      .reverse();
  });

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

  /** PlayStation has a playtime for this game: it fills in your hours, which can't be edited. */
  protected readonly hoursFromPsn = computed(
    () => (this.tracked()?.playstation?.playSeconds ?? 0) > 0,
  );

  /**
   * Which of your fields apply: hours once a game is out and yours (unless PlayStation has them),
   * how far you got once it's completed, purchase details once you own or pre-ordered it. Null
   * when none do.
   */
  protected readonly editableFields = computed<SheetFields | null>(() => {
    const t = this.tracked();
    if (!t) return null;
    const owned = t.status !== 'wishlist';
    const fields = {
      hours: owned && this.released() && !this.hoursFromPsn(),
      completed: t.status === 'completed',
      purchase: owned || !!t.preordered,
    };
    return fields.hours || fields.completed || fields.purchase ? fields : null;
  });

  /**
   * "34h 21m playtime", "Last played 3 Nov 2026", "Completed 7 Nov 2026", "€69.99", … Only what
   * there is: yours, and what PlayStation says.
   */
  protected readonly myData = computed(() => {
    const t = this.tracked();
    const fields = this.editableFields() ?? { hours: false, completed: false, purchase: false };
    if (!t) return [];
    type Item = { icon: string; label: string };
    // Line 1: your status (changed in "Edit my data"), how far you got (Platinum is the trophy by
    // the name), how long, when. Your rating sits by the release date.
    const progress: Item[] = [];
    if (t.status === 'completed') {
      const when = t.completedAt ? ` ${SHORT_DATE.format(t.completedAt)}` : '';
      progress.push({ icon: 'completed', label: `Completed${when}` });
    } else if (t.status === 'backlog' && t.playing) {
      progress.push({ icon: 'playing', label: 'Playing' });
    } else {
      progress.push({ icon: t.status, label: statusLabel(t.status) });
    }
    if (fields.completed && t.completion && t.completion !== 'platinum') {
      progress.push({ icon: 'level', label: completionLabel(t.completion) ?? '' });
    }
    const played = formatPlaytime(t.hoursPlayed);
    if (this.hoursFromPsn() && played) {
      // From PlayStation: its logo instead of the clock.
      progress.push({ icon: 'psn', label: `${played} playtime` });
    } else if (fields.hours && played) {
      progress.push({ icon: 'hours', label: `${played} playtime` });
    }
    // Last played: PlayStation's date, or else when the last trophy was earned.
    const ps = t.playstation;
    const lastPlayed = ps?.lastPlayedAt ?? ps?.trophies?.lastEarnedAt ?? null;
    if (lastPlayed) {
      progress.push({ icon: 'played', label: `Last played ${SHORT_DATE.format(lastPlayed)}` });
    }
    // Line 2: when, where and for how much you bought it.
    const purchase: Item[] = [];
    if (fields.purchase) {
      if (t.orderedOn) {
        const when = SHORT_DATE.format(new Date(`${t.orderedOn}T12:00:00`));
        purchase.push({ icon: 'date', label: `${t.preordered ? 'Preordered' : 'Bought'} ${when}` });
      }
      if (t.boughtFrom) purchase.push({ icon: 'store', label: t.boughtFrom });
      if (t.pricePaid) purchase.push({ icon: 'price', label: t.pricePaid.toFixed(2) });
      if (t.physical) purchase.push({ icon: 'physical', label: 'Physical copy' });
    }
    return [progress, purchase].filter((line) => line.length);
  });

  /**
   * Trophies from PlayStation: "37/54 · 72%" and how many of each grade you've earned (Platinum
   * only when the game has one). Null without a trophy list.
   */
  protected readonly trophies = computed(() => {
    const t = this.tracked()?.playstation?.trophies;
    if (!t) return null;
    const sum = (c: TrophyCounts) => c.bronze + c.silver + c.gold + c.platinum;
    const grades = (['platinum', 'gold', 'silver', 'bronze'] as const)
      .filter((grade) => t.defined[grade] > 0)
      .map((grade) => ({ grade, earned: t.earned[grade], of: t.defined[grade] }));
    return { earned: sum(t.earned), of: sum(t.defined), progress: t.progress, grades };
  });

  /** Platinum: a trophy next to the game's name. */
  protected readonly platinum = computed(() => {
    const t = this.tracked();
    return t?.status === 'completed' && t.completion === 'platinum';
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

  /** For main games: their DLC and expansions, expansions first, as cards. */
  protected readonly dlcs = computed((): GridCard[] => {
    const d = this.details.data();
    if (!d) return [];
    const expansions = new Set((d.expansions ?? []).map((e) => e.id));
    return dlcsOf(d).map((g) =>
      this.gameCard(g, [expansions.has(g.id) ? 'expansions' : 'dlc']),
    );
  });
  protected readonly dlcFilters: GridFilter[] = [
    { key: 'expansions', title: 'Expansions' },
    { key: 'dlc', title: 'DLC' },
    { key: 'mine', title: 'In my library' },
  ];

  /**
   * Every event the game was shown at, earliest first (so the first is where it was revealed),
   * as cards opening the event's page, to filter by year or by company.
   */
  protected readonly shownAt = computed((): GridCard[] =>
    (this.eventsQuery.data() ?? []).map((e) => {
      const year = String(new Date(e.startsAt).getFullYear());
      const company = eventCompany({ title: e.name, kind: 'other', igdbId: e.id });
      return {
        id: e.id,
        link: ['/event', igdbEventDocId(e.id)],
        name: e.name,
        event: { logoId: e.logoId, kind: 'other' },
        line: eventDateLine(e.startsAt),
        tags: [`year-${year}`, ...(company ? [`company-${company.name}`] : [])],
      };
    }),
  );
  /** Its years (newest first) and companies (A–Z), as the Shown at filters. */
  protected readonly shownAtFilters = computed((): GridFilter[] => {
    const tags = new Set(this.shownAt().flatMap((c) => c.tags));
    const of = (prefix: string) =>
      [...tags].filter((t) => t.startsWith(prefix)).map((t) => t.slice(prefix.length));
    return [
      ...of('year-')
        .sort((a, b) => b.localeCompare(a))
        .map((y) => ({ key: `year-${y}`, title: y, group: 'Year' })),
      ...of('company-')
        .sort((a, b) => a.localeCompare(b))
        .map((c) => ({ key: `company-${c}`, title: c, group: 'Company' })),
    ];
  });

  /**
   * A game as a card: the year under it (TBA without a date), your status and Platinum, and the
   * In my library filter when it's yours.
   */
  private gameCard(game: GameSummary, tags: string[]): GridCard {
    const mine = this.library.byId().get(game.id);
    return {
      id: game.id,
      link: ['/game', game.id],
      name: game.name,
      coverId: game.cover?.image_id,
      line: yearOf(game.first_release_date),
      tags: mine ? [...tags, 'mine'] : tags,
      ...gameMarks(mine),
    };
  }

  /** For a remake or remaster: the original, to link to. */
  protected readonly remake = computed(() => {
    const d = this.details.data();
    return d ? remakeOf(d) : null;
  });

  /** HowLongToBeat's search for this game (it has no API to ask directly). */
  protected readonly hltbUrl = computed(
    () => `https://howlongtobeat.com/?q=${encodeURIComponent(this.name())}`,
  );

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
      topCritics: `${COUNT.format(critics)} ${critics === 1 ? 'critic' : 'critics'}`,
      playerRating: players ? Math.round(d!.rating!) : null,
      players: `${COUNT.format(players)} ${players === 1 ? 'player' : 'players'}`,
    };
  });

  /** Other games in the same series, as cards: main games, or remakes and remasters. */
  protected readonly series = computed(() => {
    const d = this.details.data();
    const s = d ? seriesOf(d) : null;
    if (!s) return null;
    const cards = s.games.map((g) => {
      const type = (g as { game_type?: number }).game_type ?? 0;
      return this.gameCard(g, [REMADE_TYPES.includes(type) ? 'remakes' : 'main']);
    });
    return { name: s.name, cards };
  });
  protected readonly seriesFilters: GridFilter[] = [
    { key: 'main', title: 'Main games' },
    { key: 'remakes', title: 'Remakes and remasters' },
    { key: 'mine', title: 'In my library' },
  ];
  /** Details and Links start folded on every game; tap the heading to open. */
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

  /** Genres, themes, modes, publisher, engine and age rating. */
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
      {
        label: (d?.game_engines?.length ?? 0) > 1 ? 'Engines' : 'Engine',
        value: list(d?.game_engines),
      },
      { label: 'Age rating', value: pegi ? `PEGI ${pegi.rating}` : '' },
    ].filter((f) => f.value);
  });

  /** Official website and stores. */
  protected readonly links = computed(() => {
    const d = this.details.data();
    return d ? linksOf(d) : [];
  });

  protected readonly maxPlaying = MAX_PLAYING;
  protected readonly coverUrl = coverUrl;
  protected readonly formatPlaytime = formatPlaytime;
  protected readonly playstationLogo = PLAYSTATION;

  constructor() {
    // The top bar shows the game's name once you scroll past the artwork.
    const pageTitle = inject(PageTitle);
    effect(() => pageTitle.override.set(this.name() || null));
    inject(DestroyRef).onDestroy(() => pageTitle.override.set(null));

    // Going from a game to one of its DLC reuses this screen: start it fresh.
    effect(() => {
      this.gameId();
      this.opened.set(new Set());
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

  /**
   * Playing on or off. With MAX_PLAYING games already on, asks which one to stop (Cancel leaves
   * everything as it was).
   */
  protected async togglePlaying(): Promise<void> {
    const t = this.tracked();
    if (!t) return;
    if (t.playing) return this.library.setPlaying(t, false);
    const others = this.library
      .games()
      .filter((g) => g.playing && g.status === 'backlog' && g.igdbId !== t.igdbId);
    if (others.length >= MAX_PLAYING) {
      const stop = await this.sheet.choose(
        [`You're playing ${others.length} games. Stop one to play `, t.name, '?'],
        others.map((g) => ({ key: String(g.igdbId), label: g.name })),
      );
      const game = others.find((g) => String(g.igdbId) === stop);
      if (!game) return;
      this.library.setPlaying(game, false);
    }
    const now = this.tracked();
    if (now) this.library.setPlaying(now, true);
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

  /**
   * "Edit my data" (the pencil by the name): status, rating, hours, how far you got and purchase
   * details in a sheet. The status and rating are only changed here.
   */
  protected async editMyData(): Promise<void> {
    const t = this.tracked();
    if (!t || this.isDlcPage()) return;
    const fields = this.editableFields() ?? { hours: false, completed: false, purchase: false };
    const data = await this.detailsSheet.edit(t, fields, today(), this.stores(), {
      status: t.status,
      rating: t.rating,
      released: this.released(),
      hoursFromPsn: this.hoursFromPsn(),
      preordered: !!t.preordered,
    });
    const now = this.tracked();
    if (!data || !now) return;
    const { status, ...edits } = data;
    if (status && status !== now.status) {
      // Completing dates it from PlayStation's last played day (or today); leaving Backlog stops
      // "Playing".
      this.library.setStatus(now, status, edits.completion ?? undefined);
    }
    if (Object.keys(edits).length) this.library.edit(now, edits);
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
