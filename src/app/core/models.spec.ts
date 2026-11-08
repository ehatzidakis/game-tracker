import { shownInLibrary } from '../../../api/_lib/models.js';

describe('shownInLibrary', () => {
  it('lists games, and DLC only while it is on the wishlist', () => {
    expect(shownInLibrary({ status: 'completed', parentId: null })).toBe(true);
    expect(shownInLibrary({ status: 'wishlist', parentId: 5 })).toBe(true);
    expect(shownInLibrary({ status: 'backlog', parentId: 5 })).toBe(false);
    expect(shownInLibrary({ status: 'completed', parentId: 5 })).toBe(false);
  });
});
