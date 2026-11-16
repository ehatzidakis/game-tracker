import { Component } from '@angular/core';

/**
 * The Questloggd wordmark: "Questlo", the gg mark in Tint Blue, then "d". The mark is a joined
 * "gg" whose first bowl is a progress ring three-quarters full (clockwise from the top, the last
 * quarter a faint track). It is sized in ex so its bowls match the font's x-height and its tails
 * reach the descender, whatever the font. Leads the tab screens' header row (tab-title.ts). The
 * home-screen icon is the same mark in white on Fill Blue (public/icons/icon.svg).
 */
@Component({
  selector: 'app-wordmark',
  // Size and weight come from where it's used (tab-title.ts, the login page).
  host: { class: 'block tracking-[-0.01em] whitespace-nowrap' },
  template: `
    <span class="sr-only">Questloggd</span>
    <span aria-hidden="true"
      >Questlo<svg
        viewBox="16 20 68 60"
        fill="none"
        stroke="currentColor"
        stroke-width="9"
        stroke-linecap="round"
        stroke-linejoin="round"
        class="mx-[0.04em] inline-block h-[1.622ex] w-[1.838ex] align-[-0.554ex] text-accent"
      >
        <g transform="translate(0 -3)">
          <circle cx="36" cy="44" r="14" stroke-opacity="0.3" />
          <path d="M36 30A14 14 0 1 1 22 44" />
          <path d="M50 30v32a14 14 0 0 1-14 14h-4" />
          <circle cx="64" cy="44" r="14" />
          <path d="M78 30v32a14 14 0 0 1-14 14h-4" />
        </g></svg
      >d</span
    >
  `,
})
export class Wordmark {}
