import { titleMatcher } from './title-search';

describe('titleMatcher', () => {
  it('needs every word, ignoring case, accents and punctuation', () => {
    const matches = titleMatcher('  God RAGNAROK ')!;
    expect(matches('God of War Ragnarök')).toBe(true);
    expect(matches('God of War')).toBe(false);
    expect(titleMatcher('marvels')!("Marvel's Spider-Man 2")).toBe(true);
  });

  it('is null when nothing is typed', () => {
    expect(titleMatcher('')).toBeNull();
    expect(titleMatcher(' : ')).toBeNull();
  });
});
