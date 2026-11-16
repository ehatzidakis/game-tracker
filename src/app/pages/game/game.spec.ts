import { computed, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideTanStackQuery, QueryClient } from '@tanstack/angular-query-experimental';
import { DEFAULT_SETTINGS, type TrackedGame } from '../../../../api/_lib/models.js';
import { IgdbService, type EventSummary, type GameDetails } from '../../core/igdb';
import { OpenCriticService } from '../../core/opencritic';
import type { OpenCriticScore } from '../../../../api/_lib/opencritic-match.js';
import { LibraryService } from '../../core/library.service';
import { PushService } from '../../core/push.service';
import { ChoiceSheet } from '../../shared/choice-sheet';
import { DetailsSheet, parsePrice } from '../../shared/details-sheet';
import {
  formatPlaytime,
  formatPlaytimeClock,
  parsePlaytime,
  splitPlaytime,
} from '../../core/playtime';
import { GamePage } from './game';

const details: GameDetails = {
  id: 7,
  name: 'Test Game',
  platforms: [{ id: 167, name: 'PlayStation 5', abbreviation: 'PS5' }],
  release_dates: [{ platform: 167, date: Date.parse('2099-03-01') / 1000, date_format: 0 }],
  screenshots: [{ image_id: 'sc1' }],
};

function tracked(overrides: Partial<TrackedGame>): TrackedGame {
  return {
    igdbId: 7,
    name: 'Test Game',
    slug: null,
    coverId: null,
    genres: [],
    developer: null,
    platforms: [167],
    releaseDate: '2099-03-01',
    releasePrecision: 'day',
    releaseLabel: '1 Mar 2099',
    igdbSyncedAt: 0,
    status: 'wishlist',
    completion: null,
    myPlatform: 'ps5',
    hoursPlayed: null,
    rating: null,
    notes: '',
    notify: false,
    addedAt: 0,
    purchasedAt: null,
    startedAt: null,
    shelvedAt: null,
    completedAt: null,
    updatedAt: 0,
    ...overrides,
  };
}

const NO_OPENCRITIC: OpenCriticScore = { status: 'none' };

async function render(
  game: TrackedGame | null,
  igdb: GameDetails = details,
  openCritic: OpenCriticScore = NO_OPENCRITIC,
  others: TrackedGame[] = [],
  shownAt: EventSummary[] = [],
) {
  const games = signal(game ? [game, ...others] : others);
  const edits: unknown[] = [];
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      provideTanStackQuery(new QueryClient()),
      {
        provide: IgdbService,
        useValue: {
          game: async () => igdb,
          eventsOf: async () => shownAt,
        },
      },
      {
        provide: OpenCriticService,
        useValue: { score: async () => openCritic, cachedScore: () => undefined },
      },
      { provide: PushService, useValue: { enabledHere: () => false } },
      {
        provide: LibraryService,
        useValue: {
          games,
          byId: computed(() => new Map(games().map((g) => [g.igdbId, g]))),
          settings: signal(DEFAULT_SETTINGS),
          refresh: () => undefined,
          edit: (_: TrackedGame, e: unknown) => edits.push(e),
          setPreordered: (_: TrackedGame, preordered: boolean) => edits.push({ preordered }),
          add: (_: unknown, status: string, __: unknown, parent: unknown) =>
            edits.push({ add: status, parent }),
          remove: () => edits.push({ removed: true }),
          setPlaying: (g: TrackedGame, playing: boolean) => edits.push({ playing, game: g.igdbId }),
          setStatus: (_: TrackedGame, status: unknown, completion?: unknown) =>
            edits.push(completion ? { status, completion } : { status }),
        },
      },
    ],
  });
  const fixture = TestBed.createComponent(GamePage);
  fixture.componentRef.setInput('id', '7');
  await fixture.whenStable();
  await new Promise((r) => setTimeout(r, 20));
  await fixture.whenStable();
  return {
    el: fixture.nativeElement as HTMLElement,
    edits,
    fixture,
    sheet: TestBed.inject(ChoiceSheet),
    sheet2: TestBed.inject(DetailsSheet),
  };
}

/** A card's values with their captions: "Completed / 4 Mar 2026". */
const stats = (el: HTMLElement, card: string) =>
  [...el.querySelectorAll(`section[aria-label=${card}] .grid > div`)].map((d) =>
    [...d.querySelectorAll('p')].map((p) => p.textContent!.replace(/\s+/g, ' ').trim()).join(' / '),
  );

/** The pencil by the name: "Edit my data". */
const pencil = (el: HTMLElement) =>
  el.querySelector('button[aria-label="Edit my data"]') as HTMLButtonElement;

describe('GamePage', () => {
  it('marks a Backlog game as Playing, asking which to stop when 3 already are', async () => {
    const playing = [11, 12, 13].map((id) => ({
      ...tracked({ status: 'backlog', playing: true }),
      igdbId: id,
      name: `Game ${id}`,
    }));
    const { el, edits, sheet, fixture } = await render(
      tracked({ status: 'backlog', releaseDate: '2020-01-01' }),
      details,
      NO_OPENCRITIC,
      playing,
    );
    const toggle = el.querySelector('button[aria-labelledby=playing-label]') as HTMLButtonElement;
    expect(toggle.getAttribute('aria-checked')).toBe('false');
    toggle.click();
    await fixture.whenStable();
    expect(sheet.request()?.choices.map((c) => c.label)).toEqual(['Game 11', 'Game 12', 'Game 13']);
    sheet.finish('12');
    await new Promise((r) => setTimeout(r));
    expect(edits).toEqual([
      { playing: false, game: 12 },
      { playing: true, game: 7 },
    ]);
  });

  it('only offers Playing on Backlog games, and shows the status without buttons', async () => {
    const { el } = await render(tracked({ status: 'wishlist' }));
    expect(el.querySelector('button[aria-labelledby=playing-label]')).toBeNull();
    // The status is changed in Edit my data only.
    expect(el.querySelector('[aria-label=Status]')).toBeNull();
    expect(stats(el, 'Progress')).toEqual(['Wishlist / Status']);
  });
  it('shows the events the game was shown at as cards, each opening its page', async () => {
    const { el } = await render(
      tracked({}),
      details,
      NO_OPENCRITIC,
      [],
      [
        {
          id: 481,
          name: 'Xbox E3 2019 Briefing',
          logoId: 'el1',
          startsAt: Date.parse('2019-06-09T20:00:00Z'),
        },
        {
          id: 753,
          name: 'The Game Awards 2021',
          logoId: null,
          startsAt: Date.parse('2021-12-10T01:00:00Z'),
        },
      ],
    );
    // Cards, earliest first, with the month under each; filters by year and by company.
    const rows = [...el.querySelectorAll('[aria-label="Shown at"] li a')] as HTMLAnchorElement[];
    expect(rows.map((r) => r.getAttribute('aria-label'))).toEqual([
      'Xbox E3 2019 Briefing, Jun 2019',
      'The Game Awards 2021, Dec 2021',
    ]);
    const options = [...el.querySelectorAll('[aria-label="Shown at"] option')].map((o) =>
      o.textContent!.trim(),
    );
    expect(options).toEqual(['All · 2', '2021 · 1', '2019 · 1', 'Xbox Game Studios · 1']);
    expect(rows.map((r) => r.getAttribute('href'))).toEqual(['/event/igdb-481', '/event/igdb-753']);
    // Picking events by hand is gone.
    expect(el.textContent).not.toContain('First shown');
  });

  it('says when OpenCritic’s daily limit is reached for a game not looked up yet', async () => {
    const { el } = await render(tracked({}), details, {
      status: 'later',
      limit: true,
      retryAt: Date.now() + 4.5 * 3_600_000,
    });
    const text = el.querySelector('[aria-label=Scores]')?.textContent?.replace(/\s+/g, ' ');
    expect(text).toContain('OpenCritic in about 5 hours');
  });
  it('shows nothing for OpenCritic when it just could not be reached', async () => {
    const { el } = await render(tracked({}), details, {
      status: 'later',
      limit: false,
      retryAt: null,
    });
    expect(el.querySelector('[aria-label=OpenCritic]')).toBeNull();
  });

  it('hides Shown at when IGDB lists no events for the game', async () => {
    const { el } = await render(tracked({}));
    expect(el.querySelector('[aria-label="Shown at"]')).toBeNull();
  });

  it('lists the release dates the game had before, latest change first', async () => {
    const { el } = await render(
      tracked({
        releaseHistory: [
          {
            date: '2098-12-31',
            precision: 'year',
            label: '2098',
            changedAt: Date.parse('2026-03-02T10:00:00Z'),
          },
          {
            date: '2098-09-05',
            precision: 'day',
            label: '5 Sep 2098',
            changedAt: Date.parse('2026-06-10T10:00:00Z'),
          },
        ],
      }),
    );
    const rows = [...el.querySelectorAll('[aria-label="Earlier release dates"] li')].map((li) =>
      li.textContent!.replace(/\s+/g, ' ').trim(),
    );
    // Two exact days say how far it moved; a vague date ("2098") just says what it was.
    expect(rows).toEqual([
      'Was 5 Sep 2098 · delayed 177 days · changed 10 Jun 2026',
      'Was 2098 · changed 2 Mar 2026',
    ]);
  });

  it('shows no earlier dates for a game whose date never moved', async () => {
    const { el } = await render(tracked({}));
    expect(el.querySelector('[aria-label="Earlier release dates"]')).toBeNull();
  });

  it('links a remake to the original', async () => {
    const { el } = await render(null, {
      ...details,
      game_type: 8,
      parent_game: {
        id: 481,
        name: 'Silent Hill 2',
        first_release_date: Date.parse('2001-09-24') / 1000,
      },
    });
    const remake = [...el.querySelectorAll('a')].find((a) => a.textContent!.includes('Remake of'));
    expect(remake?.textContent?.trim()).toBe('Remake of Silent Hill 2 (2001)');
    expect(remake?.getAttribute('href')).toBe('/game/481');
  });

  it('shows no remake link on an ordinary game', async () => {
    const { el } = await render(null);
    expect([...el.querySelectorAll('a')].some((a) => a.textContent!.includes('Remake of'))).toBe(
      false,
    );
  });

  it('offers to add a game that is not in the library', async () => {
    const { el } = await render(null);
    expect(el.textContent).toContain('Add to Library');
    expect(el.textContent).toContain('1 Mar 2099');
    expect(el.textContent).not.toContain('Trailer');
    expect(el.textContent).toContain('HLTB');
    // Nothing to edit: the game isn't yours.
    expect(pencil(el)).toBeNull();
  });

  it('shows the release alert for an upcoming wishlist game', async () => {
    const { el, edits } = await render(tracked({}));
    expect(el.textContent).toContain('Release alert');
    expect(el.textContent).toContain('1 day before');
    expect(el.querySelector('[aria-label=Completion]')).toBeNull();
    (el.querySelector('button[aria-labelledby=alert-label]') as HTMLButtonElement).click();
    expect(edits).toEqual([{ notify: true }]);
  });

  it('shows how far you got in your data, and a trophy by the name for Platinum', async () => {
    const main = await render(
      tracked({ status: 'completed', releaseDate: '2020-01-01', completion: 'main', rating: 8 }),
    );
    expect(main.el.textContent).toContain('Main story');
    expect(main.el.textContent).toContain('8/10');
    expect(main.el.textContent).not.toContain('Release alert');
    // No Completion buttons on the page: it's changed in Edit my data.
    expect(main.el.querySelector('[aria-label=Completion]')).toBeNull();
    expect(main.el.querySelector('h1 [aria-label=Platinum]')).toBeNull();
    TestBed.resetTestingModule();

    const platinum = await render(
      tracked({ status: 'completed', releaseDate: '2020-01-01', completion: 'platinum' }),
    );
    expect(platinum.el.querySelector('h1 [aria-label=Platinum]')).not.toBeNull();
    expect(platinum.el.textContent).not.toContain('Platinum ');
  });

  it('changes how far you got in Edit my data', async () => {
    const { el, edits, sheet2 } = await render(
      tracked({ status: 'completed', releaseDate: '2020-01-01', completion: 'main' }),
    );
    pencil(el).click();
    expect(sheet2.request()?.initial.completion).toBe('main');
    expect(sheet2.request()?.statusEdit?.status).toBe('completed');
    sheet2.finish({ status: 'completed', completion: 'platinum' });
    await Promise.resolve();
    // Same status: only the edit.
    expect(edits).toEqual([{ completion: 'platinum' }]);
  });
  it('completes a game in Edit my data, with how far you got and a rating', async () => {
    const { el, edits, sheet2 } = await render(
      tracked({ status: 'backlog', playing: true, releaseDate: '2020-01-01' }),
    );
    pencil(el).click();
    expect(sheet2.request()?.statusEdit).toEqual({
      status: 'backlog',
      rating: null,
      released: true,
      hoursFromPsn: false,
      preordered: false,
    });
    sheet2.finish({ status: 'completed', completion: 'main_sides', rating: 8 });
    await Promise.resolve();
    expect(edits).toEqual([
      { status: 'completed', completion: 'main_sides' },
      { completion: 'main_sides', rating: 8 },
    ]);
  });
  it('marks an upcoming game as pre-ordered and asks for the details', async () => {
    const { el, edits, sheet2 } = await render(tracked({}));
    expect(el.textContent).toContain('Pre-ordered');
    expect(el.textContent).not.toContain('playtime');
    const toggle = el.querySelector('button[aria-labelledby=preorder-label]') as HTMLButtonElement;

    toggle.click();
    expect(edits).toEqual([{ preordered: true }]);
    expect(sheet2.request()?.name).toBe('Test Game');
    expect(sheet2.request()?.dateLabel).toBe('Preordered on');
    expect(sheet2.request()?.fields).toEqual({ purchase: true, hours: false, completed: false });
    expect(sheet2.request()?.stores).toContain('PlayStation Store');
    const data = {
      pricePaid: 79.99,
      boughtFrom: 'Amazon',
      orderedOn: '2026-11-07',
      physical: true,
    };
    sheet2.finish(data);
    await Promise.resolve();
    expect(edits[1]).toEqual(data);
  });

  it('shows your data in cards at the top, skipping what is empty', async () => {
    const { el } = await render(
      tracked({
        status: 'completed',
        releaseDate: '2020-01-01',
        completion: 'main_sides',
        hoursPlayed: 34.35,
        completedAt: new Date(2026, 2, 4, 12).getTime(),
        pricePaid: 69.9,
        boughtFrom: 'Germanos',
        orderedOn: '2026-01-10',
        physical: true,
      }),
    );
    expect(stats(el, 'Progress')).toEqual([
      '4 Mar 2026 / Completed',
      'Main + sides / Completion',
      '34h 21m / Playtime',
    ]);
    expect(stats(el, 'Purchase')).toEqual([
      '€69.90 / Paid',
      'Germanos / Store',
      '10 Jan 2026 / Bought',
      'Physical / Copy',
    ]);
    // The other platforms line is gone, and so is last played.
    expect(el.textContent).not.toContain('On PS5');
    expect(el.textContent).not.toContain('Last played');
  });
  it('shows PlayStation’s playtime and trophies, and keeps the hours out of the sheet', async () => {
    const { el, sheet2 } = await render(
      tracked({
        status: 'completed',
        releaseDate: '2020-01-01',
        completion: 'main',
        hoursPlayed: 45.5,
        playstation: {
          playSeconds: 45.5 * 3600,
          firstPlayedAt: Date.UTC(2026, 9, 1),
          lastPlayedAt: Date.UTC(2026, 10, 3, 12),
          trophies: {
            earned: { bronze: 30, silver: 6, gold: 1, platinum: 0 },
            defined: { bronze: 40, silver: 10, gold: 3, platinum: 1 },
            progress: 72,
            lastEarnedAt: Date.UTC(2026, 10, 3, 13),
            platform: 'PS5',
          },
          syncedAt: 0,
        },
      }),
    );
    expect(stats(el, 'Progress')).toContain('45h 30m / Playtime');
    expect(el.querySelector('[aria-label=Progress] [aria-label="From PlayStation"]')).not.toBeNull();
    const trophies = el.querySelector('[aria-label=Trophies]')!;
    const text = trophies.textContent!.replace(/\s+/g, ' ');
    expect(text).toContain('37/54');
    expect(text).toContain('72%');
    // The bar is as full as the progress.
    expect((trophies.querySelector('[style]') as HTMLElement).style.width).toBe('72%');
    // Grades as icons with counts, Platinum first.
    expect(
      [...trophies.querySelectorAll('[aria-label]')].map((s) => s.getAttribute('aria-label')),
    ).toEqual(['0 platinum', '1 gold', '6 silver', '30 bronze']);
    pencil(el).click();
    expect(sheet2.request()?.fields).toEqual({ purchase: true, hours: false, completed: true });
    expect(sheet2.request()?.statusEdit?.hoursFromPsn).toBe(true);
  });
  it('keeps your own hours when PlayStation has no playtime for the game', async () => {
    const { el } = await render(
      tracked({
        status: 'completed',
        releaseDate: '2020-01-01',
        hoursPlayed: 12,
        playstation: {
          playSeconds: 0,
          firstPlayedAt: null,
          lastPlayedAt: null,
          trophies: {
            earned: { bronze: 10, silver: 1, gold: 0, platinum: 0 },
            defined: { bronze: 30, silver: 5, gold: 2, platinum: 0 },
            progress: 25,
            lastEarnedAt: Date.UTC(2019, 4, 2, 12),
            platform: 'PS4',
          },
          syncedAt: 0,
        },
      }),
    );
    // No Platinum in the game: no Platinum icon.
    expect(el.querySelector('[aria-label="0 platinum"]')).toBeNull();
    // Hours still yours to edit: PlayStation has none.
    expect(stats(el, 'Progress')).toContain('12h / Playtime');
    expect(el.querySelector('[aria-label="From PlayStation"]')).toBeNull();
  });
  it('edits hours, completed date and purchase details in a sheet', async () => {
    const { el, edits, sheet2 } = await render(
      tracked({ status: 'completed', releaseDate: '2020-01-01', hoursPlayed: 10 }),
    );
    pencil(el).click();
    expect(sheet2.request()?.fields).toEqual({ purchase: true, hours: true, completed: true });
    expect(sheet2.request()?.initial.hoursPlayed).toBe(10);
    sheet2.finish({ hoursPlayed: 12.5 });
    await Promise.resolve();
    expect(edits).toEqual([{ hoursPlayed: 12.5 }]);
  });
  it('offers only purchase details for an upcoming pre-order', async () => {
    const { el, sheet2 } = await render(tracked({ preordered: true, pricePaid: 80 }));
    expect(el.textContent).toContain('80.00');
    pencil(el).click();
    expect(sheet2.request()?.fields).toEqual({ purchase: true, hours: false, completed: false });
    sheet2.finish(null);
  });
  it('moves a released wishlist game to Backlog in Edit my data, with what you paid', async () => {
    const { el, edits, sheet2 } = await render(
      tracked({ releaseDate: '2020-01-01', releaseLabel: '1 Jan 2020' }),
    );
    // A wishlist game with nothing filled in still has the pencil: the status is edited there.
    pencil(el).click();
    expect(sheet2.request()?.statusEdit?.status).toBe('wishlist');
    sheet2.finish({ status: 'backlog', pricePaid: 59.99 });
    await Promise.resolve();
    expect(edits).toEqual([{ status: 'backlog' }, { pricePaid: 59.99 }]);
  });
  it('keeps a pre-ordered game on the wishlist', async () => {
    const { el } = await render(tracked({ status: 'wishlist', preordered: true, pricePaid: 80 }));
    expect(stats(el, 'Progress')).toEqual(['Wishlist / Status']);
    expect(stats(el, 'Purchase')).toEqual(['€80.00 / Paid', 'Digital / Copy']);
  });
  it('lists DLC on the main game and shows owned / completed switches on a DLC', async () => {
    const main = await render(null, {
      ...details,
      dlcs: [{ id: 99, name: 'Test Game: Lazarus', first_release_date: 4_000_000_000 }],
    });
    expect(main.el.textContent).toContain('DLC and expansions');
    expect(main.el.textContent).toContain('Test Game: Lazarus');
    TestBed.resetTestingModule();

    const dlc = await render(null, {
      ...details,
      id: 7,
      game_type: 1,
      parent_game: { id: 1, name: 'Test Game' },
    });
    expect(dlc.el.textContent).toContain('DLC for Test Game');
    expect(dlc.el.textContent).not.toContain('Status');
    (
      dlc.el.querySelector('button[aria-labelledby=dlc-wishlist-label]') as HTMLButtonElement
    ).click();
    expect(dlc.edits).toEqual([{ add: 'wishlist', parent: { id: 1, name: 'Test Game' } }]);
  });

  it('shows OpenCritic, the players’ score, yours and HowLongToBeat in one card, then details and links', async () => {
    const { el, fixture } = await render(
      tracked({ status: 'completed', releaseDate: '2020-01-01', completion: 'main_sides' }),
      {
        ...details,
        rating: 93.4,
        rating_count: 2333,
        themes: [{ name: 'Fantasy' }],
        game_engines: [{ name: 'Dantelion' }],
        age_ratings: [{ organization: { name: 'PEGI' }, rating_category: { rating: '16' } }],
        websites: [{ url: 'https://store.playstation.com/x', type: { type: 'Playstation' } }],
      },
      {
        status: 'found',
        url: 'https://opencritic.com/game/12090/elden-ring',
        tier: 'Mighty',
        topCriticScore: 95,
        percentRecommended: 97,
        numReviews: 219,
        numTopCriticReviews: 139,
      },
    );
    const text = el.textContent!.replace(/\s+/g, ' ');
    const scores = el.querySelector('[aria-label=Scores]')!;
    const labels = [...scores.querySelectorAll('.grid > [aria-label]')].map((x) =>
      x.getAttribute('aria-label'),
    );
    expect(labels).toEqual([
      'OpenCritic 95, 139 critics',
      'Players 93, 2,333 players',
      'Not rated yet',
      'HowLongToBeat',
    ]);
    const links = [...scores.querySelectorAll('a')].map((a) => a.getAttribute('href'));
    expect(links).toEqual([
      'https://opencritic.com/game/12090/elden-ring',
      'https://howlongtobeat.com/?q=Test%20Game',
    ]);
    // The old sections are gone.
    expect(el.querySelector('section[aria-label=OpenCritic]')).toBeNull();
    expect(el.querySelector('section[aria-label="Time to beat"]')).toBeNull();
    // Details and Links start folded; their headings open them.
    expect(text).not.toContain('PEGI 16');
    for (const name of ['Details', 'Links']) {
      const heading = el.querySelector(`[aria-label=${name}] h2 button`) as HTMLButtonElement;
      expect(heading.getAttribute('aria-expanded')).toBe('false');
      heading.click();
    }
    await fixture.whenStable();
    const opened = el.textContent!.replace(/\s+/g, ' ');
    expect(opened).toContain('PEGI 16');
    expect(opened).toContain('EngineDantelion');
    expect(opened).toContain('PlayStation Store');
  });
  it('shows your rating in the scores card; it is changed in Edit my data only', async () => {
    const { el, sheet2 } = await render(
      tracked({ status: 'completed', releaseDate: '2020-01-01', rating: 8 }),
    );
    expect(el.querySelector('[role=slider]')).toBeNull();
    expect(el.querySelector('[aria-label=Scores] [aria-label="My rating 8/10"]')).not.toBeNull();
    // Not by the release date any more.
    expect(el.querySelector('header')!.textContent).not.toContain('8/10');
    pencil(el).click();
    expect(sheet2.request()?.statusEdit?.rating).toBe(8);
    sheet2.finish(null);
    // The release date stands without your platform (the My platform setting below has it).
    expect(el.textContent).not.toContain('· PS5');
  });
});

describe('parsePrice', () => {
  it('reads commas and dots, and rejects junk', () => {
    expect(parsePrice('69,99')).toBe(69.99);
    expect(parsePrice(' €70 ')).toBe(70);
    expect(parsePrice('')).toBeNull();
    expect(parsePrice('abc')).toBeUndefined();
    expect(parsePrice('-5')).toBeUndefined();
  });
});

describe('playtime', () => {
  it('shows hours and minutes, leaving out a zero part', () => {
    expect(formatPlaytime(34.35)).toBe('34h 21m');
    expect(formatPlaytime(12.5)).toBe('12h 30m');
    expect(formatPlaytime(34)).toBe('34h');
    expect(formatPlaytime(0.35)).toBe('21m');
    expect(formatPlaytime(null)).toBe('');
    expect(splitPlaytime(34.35)).toEqual({ hours: 34, minutes: 21 });
    expect(formatPlaytimeClock(34.35)).toBe('34h 21m');
    expect(formatPlaytimeClock(5.1)).toBe('5h 06m');
    expect(formatPlaytimeClock(0)).toBe('');
  });

  it('reads the hours and minutes fields, and rejects junk', () => {
    expect(splitPlaytime(parsePlaytime('34', '21')!)).toEqual({ hours: 34, minutes: 21 });
    expect(parsePlaytime('34', '')).toBe(34);
    expect(parsePlaytime('', '45')).toBe(0.75);
    expect(parsePlaytime('', '')).toBeNull();
    expect(parsePlaytime('0', '0')).toBeNull();
    expect(parsePlaytime('12.5', '')).toBeUndefined();
    expect(parsePlaytime('3', '60')).toBeUndefined();
    expect(parsePlaytime('x', '')).toBeUndefined();
  });
});
