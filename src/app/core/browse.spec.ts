import { TestBed } from '@angular/core/testing';
import { NavigationEnd, Router } from '@angular/router';
import { Subject } from 'rxjs';
import { BrowseService } from './browse';

function setup() {
  const events = new Subject<unknown>();
  TestBed.configureTestingModule({ providers: [{ provide: Router, useValue: { events } }] });
  const browse = TestBed.inject(BrowseService);
  const land = (url: string) => events.next(new NavigationEnd(1, url, url));
  return { browse, land };
}

describe('BrowseService', () => {
  it('knows the games either side of the one you tapped', () => {
    const { browse, land } = setup();
    browse.start([1, 2, 3], 2, '/library');
    land('/game/2');
    expect(browse.neighbours(2)).toEqual({ prev: 1, next: 3 });
    expect(browse.neighbours(1)).toEqual({ prev: null, next: null });
  });

  it('has nothing past either end', () => {
    const { browse } = setup();
    browse.start([1, 2, 3], 1, '/library');
    expect(browse.neighbours(1)).toEqual({ prev: null, next: 2 });
    browse.moved(3);
    expect(browse.neighbours(3)).toEqual({ prev: 2, next: null });
  });

  it('follows a swipe', () => {
    const { browse, land } = setup();
    browse.start([1, 2, 3], 1, '/library');
    land('/game/1');
    browse.moved(2);
    land('/game/2');
    expect(browse.neighbours(2)).toEqual({ prev: 1, next: 3 });
  });

  it('clears when you land on another game, or leave', () => {
    const { browse, land } = setup();
    browse.start([1, 2, 3], 2, '/library');
    land('/game/2');
    // A DLC link from the page (even one that's in the list).
    land('/game/3');
    expect(browse.neighbours(3)).toEqual({ prev: null, next: null });
    land('/game/2');
    expect(browse.neighbours(2)).toEqual({ prev: null, next: null });
  });

  it('is kept on the game’s trophy list', () => {
    const { browse, land } = setup();
    browse.start([1, 2, 3], 2, '/calendar');
    land('/game/2/trophies');
    land('/game/2');
    expect(browse.neighbours(2)).toEqual({ prev: 1, next: 3 });
    // Not on a game whose id only starts the same.
    land('/game/21');
    expect(browse.neighbours(2)).toEqual({ prev: null, next: null });
  });

  it('says which game to show after Back, once, and only after a swipe', () => {
    const { browse, land } = setup();
    browse.start([1, 2, 3], 1, '/library');
    land('/game/1');
    expect(browse.takeReveal('/library')).toBeNull();

    browse.start([1, 2, 3], 1, '/library');
    browse.moved(2);
    browse.moved(3);
    land('/library');
    expect(browse.takeReveal('/calendar')).toBeNull();
    expect(browse.takeReveal('/library')).toBe(3);
    expect(browse.takeReveal('/library')).toBeNull();
  });
});
