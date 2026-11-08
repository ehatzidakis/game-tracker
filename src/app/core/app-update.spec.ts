import { liveBundle } from './app-update';

describe('liveBundle', () => {
  it("reads the main file's name from index.html", () => {
    expect(liveBundle('<script src="main-U3WSJJSQ.js" type="module"></script>')).toBe(
      'main-U3WSJJSQ.js',
    );
    expect(liveBundle('<script src="/main-AB_12-cd.js"></script>')).toBe('main-AB_12-cd.js');
  });

  it('finds nothing on the dev server, whose main.js has no hash', () => {
    expect(liveBundle('<script src="main.js" type="module"></script>')).toBeNull();
  });
});
