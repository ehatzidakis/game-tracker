import { applyGround, GROUNDS } from './ground';

describe('the background', () => {
  beforeEach(() => {
    const meta = document.createElement('meta');
    meta.name = 'theme-color';
    meta.content = '#000000';
    document.head.append(meta);
  });
  afterEach(() => {
    document.querySelector('meta[name="theme-color"]')?.remove();
    delete document.documentElement.dataset['ground'];
  });

  it('offers Black first, then the other dark backgrounds', () => {
    expect(GROUNDS.map((g) => g.key)).toEqual(['black', 'charcoal', 'midnight', 'graphite']);
  });

  it('sets the palette on the page and the theme colour to match', () => {
    applyGround('midnight');
    expect(document.documentElement.dataset['ground']).toBe('midnight');
    expect(document.querySelector('meta[name="theme-color"]')?.getAttribute('content')).toBe(
      '#080b12',
    );
  });

  it('goes back to the tokens’ own values for Black', () => {
    applyGround('graphite');
    applyGround('black');
    expect(document.documentElement.dataset['ground']).toBeUndefined();
    expect(document.querySelector('meta[name="theme-color"]')?.getAttribute('content')).toBe(
      '#000000',
    );
  });
});
