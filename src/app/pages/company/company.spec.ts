import { computed, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideTanStackQuery, QueryClient } from '@tanstack/angular-query-experimental';
import type { TrackedGame } from '../../../../api/_lib/models.js';
import { countryName } from '../../core/countries';
import {
  companySections,
  IgdbService,
  type CompanyCredit,
  type CompanyDetails,
} from '../../core/igdb';
import { LibraryService } from '../../core/library.service';
import { CompanyPage, foundedLabel } from './company';

const day = (date: string) => Date.parse(date) / 1000;

const fromSoftware: CompanyDetails = {
  id: 1012,
  name: 'FromSoftware',
  description: 'FromSoftware is a video game developer headquartered in Tokyo.',
  logo: { image_id: 'cl1' },
  country: 392,
  start_date: day('1986-11-01'),
  start_date_format: 0,
  company_size: { name: '201-500 employees' },
  status: { name: 'active' },
  parent: { id: 9, name: 'Kadokawa Corporation' },
  url: 'https://www.igdb.com/companies/fromsoftware',
  websites: [
    { url: 'https://x.com/fromsoftware', type: { type: 'Twitter' } },
    { url: 'http://www.fromsoftware.jp', type: { type: 'Official Website' } },
  ],
  developed: [
    { id: 1, name: 'Dark Souls', first_release_date: day('2011-09-22'), game_type: 0 },
    { id: 2, name: 'Elden Ring', first_release_date: day('2022-02-25'), game_type: 0 },
    { id: 3, name: 'Shadow of the Erdtree', game_type: 1 },
    { id: 4, name: 'Dark Souls: Remastered', first_release_date: day('2018-05-25'), game_type: 9 },
    { id: 5, name: 'Elden Ring (PS4 version)', game_type: 0, version_parent: 2 },
    { id: 6, name: 'Cancelled thing', game_type: 0, game_status: 6 },
    { id: 7, name: 'Duskbloods', game_type: 0 },
    { id: 8, name: 'Episode One', game_type: 6, first_release_date: day('2015-01-01') },
    { id: 9, name: 'Season Pass', game_type: 7 },
    { id: 10, name: 'Big Bundle', game_type: 3 },
  ],
  published: [
    { id: 2, name: 'Elden Ring', first_release_date: day('2022-02-25'), game_type: 0 },
    { id: 11, name: 'Nightreign DLC', game_type: 2, first_release_date: day('2025-12-04') },
  ],
};

const credits: CompanyCredit[] = [
  { porting: true, game: { id: 20, name: 'Dark Souls (Switch)', game_type: 11 } },
  { supporting: true, game: { id: 21, name: 'Helped Game', game_type: 0 } },
  { supporting: true, game: { id: 22, name: 'Helped Bundle', game_type: 3 } },
  { porting: true, game: { id: 23, name: 'Cancelled Port', game_type: 11, game_status: 6 } },
];

async function render(company: CompanyDetails | null, mine: Partial<TrackedGame>[] = []) {
  const games = signal(mine as TrackedGame[]);
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      provideTanStackQuery(new QueryClient()),
      {
        provide: IgdbService,
        useValue: { company: async () => company, companyCredits: async () => credits },
      },
      {
        provide: LibraryService,
        useValue: { games, byId: computed(() => new Map(games().map((g) => [g.igdbId, g]))) },
      },
    ],
  });
  const fixture = TestBed.createComponent(CompanyPage);
  fixture.componentRef.setInput('id', '1012');
  await fixture.whenStable();
  await new Promise((r) => setTimeout(r, 20));
  await fixture.whenStable();
  return fixture.nativeElement as HTMLElement;
}

const text = (el: Element | null) => el?.textContent?.replace(/\s+/g, ' ').trim() ?? '';

describe('CompanyPage', () => {
  it('shows the company’s details, description and links', async () => {
    const el = await render(fromSoftware);
    expect(text(el.querySelector('h1'))).toBe('FromSoftware');
    expect(text(el.querySelector('h1 + p'))).toBe('Japan · Founded 1 Nov 1986');
    const rows = [...el.querySelectorAll('article > .grouped .row')].map(text);
    expect(rows).toEqual([
      'CountryJapan',
      'Founded1 Nov 1986',
      'Size201-500 employees',
      'StatusActive',
      'Part ofKadokawa Corporation',
    ]);
    expect(el.querySelector('a[href="/company/9"]')).not.toBeNull();
    expect(el.textContent).toContain('headquartered in Tokyo');
    const links = [...el.querySelectorAll('[aria-label=Links] a')].map((a) => [
      text(a),
      a.getAttribute('href'),
    ]);
    // The official site first (made https), then other sites, then IGDB.
    expect(links).toEqual([
      ['Official website', 'https://www.fromsoftware.jp'],
      ['X (Twitter)', 'https://x.com/fromsoftware'],
      ['IGDB page', 'https://www.igdb.com/companies/fromsoftware'],
    ]);
  });

  it('lists its games newest first, upcoming on top, with your status', async () => {
    const el = await render(fromSoftware, [{ igdbId: 2, status: 'completed' }]);
    const developed = el.querySelector('[aria-label=Developed]')!;
    expect(text(developed.querySelector('h2'))).toBe('Developed · 4');
    expect([...developed.querySelectorAll('li')].map(text)).toEqual([
      'DuskbloodsTBA',
      'Elden RingCompleted',
      'Dark Souls: Remastered2018',
      'Dark Souls2011',
    ]);
    expect(text(el.querySelector('[aria-label=Published] h2'))).toBe('Published · 1');
  });

  it('folds the other lists until you tap their heading', async () => {
    const el = await render(fromSoftware);
    const headings = [...el.querySelectorAll('section h2')].map(text);
    expect(headings).toEqual([
      'Developed · 4',
      'Published · 1',
      'Ported · 1',
      'Supported · 1',
      'DLC and expansions · 2',
      'Episodes · 1',
      'Seasons · 1',
      'Cancelled · 2',
      'Links',
    ]);
    const dlc = el.querySelector('[aria-label="DLC and expansions"]')!;
    const button = dlc.querySelector('h2 button') as HTMLButtonElement;
    expect(button.getAttribute('aria-expanded')).toBe('false');
    expect(dlc.querySelector('li')).toBeNull();
    button.click();
    await new Promise((r) => setTimeout(r));
    expect(button.getAttribute('aria-expanded')).toBe('true');
    expect([...dlc.querySelectorAll('li')].map(text)).toEqual([
      'Shadow of the ErdtreeTBA',
      'Nightreign DLC2025',
    ]);
    // Developed and Published have no fold.
    expect(el.querySelector('[aria-label=Developed] h2 button')).toBeNull();
  });

  it('loads the logo as a PNG, so its see-through background stays white on the tile', async () => {
    const el = await render(fromSoftware);
    expect(el.querySelector('article img')?.getAttribute('src')).toBe(
      'https://images.igdb.com/igdb/image/upload/t_logo_med/cl1.png',
    );
  });

  it('says so when IGDB has no such company', async () => {
    const el = await render(null);
    expect(el.textContent).toContain('IGDB doesn’t have this company');
  });
});

describe('company helpers', () => {
  it('sorts games into lists, leaving out bundles, other editions and empty lists', () => {
    const ids = Object.fromEntries(
      companySections(fromSoftware, credits).map((s) => [s.key, s.games.map((g) => g.id)]),
    );
    expect(ids).toEqual({
      developed: [7, 2, 4, 1],
      published: [2],
      ported: [20],
      supported: [21],
      dlcs: [3, 11],
      episodes: [8],
      seasons: [9],
      cancelled: [6, 23],
    });
    expect(companySections({})).toEqual([]);
  });

  it('names countries from their ISO number, and only known ones', () => {
    expect(countryName(392)).toBe('Japan');
    expect(countryName(840)).toBe('United States');
    expect(countryName(826)).toBe('United Kingdom');
    expect(countryName(999)).toBeNull();
    expect(countryName(undefined)).toBeNull();
  });

  it('writes the founding date as exactly as IGDB knows it', () => {
    expect(foundedLabel({ start_date: day('1986-11-01'), start_date_format: 0 })).toBe(
      '1 Nov 1986',
    );
    expect(foundedLabel({ start_date: day('2016-12-31'), start_date_format: 2 })).toBe('2016');
    expect(foundedLabel({ start_date: day('2016-04-01'), start_date_format: 7 })).toBeNull();
    expect(foundedLabel({})).toBeNull();
  });
});
