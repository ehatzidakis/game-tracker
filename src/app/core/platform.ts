/**
 * Which phone the app is running on, for the few places where iPhone and Android need different
 * handling (pickers, adding the calendar). The app is designed on iPhone; Android gets the same
 * look where its own system pieces would differ.
 */

/** iPhone or iPad (iPadOS reports itself as a Mac, but one with a touch screen). */
export function isApple(ua = navigator.userAgent, touchPoints = navigator.maxTouchPoints): boolean {
  return /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && touchPoints > 1);
}

export function isAndroid(ua = navigator.userAgent): boolean {
  return /Android/.test(ua);
}
