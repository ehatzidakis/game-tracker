import { subscribeUrl } from './calendar-link';
import { isAndroid, isApple } from './platform';

const IPHONE =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148';
const IPAD_AS_MAC =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15';
const ANDROID =
  'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Mobile Safari/537.36';

describe('platform', () => {
  it('knows an iPhone, and an iPad that says it is a Mac', () => {
    expect(isApple(IPHONE, 5)).toBe(true);
    expect(isApple(IPAD_AS_MAC, 5)).toBe(true);
  });

  it('does not take a real Mac or Android for Apple', () => {
    expect(isApple(IPAD_AS_MAC, 0)).toBe(false);
    expect(isApple(ANDROID, 5)).toBe(false);
  });

  it('knows Android', () => {
    expect(isAndroid(ANDROID)).toBe(true);
    expect(isAndroid(IPHONE)).toBe(false);
  });
});

describe('subscribeUrl', () => {
  const feed = 'https://questloggd.app/api/calendar.ics?key=abc123';

  it('is a webcal link on iPhone', () => {
    expect(subscribeUrl(feed, false)).toBe('webcal://questloggd.app/api/calendar.ics?key=abc123');
  });

  it("is Google Calendar's add page on Android, with the webcal link encoded", () => {
    expect(subscribeUrl(feed, true)).toBe(
      'https://calendar.google.com/calendar/render?cid=' +
        encodeURIComponent('webcal://questloggd.app/api/calendar.ics?key=abc123'),
    );
  });
});
