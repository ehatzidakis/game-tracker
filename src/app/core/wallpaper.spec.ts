import { readWallpaper, rowStrengths, scrimGradient } from './wallpaper';

/** A picture of `rows` rows, `cols` across, each row one grey (0–255). */
function rowsOf(greys: number[], cols = 4): Uint8ClampedArray {
  const px = new Uint8ClampedArray(greys.length * cols * 4);
  greys.forEach((v, r) => {
    for (let c = 0; c < cols; c++) px.set([v, v, v, 255], (r * cols + c) * 4);
  });
  return px;
}

describe('wallpapers', () => {
  it('reads a saved choice, keeping Brightness in range', () => {
    expect(readWallpaper('{"key":"galaxy","brightness":1.5}')).toEqual({ key: 'galaxy', brightness: 1.5 });
    expect(readWallpaper('{"key":"galaxy","brightness":9}')?.brightness).toBe(2);
    expect(readWallpaper('{"key":"galaxy"}')?.brightness).toBe(1);
    expect(readWallpaper('{"key":"somewhere"}')).toBeNull();
    expect(readWallpaper('not json')).toBeNull();
  });

  it('shows dark rows at full strength and tones bright ones down', () => {
    const s = rowStrengths(rowsOf([10, 10, 10, 250, 10]), 4, 5, '#000000', '#98989f');
    expect(s[0]).toBe(1);
    expect(s[3]).toBeLessThan(0.5);
    // Its neighbours take the bright row's limit, so the gradient never runs brighter than it.
    expect(s[2]).toBe(s[3]);
    expect(s[4]).toBe(s[3]);
  });

  it('lays the page colour over the picture, less of it where the picture may show', () => {
    const g = scrimGradient([1, 0.5], '#120a1f', 1);
    expect(g).toBe(
      'linear-gradient(to bottom, rgb(18 10 31 / 0.000) 25.00%, rgb(18 10 31 / 0.500) 75.00%)',
    );
    // Brightness shows more, never past the picture itself.
    expect(scrimGradient([1, 0.5], '#000000', 2)).toContain('rgb(0 0 0 / 0.000) 75.00%');
  });
});
