import { Component, computed, DestroyRef, effect, inject, input, signal } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { DomSanitizer, type SafeResourceUrl } from '@angular/platform-browser';
import { RouterLink } from '@angular/router';
import { injectQuery, QueryClient } from '@tanstack/angular-query-experimental';
import {
  LucideChevronRight,
  LucideExternalLink,
  LucidePencil,
  LucidePlay,
  LucidePlus,
  LucideStar,
  LucideTrophy,
  LucideUsers,
} from '@lucide/angular';
import { eventCompany, igdbEventDocId } from '../../../../api/_lib/igdb-events.js';
import { releaseDatesOf } from '../../../../api/_lib/igdb-sync.js';
import {
  type TrophyCounts,
  MAX_PLAYING,
  completionLabel,
  HLTB_TIMES,
  isDlc,
  statusLabel,
  type Release,
} from '../../../../api/_lib/models.js';
import { PLATFORMS, platformIgdbId, type PlatformKey } from '../../../../api/_lib/platforms.js';
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
import { describeCheck, OpenCriticService } from '../../core/opencritic';
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
import {
  DetailsSheet,
  parsePrice,
  type OwnScores,
  type SheetFields,
} from '../../shared/details-sheet';
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

/** One value in a game's cards: big, with a small caption under it. */
interface Stat {
  value: string;
  caption: string;
  /** Time played from PlayStation: its logo by the caption. */
  psn?: boolean;
}

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
    LucideStar,
    LucideUsers,
    LucideChevronRight,
    LucideExternalLink,
    LucidePencil,
    LucidePlay,
    LucidePlus,
    LucideTrophy,
  ],
  templateUrl: './game.html',
})
export class GamePage {
  /** Route parameter: the IGDB game ID. */
  readonly id = input.required<string>();

  private readonly igdb = inject(IgdbService);
  private readonly openCriticService = inject(OpenCriticService);
  private readonly queryClient = inject(QueryClient);
  private readonly sheet = inject(ChoiceSheet);
  private readonly detailsSheet = inject(DetailsSheet);
  private readonly toast = inject(ToastService);
  private readonly sanitizer = inject(DomSanitizer);
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
   * Your progress, as big values with a small caption under each: when you completed it
   * ("6 Nov 2026" over "Completed") or your status, how far you got ("Main + sides"), and time played (PlayStation's, with its
   * logo, or yours). Only what there is.
   */
  protected readonly progress = computed((): Stat[] => {
    const t = this.tracked();
    if (!t) return [];
    const fields = this.editableFields() ?? { hours: false, completed: false, purchase: false };
    const stats: Stat[] = [];
    if (t.status === 'completed') {
      // The day you finished it, over "Completed" (or just "Completed" without a date).
      stats.push(
        t.completedAt
          ? { value: SHORT_DATE.format(t.completedAt), caption: 'Completed' }
          : { value: 'Completed', caption: 'Status' },
      );
      if (t.completion) {
        stats.push({ value: completionLabel(t.completion) ?? '', caption: 'Completion' });
      }
    } else if (t.status === 'backlog' && t.playing) {
      stats.push({ value: 'Playing', caption: 'Backlog' });
    } else {
      stats.push({ value: statusLabel(t.status), caption: 'Status' });
    }
    const played = formatPlaytime(t.hoursPlayed);
    if (played && (this.hoursFromPsn() || fields.hours)) {
      stats.push({ value: played, caption: 'Playtime', psn: this.hoursFromPsn() });
    }
    return stats;
  });

  /** What you paid, where, when, and the copy: two by two, only what there is. */
  protected readonly purchase = computed((): Stat[] => {
    const t = this.tracked();
    if (!t || !this.editableFields()?.purchase) return [];
    const stats: Stat[] = [];
    if (t.pricePaid) stats.push({ value: `€${t.pricePaid.toFixed(2)}`, caption: 'Paid' });
    if (t.boughtFrom) stats.push({ value: t.boughtFrom, caption: 'Store' });
    if (t.orderedOn) {
      stats.push({
        value: SHORT_DATE.format(new Date(`${t.orderedOn}T12:00:00`)),
        caption: t.preordered ? 'Preordered' : 'Bought',
      });
    }
    if (stats.length || t.physical) {
      stats.push({ value: t.physical ? 'Physical' : 'Digital', caption: 'Copy' });
    }
    return stats;
  });

  /** Your rating, in the scores card once a game is completed. */
  protected readonly myRating = computed(() => {
    const t = this.tracked();
    return t?.status === 'completed' ? { rating: t.rating } : null;
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
  protected readonly stores = this.library.stores;

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
    return dlcsOf(d).map((g) => this.gameCard(g, [expansions.has(g.id) ? 'expansions' : 'dlc']));
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
   * The scores card: OpenCritic's Top Critic Average (its ring, opening the reviews), the players'
   * score from IGDB (OpenCritic has none), each replaced by a score typed in by hand in "Edit my
   * data" for games OpenCritic gets wrong, and your rating. Null without a critic or players'
   * score (an unreleased game): the card, and HowLongToBeat's, hide. While OpenCritic's daily
   * allowance is used up before the game was looked up, it shows saying when it comes back.
   */
  protected readonly scores = computed(() => {
    const score = this.openCriticQuery.data();
    const found = score?.status === 'found' ? score : null;
    const d = this.details.data();
    const count = (n: number, one: string) => `${COUNT.format(n)} ${n === 1 ? one : `${one}s`}`;

    // Typed in by hand: no link, and "Critics" / "Players" when how many wasn't typed in.
    const critics =
      found && (!found.manual || found.numTopCriticReviews) ? found.numTopCriticReviews : null;
    const critic = found
      ? {
          url: found.manual ? null : found.url,
          score: found.topCriticScore,
          count: critics,
          caption:
            found.topCriticScore === null && !found.manual
              ? 'No critics yet'
              : critics !== null
                ? count(critics, 'critic')
                : 'Critics',
          label:
            found.topCriticScore === null
              ? found.manual
                ? 'No critic score'
                : 'OpenCritic: not enough critic reviews yet'
              : `${found.manual ? 'Critic score' : 'OpenCritic'} ${found.topCriticScore}${
                  critics !== null ? `, ${count(critics, 'critic')}` : ''
                }`,
        }
      : null;

    const own = found?.playerScore != null ? found : null;
    const igdbCount = d?.rating && d.rating_count ? d.rating_count : 0;
    const playerScore = own ? own.playerScore! : igdbCount ? Math.round(d!.rating!) : null;
    const users = own ? (own.playerCount ?? null) : igdbCount || null;
    const players =
      playerScore === null
        ? null
        : {
            score: playerScore,
            count: users,
            /** Just the number, by the people icon. */
            caption: users !== null ? COUNT.format(users) : 'Players',
            label: `${own ? 'User score' : 'Players'} ${playerScore}${
              users !== null ? `, ${count(users, 'player')}` : ''
            }`,
          };

    const mine = this.myRating();
    const hasScore = critic?.score != null || players !== null;
    if (!hasScore && !mine?.rating && !this.openCriticLimit()) return null;
    return { critic: hasScore ? critic : null, players, mine, hasScore };
  });

  /**
   * HowLongToBeat's three times, under the scores, as typed in from it in "Edit my data" (which
   * has the link to its search): "–" for one not typed in, none at all: no card.
   */
  protected readonly hltb = computed(() => {
    const times = this.tracked()?.hltb;
    if (!times || !Object.values(times).some((t) => t)) return null;
    return HLTB_TIMES.map((t) => ({ label: t.label, value: formatPlaytime(times[t.key]) || '–' }));
  });

  /** Screenshots, in a strip that scrolls sideways (inside itself). */
  protected readonly screenshots = computed(() => this.details.data()?.screenshots ?? []);
  /** Trailers and gameplay videos from YouTube, in IGDB's order. */
  protected readonly videos = computed(() =>
    (this.details.data()?.videos ?? []).filter((v) => /^[\w-]{6,20}$/.test(v.video_id)),
  );
  /** The video playing (in place of its thumbnail), by YouTube id. */
  protected readonly playingVideo = signal<string | null>(null);
  protected videoEmbed(id: string): SafeResourceUrl {
    return this.sanitizer.bypassSecurityTrustResourceUrl(
      `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&playsinline=1&rel=0`,
    );
  }

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
  /** Screenshots, Videos, Details and Links start folded on every game; tap the heading to open. */
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
      this.playingVideo.set(null);
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
    const data = await this.detailsSheet.edit(
      t,
      fields,
      today(),
      this.stores(),
      {
        status: t.status,
        rating: t.rating,
        released: this.released(),
        hoursFromPsn: this.hoursFromPsn(),
        preordered: !!t.preordered,
      },
      {
        scores: { own: this.ownScores(), shown: this.shownScores() },
        hltbUrl: this.hltbUrl(),
        action: {
          label: 'Check OpenCritic now',
          busyLabel: 'Checking OpenCritic…',
          run: () => this.checkOpenCritic(t.igdbId),
        },
      },
    );
    const now = this.tracked();
    if (!data || !now) return;
    const { status, scores, ...edits } = data;
    if (scores) void this.saveScores(now.igdbId, scores);
    if (status && status !== now.status) {
      // Completing dates it from PlayStation's last played day (or today); leaving Backlog stops
      // "Playing".
      this.library.setStatus(now, status, edits.completion ?? undefined);
    }
    if (Object.keys(edits).length) this.library.edit(now, edits);
  }

  /** The scores typed in by hand for this game, with how many they're from, if it has them. */
  private ownScores(): OwnScores {
    const score = this.openCriticQuery.data();
    return score?.status === 'found' && score.manual
      ? {
          critic: score.topCriticScore,
          critics: score.numTopCriticReviews || null,
          players: score.playerScore,
          users: score.playerCount,
        }
      : { critic: null, critics: null, players: null, users: null };
  }

  /** The scores the game shows now, as hints in the empty score fields of "Edit my data". */
  private shownScores(): OwnScores {
    const s = this.scores();
    return {
      critic: s?.critic?.score ?? null,
      critics: s?.critic?.count ?? null,
      players: s?.players?.score ?? null,
      users: s?.players?.count ?? null,
    };
  }

  /** Saves scores typed in by hand (all empty: OpenCritic's again) and shows them at once. */
  private async saveScores(igdbId: number, own: OwnScores): Promise<void> {
    try {
      const score = await this.openCriticService.setOwnScores(igdbId, own);
      this.queryClient.setQueryData(['opencritic', igdbId], score);
      // The Library's covers show the new score next time they're asked.
      void this.queryClient.invalidateQueries({ queryKey: ['opencritic-scores'] });
    } catch {
      this.toast.error('Couldn’t save the scores. Try again in a moment.');
    }
  }

  /**
   * "Check OpenCritic now" (Edit my data): asks OpenCritic whatever the refresh schedule says, and
   * shows the answer on the page at once. Says how it went.
   */
  private async checkOpenCritic(igdbId: number): Promise<string> {
    const check = await this.openCriticService.check(igdbId);
    this.queryClient.setQueryData(['opencritic', igdbId], check.score);
    return describeCheck(check);
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
