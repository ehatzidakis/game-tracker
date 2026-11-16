import {
  CLAIM_TIMEOUT_MS,
  INVITE_CODE,
  INVITE_DAYS,
  inviteState,
  newInvite,
  PASSWORD_RULES,
  passwordOk,
} from '../../../api/_lib/signup.js';

const now = Date.parse('2026-11-16T12:00:00Z');
const DAY = 24 * 60 * 60 * 1000;

describe('passwordOk', () => {
  it('needs 8 characters, a number and a special character', () => {
    expect(passwordOk('abcdef1!')).toBe(true);
    expect(passwordOk('abcde1!')).toBe(false); // 7 characters
    expect(passwordOk('abcdefg!')).toBe(false); // no number
    expect(passwordOk('abcdefg1')).toBe(false); // no special character
  });

  it('takes iPhone suggested passwords', () => {
    expect(passwordOk('fakwe8-gihtoh-Rowqup')).toBe(true);
  });

  it("doesn't count a space as a special character", () => {
    expect(passwordOk('abcd efg1')).toBe(false);
  });

  it('counts accented letters and symbols as special', () => {
    expect(passwordOk('pässword1')).toBe(true);
    expect(passwordOk('password1€')).toBe(true);
  });

  it('refuses very long passwords', () => {
    expect(passwordOk(`a1!${'x'.repeat(126)}`)).toBe(false);
  });

  it('lists each rule so the page can tick them off', () => {
    expect(PASSWORD_RULES.map((rule) => rule.test('abc1'))).toEqual([false, true, false]);
  });
});

describe('inviteState', () => {
  const invite = newInvite('owner', now);

  it('works for INVITE_DAYS days', () => {
    expect(invite.expiresAt - invite.createdAt).toBe(INVITE_DAYS * DAY);
    expect(inviteState(invite, now + INVITE_DAYS * DAY - 1)).toBe('ok');
    expect(inviteState(invite, now + INVITE_DAYS * DAY)).toBe('expired');
  });

  it('works once', () => {
    expect(inviteState({ ...invite, usedBy: 'friend', usedAt: now }, now)).toBe('used');
  });

  it('is busy while a sign-up holds it, then free again if that never finished', () => {
    const claimed = { ...invite, claimedAt: now };
    expect(inviteState(claimed, now + 1000)).toBe('busy');
    expect(inviteState(claimed, now + CLAIM_TIMEOUT_MS)).toBe('ok');
  });

  it("is missing when there's no such invite", () => {
    expect(inviteState(undefined, now)).toBe('missing');
  });
});

describe('INVITE_CODE', () => {
  it('matches the codes the server makes and nothing shorter', () => {
    expect(INVITE_CODE.test('a'.repeat(32))).toBe(true);
    expect(INVITE_CODE.test('Ab-_'.repeat(8))).toBe(true);
    expect(INVITE_CODE.test('a'.repeat(31))).toBe(false);
    expect(INVITE_CODE.test(`${'a'.repeat(31)}/`)).toBe(false);
  });
});
