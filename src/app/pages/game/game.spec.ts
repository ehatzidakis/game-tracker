import { computed, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideTanStackQuery, QueryClient } from '@tanstack/angular-query-experimental';
import { DEFAULT_SETTINGS, type TrackedGame } from '../../../../api/_lib/models.js';
import { IgdbService, type GameDetails } from '../../core/igdb';
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

async function render(game: TrackedGame | null, igdb: GameDetails = details) {
  const games = signal(game ? [game] : []);
  const edits: unknown[] = [];
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      provideTanStackQuery(new QueryClient()),
      {
        provide: IgdbService,
        useValue: {
          game: async () => igdb,
          timeToBeat: async () => ({
            hastily: 36000,
            normally: 72000,
            completely: 144000,
            count: 12,
          }),
        },
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

  it('shows completion and rating for a completed game', async () => {
    const { el, edits } = await render(
      tracked({ status: 'completed', releaseDate: '2020-01-01', completion: 'main', rating: 8 }),
    );
    expect(el.textContent).toContain('Completion');
    expect(el.textContent).toContain('Platinum');
    expect(el.textContent).toContain('8/10');
    expect(el.textContent).not.toContain('Release alert');
    const platinum = [...el.querySelectorAll('button')].find(
      (b) => b.textContent?.trim() === 'Platinum',
    )!;
    platinum.click();
    expect(edits).toEqual([{ completion: 'platinum' }]);
  });

  it('asks how far you got when you mark a game Completed', async () => {
    const { el, edits, sheet } = await render(
      tracked({ status: 'playing', releaseDate: '2020-01-01' }),
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
        hoursPlayed: 34.35,
        completedAt: new Date(2026, 2, 4, 12).getTime(),
        pricePaid: 69.9,
        boughtFrom: 'Germanos',
        orderedOn: null,
        physical: true,
      }),
    );
    const items = [...el.querySelectorAll('header + p + ul li, ul li.num')].map((li) =>
      li.textContent!.trim(),
    );
    expect(items).toEqual([
      '34h 21m playtime',
      'Completed 4 Mar 2026',
      '69.90',
      'Germanos',
      'Physical copy',
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

  it('shows time to beat with your completion level, scores, details and links', async () => {
    const { el } = await render(
      tracked({ status: 'completed', releaseDate: '2020-01-01', completion: 'main_sides' }),
      {
        ...details,
        aggregated_rating: 96.9,
        aggregated_rating_count: 10,
        rating: 93.4,
        rating_count: 2333,
        themes: [{ name: 'Fantasy' }],
        age_ratings: [{ organization: { name: 'PEGI' }, rating_category: { rating: '16' } }],
        websites: [{ url: 'https://store.playstation.com/x', type: { type: 'Playstation' } }],
      },
    );
    const text = el.textContent!.replace(/\s+/g, ' ');
    const timeToBeat = [...el.querySelectorAll('[aria-label="Time to beat"] .row')].map((r) =>
      r.textContent!.replace(/\s+/g, ' ').trim(),
    );
    expect(timeToBeat).toEqual(['Main story10 h', 'Main + sides20 h', 'Completionist40 h']);
    // Your completion level (Main + sides) is in bold.
    expect(
      el.querySelector('[aria-label="Time to beat"] .font-semibold')?.textContent?.trim(),
    ).toBe('Main + sides');
    expect(text).toContain('Critics');
    expect(text).toContain('97/100');
    expect(text).toContain('2,333 ratings');
    expect(text).toContain('PEGI 16');
    expect(text).toContain('PlayStation Store');
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
