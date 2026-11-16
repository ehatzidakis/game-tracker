import { addAllMessage } from './psn-add-all.service';

describe('addAllMessage', () => {
  it('says where they go and that the Backlog ones can be moved', () => {
    expect(addAllMessage(32, 50, 0)).toBe(
      '32 with a Platinum go to Completed, the other 50 go to the Backlog. You can move any of them to Completed or Shelved from there.',
    );
  });

  it('says how many IGDB didn’t find stay behind', () => {
    expect(addAllMessage(1, 1, 3)).toBe(
      '1 with a Platinum goes to Completed, the other 1 goes to the Backlog. You can move any of them to Completed or Shelved from there. 3 games not found on IGDB stay here, to add one by one.',
    );
  });

  it('leaves out what doesn’t apply', () => {
    expect(addAllMessage(0, 12, 0)).toBe(
      '12 games go to the Backlog. You can move any of them to Completed or Shelved from there.',
    );
    expect(addAllMessage(4, 0, 1)).toBe(
      '4 with a Platinum go to Completed. 1 game not found on IGDB stays here, to add one by one.',
    );
  });
});
