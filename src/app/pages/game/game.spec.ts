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
      { provide: OpenCriticService, useValue: { score: async () => openCritic } },
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

  it('only offers Playing on Backlog games', async () => {
    const { el } = await render(tracked({ status: 'wishlist' }));
    expect(el.querySelector('button[aria-labelledby=playing-label]')).toBeNull();
    expect(
      [...el.querySelectorAll('[aria-label=Status] button')].map((b) => b.textContent!.trim()),
    ).toEqual(['Backlog', 'Wishlist', 'Shelved', 'Completed']);
  });

  it('lists the events the game was shown at, each opening its page', async () => {
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
    const rows = [...el.querySelectorAll('[aria-label="Shown at"] a')] as HTMLAnchorElement[];
    expect(rows.map((r) => r.textContent!.replace(/\s+/g, ' ').trim())).toEqual([
      'Xbox E3 2019 Briefing9 Jun 2019',
      'The Game Awards 202110 Dec 2021',
    ]);
    expect(rows.map((r) => r.getAttribute('href'))).toEqual(['/event/igdb-481', '/event/igdb-753']);
    // Picking events by hand is gone.
    expect(el.textContent).not.toContain('First shown');
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
    expect(el.textContent).toContain('Time to beat');
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
    [...el.querySelectorAll('button')]
      .find((b) => b.textContent?.includes('Edit my data'))!
      .click();
    expect(sheet2.request()?.initial.completion).toBe('main');
    sheet2.finish({ completion: 'platinum' });
    await Promise.resolve();
    expect(edits).toEqual([{ completion: 'platinum' }]);
  });

  it('asks how far you got when you mark a game Completed', async () => {
    const { el, edits, sheet } = await render(
      tracked({ status: 'backlog', playing: true, releaseDate: '2020-01-01' }),
    );
    const button = (label: string) =>
      [...el.querySelectorAll('button')].find((b) => b.textContent?.trim() === label)!;

    button('Completed').click();
    expect(sheet.request()?.heading[1]).toBe('Test Game');
    sheet.finish(null);
    await Promise.resolve();
    expect(edits).toEqual([]);

    button('Completed').click();
    sheet.finish('main_sides');
    await Promise.resolve();
    expect(edits).toEqual([{ status: 'completed', completion: 'main_sides' }]);
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

  it('shows your data at the top, skipping what is empty', async () => {
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
    // Two lines: how far, when and how long; then bought on, where and for how much.
    const lines = [...el.querySelectorAll('ul')]
      .filter((ul) => ul.querySelector('li.num'))
      .map((ul) => [...ul.querySelectorAll('li')].map((li) => li.textContent!.trim()));
    expect(lines.slice(0, 2)).toEqual([
      ['Main + sides', 'Completed 4 Mar 2026', '34h 21m playtime'],
      ['Bought 10 Jan 2026', 'Germanos', '69.90', 'Physical copy'],
    ]);
    // The other platforms line is gone.
    expect(el.textContent).not.toContain('On PS5');
  });

  it('edits hours, completed date and purchase details in a sheet', async () => {
    const { el, edits, sheet2 } = await render(
      tracked({ status: 'completed', releaseDate: '2020-01-01', hoursPlayed: 10 }),
    );
    [...el.querySelectorAll('button')]
      .find((b) => b.textContent?.includes('Edit my data'))!
      .click();
    expect(sheet2.request()?.fields).toEqual({ purchase: true, hours: true, completed: true });
    expect(sheet2.request()?.initial.hoursPlayed).toBe(10);
    sheet2.finish({ hoursPlayed: 12.5 });
    await Promise.resolve();
    expect(edits).toEqual([{ hoursPlayed: 12.5 }]);
  });

  it('offers only purchase details for an upcoming pre-order', async () => {
    const { el, sheet2 } = await render(tracked({ preordered: true, pricePaid: 80 }));
    expect(el.textContent).toContain('80.00');
    [...el.querySelectorAll('button')]
      .find((b) => b.textContent?.includes('Edit my data'))!
      .click();
    expect(sheet2.request()?.fields).toEqual({ purchase: true, hours: false, completed: false });
    sheet2.finish(null);
  });

  it('asks what you paid when a released wishlist game moves to Backlog', async () => {
    const { el, edits, sheet2 } = await render(
      tracked({ releaseDate: '2020-01-01', releaseLabel: '1 Jan 2020' }),
    );
    expect(el.textContent).not.toContain('Edit my data');
    [...el.querySelectorAll('button')].find((b) => b.textContent?.trim() === 'Backlog')!.click();
    await Promise.resolve();
    expect(edits[0]).toEqual({ status: 'backlog' });
    expect(sheet2.request()?.dateLabel).toBe('Bought on');
    sheet2.finish(null);
  });

  it('keeps a pre-ordered game on the wishlist', async () => {
    const { el } = await render(tracked({ status: 'wishlist', preordered: true, pricePaid: 80 }));
    const checked = el.querySelector('[aria-label=Status] [aria-checked=true]');
    expect(checked?.textContent?.trim()).toBe('Wishlist');
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

  it('shows OpenCritic, the HowLongToBeat link, details and links', async () => {
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
    const timeToBeat = [...el.querySelectorAll('[aria-label="Time to beat"] .row')].map((r) =>
      r.textContent!.replace(/\s+/g, ' ').trim(),
    );
    // IGDB's hours are gone: only the link to HowLongToBeat is left.
    expect(timeToBeat).toEqual(['Search on HowLongToBeat']);
    expect(el.querySelector('[aria-label="Time to beat"] a')?.getAttribute('href')).toBe(
      'https://howlongtobeat.com/?q=Test%20Game',
    );
    // Time to beat comes after the OpenCritic scores.
    const sections = [...el.querySelectorAll('section')].map((x) => x.getAttribute('aria-label'));
    expect(sections.indexOf('Time to beat')).toBe(sections.indexOf('OpenCritic') + 1);
    const openCritic = [...el.querySelectorAll('[aria-label=OpenCritic] .row')].map((r) =>
      r.textContent!.replace(/\s+/g, ' ').trim(),
    );
    expect(openCritic).toEqual([
      'Top Critic Average139 top critics 95/100',
      'Player Rating2,333 ratings on IGDB 93/100',
      'Reviews on OpenCritic',
    ]);
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

  it('locks the rating until you tap Edit, then offers Clear and Done', async () => {
    const { el, fixture } = await render(
      tracked({ status: 'completed', releaseDate: '2020-01-01', rating: 8 }),
    );
    const slider = () => el.querySelector('[role=slider]')!;
    const button = (label: string) =>
      [...el.querySelectorAll('h2 button')].find((b) => b.textContent?.trim() === label) as
        HTMLButtonElement | undefined;
    expect(slider().getAttribute('aria-disabled')).toBe('true');
    expect(button('Clear')).toBeUndefined();
    button('Edit')!.click();
    await fixture.whenStable();
    expect(slider().getAttribute('aria-disabled')).toBe('false');
    expect(button('Clear')).toBeDefined();
    button('Done')!.click();
    await fixture.whenStable();
    expect(slider().getAttribute('aria-disabled')).toBe('true');
    // Your platform is back next to the release date.
    expect(el.textContent).toContain('· PS5');
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
