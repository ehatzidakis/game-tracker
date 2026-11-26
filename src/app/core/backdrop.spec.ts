import { TestBed } from '@angular/core/testing';
import {
  artStrength,
  BACKDROP_KEY,
  BackdropService,
  DEFAULT_LOOK,
  FALLBACK_STRENGTH,
  LOOK_KEY,
  patchesAt,
  readBackdrop,
  readLook,
} from './backdrop';

describe('game art behind the app', () => {
  afterEach(() => {
    localStorage.removeItem(BACKDROP_KEY);
    localStorage.removeItem(LOOK_KEY);
  });

  it('reads a saved choice and ignores anything else', () => {
    expect(readBackdrop('{"imageId":"sc6abc","gameId":7,"game":"Elden Ring"}')).toEqual({
      imageId: 'sc6abc',
      gameId: 7,
      game: 'Elden Ring',
    });
    expect(readBackdrop(null)).toBeNull();
    expect(readBackdrop('not json')).toBeNull();
    expect(readBackdrop('{"imageId":"../x","gameId":7,"game":"X"}')).toBeNull();
    expect(readBackdrop('{"imageId":"abc"}')).toBeNull();
  });

  it('keeps the choice on this device and clears it', () => {
    const service = TestBed.inject(BackdropService);
    service.set({ imageId: 'sc6abc', gameId: 7, game: 'Elden Ring' });
    expect(service.url()).toContain('t_1080p/sc6abc');
    expect(readBackdrop(localStorage.getItem(BACKDROP_KEY))?.game).toBe('Elden Ring');

    service.clear();
    expect(service.url()).toBeNull();
    expect(localStorage.getItem(BACKDROP_KEY)).toBeNull();
  });

  describe('how strong the glow is', () => {
    const patch = (r: number, g: number, b: number) => [r, g, b, 255];

    it('holds a white picture back so grey text keeps 4.5:1', () => {
      const white = artStrength(patch(255, 255, 255), '#000000', '#98989f');
      expect(white).toBeGreaterThan(0.15);
      expect(white).toBeLessThan(0.2);
    });

    it('lets a dark, colourful picture glow more', () => {
      const red = artStrength(patch(150, 20, 20), '#000000', '#98989f');
      expect(red).toBeGreaterThan(artStrength(patch(255, 255, 255), '#000000', '#98989f'));
      expect(artStrength(patch(30, 30, 60), '#000000', '#98989f')).toBe(0.5);
    });

    it('is judged by the brightest patch, on the chosen background', () => {
      const mixed = [...patch(20, 20, 20), ...patch(255, 255, 255)];
      expect(artStrength(mixed, '#000000', '#98989f')).toBe(
        artStrength(patch(255, 255, 255), '#000000', '#98989f'),
      );
      expect(artStrength(patch(255, 255, 255), '#16181c', '#98989f')).toBeLessThan(
        artStrength(patch(255, 255, 255), '#000000', '#98989f'),
      );
    });

    it('stays safe when the picture could not be read', () => {
      expect(artStrength(null, '#000000', '#98989f')).toBe(FALLBACK_STRENGTH);
    });
  });

  describe('the Blur and Brightness sliders', () => {
    it('keeps each value in its range, with defaults for anything unreadable', () => {
      expect(readLook(null)).toEqual(DEFAULT_LOOK);
      expect(readLook('nope')).toEqual(DEFAULT_LOOK);
      expect(readLook('{"blur":200,"brightness":9}')).toEqual({ blur: 48, brightness: 2 });
      expect(readLook('{"blur":-4,"brightness":0.1}')).toEqual({ blur: 0, brightness: 0.5 });
      expect(readLook('{"blur":7.6}')).toEqual({ blur: 8, brightness: 1 });
    });

    it('keeps a change on this device', () => {
      const service = TestBed.inject(BackdropService);
      service.setLook({ blur: 4 });
      service.setLook({ brightness: 1.5 });
      expect(service.look()).toEqual({ blur: 4, brightness: 1.5 });
      expect(readLook(localStorage.getItem(LOOK_KEY))).toEqual({ blur: 4, brightness: 1.5 });
    });

    it('judges a sharper picture by smaller patches, so a bright spot counts in full', () => {
      // A dark thumbnail with one white pixel.
      const thumb = new Uint8ClampedArray(90 * 90 * 4);
      for (let i = 3; i < thumb.length; i += 4) thumb[i] = 255;
      thumb.set([255, 255, 255], (45 * 90 + 45) * 4);
      const sharp = artStrength(patchesAt(thumb, 0), '#000000', '#98989f');
      const soft = artStrength(patchesAt(thumb, 36), '#000000', '#98989f');
      expect(sharp).toBeLessThan(soft);
      expect(patchesAt(thumb, 0)?.length).toBe(90 * 90 * 4);
      expect(patchesAt(null, 10)).toBeNull();
    });
  });
});
