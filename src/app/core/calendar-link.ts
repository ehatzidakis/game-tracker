/**
 * Your calendar feed's link as one that subscribes to it. iPhone opens webcal: links in its
 * Calendar app. Android has nothing that opens them, so there it's Google Calendar's "add this
 * calendar" page, which then syncs to the phone's Calendar app.
 */
export function subscribeUrl(feed: string, android: boolean): string {
  const webcal = feed.replace(/^https?:/, 'webcal:');
  return android
    ? `https://calendar.google.com/calendar/render?cid=${encodeURIComponent(webcal)}`
    : webcal;
}
