import { computed, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideTanStackQuery, QueryClient } from '@tanstack/angular-query-experimental';
import { DEFAULT_SETTINGS, type TrackedGame } from '../../../../api/_lib/models.js';
import { IgdbService, type GameDetails } from '../../core/igdb';
import { LibraryService } from '../../core/library.service';
import { PushService } from '../../core/push.service';
import { GamePage } from './game';

const details: GameDetails = {
  id: 7,
  name: 'Test Game',
  summary: 'A game.',
  platforms: [{ id: 167, name: 'PlayStation 5', abbreviation: 'PS5' }],
  release_dates: [{ platform: 167, date: Date.parse('2099-03-01') / 1000, date_format: 0 }],
  videos: [{ video_id: 'abcDEF_123-x' }],
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

async function render(game: TrackedGame | null) {
  const games = signal(game ? [game] : []);
  const edits: unknown[] = [];
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      provideTanStackQuery(new QueryClient()),
      { provide: IgdbService, useValue: { game: async () => details } },
      { provide: PushService, useValue: { enabledHere: () => false } },
      {
        provide: LibraryService,
        useValue: {
          games,
          byId: computed(() => new Map(games().map((g) => [g.igdbId, g]))),
          settings: signal(DEFAULT_SETTINGS),
          refresh: () => undefined,
          edit: (_: TrackedGame, e: unknown) => edits.push(e),
          setStatus: (_: TrackedGame, s: unknown) => edits.push({ status: s }),
        },
      },
    ],
  });
  const fixture = TestBed.createComponent(GamePage);
  fixture.componentRef.setInput('id', '7');
  await fixture.whenStable();
  await new Promise((r) => setTimeout(r, 20));
  await fixture.whenStable();
  return { el: fixture.nativeElement as HTMLElement, edits, fixture };
}

describe('GamePage', () => {
  it('offers to add a game that is not in the library', async () => {
    const { el } = await render(null);
    expect(el.textContent).toContain('Add to library');
    expect(el.textContent).toContain('1 Mar 2099');
    expect(el.textContent).toContain('Trailer');
  });

  it('shows the release alert for an upcoming wishlist game', async () => {
    const { el, edits } = await render(tracked({}));
    expect(el.textContent).toContain('Release alert');
    expect(el.textContent).toContain('1 day before');
    expect(el.textContent).not.toContain('Completion');
    (el.querySelector('button[role=switch]') as HTMLButtonElement).click();
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
    const platinum = [...el.querySelectorAll('button')].find((b) => b.textContent?.trim() === 'Platinum')!;
    platinum.click();
    expect(edits).toEqual([{ completion: 'platinum' }]);
  });
});
