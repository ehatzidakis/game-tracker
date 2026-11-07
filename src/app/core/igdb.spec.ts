import { buildSearchQuery, toSearchResult } from './igdb';

describe('buildSearchQuery', () => {
  it('escapes quotes so a search term cannot break out of the query', () => {
    expect(buildSearchQuery('say "hi"')).toContain('search "say \\"hi\\"";');
  });

  it('trims the term and leaves out DLC and bundles', () => {
    const query = buildSearchQuery('  zelda ');
    expect(query).toContain('search "zelda";');
    expect(query).toContain('game_type = (0,4,8,9,10,11)');
  });
});

describe('toSearchResult', () => {
  it('lists our platforms first in a fixed order, then fills up to two with others', () => {
    const result = toSearchResult({
      id: 1,
      name: 'Game',
      first_release_date: 1_748_563_200,
      platforms: [
        { id: 48, abbreviation: 'PS4', name: 'PlayStation 4' },
        { id: 6, abbreviation: 'PC', name: 'PC' },
        { id: 167, abbreviation: 'PS5', name: 'PlayStation 5' },
      ],
    });
    expect(result.platforms).toEqual(['PS5', 'PC']);
    expect(result.year).toBe(2025);
    expect(result.coverId).toBeNull();
  });

  it('shows other platforms when none of ours match', () => {
    const result = toSearchResult({
      id: 2,
      name: 'Old game',
      platforms: [
        { id: 18, abbreviation: 'NES', name: 'NES' },
        { id: 5, abbreviation: 'Wii', name: 'Wii' },
        { id: 41, abbreviation: 'WiiU', name: 'Wii U' },
      ],
    });
    expect(result.platforms).toEqual(['NES', 'Wii']);
    expect(result.year).toBeNull();
  });
});
