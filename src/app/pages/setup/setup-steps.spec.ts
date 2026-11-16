import {
  initialMarks,
  SETUP_STEPS,
  setupChoices,
  setupCounts,
  shownAt,
  toggled,
} from './setup-steps';

const game = (conceptId: number, platinumEarned = false) => ({
  conceptId,
  platinumEarned,
  igdb: { id: conceptId * 10, name: `Game ${conceptId}`, coverId: null },
});
const pool = [game(1, true), game(2), game(3), game(4), game(5, true)];

describe('setup steps', () => {
  it('go Completed, Shelved, Backlog', () => {
    expect(SETUP_STEPS.map((s) => s.list)).toEqual(['completed', 'shelved', 'backlog']);
  });

  it('start with the Platinums marked Completed', () => {
    expect([...initialMarks(pool)]).toEqual([
      [1, 'completed'],
      [5, 'completed'],
    ]);
  });

  it('show each step only the games not marked in an earlier one', () => {
    let marks = initialMarks(pool);
    expect(shownAt(0, pool, marks).map((g) => g.conceptId)).toEqual([1, 2, 3, 4, 5]);
    expect(shownAt(1, pool, marks).map((g) => g.conceptId)).toEqual([2, 3, 4]);
    marks = toggled(marks, 2, 'shelved');
    expect(shownAt(1, pool, marks).map((g) => g.conceptId)).toEqual([2, 3, 4]);
    expect(shownAt(2, pool, marks).map((g) => g.conceptId)).toEqual([3, 4]);
  });

  it('keep a game marked in a later step in an earlier step, unmarked there', () => {
    const marks = toggled(new Map(), 3, 'backlog');
    expect(shownAt(0, pool, marks).map((g) => g.conceptId)).toContain(3);
    expect(toggled(marks, 3, 'completed').get(3)).toBe('completed');
  });

  it('unmark a game tapped again', () => {
    expect(toggled(new Map([[2, 'shelved']]), 2, 'shelved').has(2)).toBe(false);
  });

  it('count each list and what was left out', () => {
    const marks = new Map([
      [1, 'completed' as const],
      [2, 'shelved' as const],
      [3, 'backlog' as const],
    ]);
    expect(setupCounts(pool, marks)).toEqual({
      completed: 1,
      shelved: 1,
      backlog: 1,
      total: 3,
      leftOut: 2,
    });
  });

  it('add Platinums as Platinum, other finished games as Main story, and nothing unmarked', () => {
    const marks = new Map([
      [1, 'completed' as const],
      [2, 'completed' as const],
      [3, 'shelved' as const],
      [4, 'backlog' as const],
    ]);
    expect(setupChoices(pool, marks)).toEqual([
      { conceptId: 1, igdbId: 10, status: 'completed', completion: 'platinum' },
      { conceptId: 2, igdbId: 20, status: 'completed', completion: 'main' },
      { conceptId: 3, igdbId: 30, status: 'shelved', completion: null },
      { conceptId: 4, igdbId: 40, status: 'backlog', completion: null },
    ]);
  });
});
