// Invites and sign-up rules, shared by the server (api/invite.ts, api/signup.ts) and the app's
// sign-up page, so both check a password the same way.

/** How long an invite link works. */
export const INVITE_DAYS = 7;
const DAY_MS = 24 * 60 * 60 * 1000;

/** A claim this old was left by a sign-up that never finished (closed tab, crash): free again. */
export const CLAIM_TIMEOUT_MS = 2 * 60 * 1000;

/** Invite codes: 24 random bytes, base64url (32 characters). */
export const INVITE_CODE = /^[A-Za-z0-9_-]{32}$/;

/** invites/{code}, server only (the security rules give the app no access). */
export interface Invite {
  /** Who made it (their uid). */
  createdBy: string;
  createdAt: number;
  expiresAt: number;
  /** Set while a sign-up with this invite is creating the account. */
  claimedAt?: number;
  /** The account made with it. An invite works once. */
  usedBy?: string;
  usedAt?: number;
}

export function newInvite(createdBy: string, now = Date.now()): Invite {
  return { createdBy, createdAt: now, expiresAt: now + INVITE_DAYS * DAY_MS };
}

export type InviteState = 'ok' | 'missing' | 'used' | 'expired' | 'busy';

export function inviteState(invite: Invite | undefined, now = Date.now()): InviteState {
  if (!invite) return 'missing';
  if (invite.usedBy) return 'used';
  if (now >= invite.expiresAt) return 'expired';
  if (invite.claimedAt && now - invite.claimedAt < CLAIM_TIMEOUT_MS) return 'busy';
  return 'ok';
}

export const INVITE_MESSAGES: Record<Exclude<InviteState, 'ok'>, string> = {
  missing: 'This invite link doesn’t work. Ask for a new one.',
  used: 'This invite link has already been used. Ask for a new one.',
  expired: 'This invite link has expired. Ask for a new one.',
  busy: 'An account is being made with this invite right now. Try again in a couple of minutes.',
};

/** What a password needs, in the order the sign-up page lists them. */
export const PASSWORD_RULES: readonly { label: string; test: (password: string) => boolean }[] = [
  { label: 'At least 8 characters', test: (p) => p.length >= 8 },
  { label: 'A number', test: (p) => /\d/.test(p) },
  { label: 'A special character, like ! or #', test: (p) => /[^A-Za-z0-9\s]/.test(p) },
];

export const PASSWORD_MAX = 128;

export function passwordOk(password: string): boolean {
  return password.length <= PASSWORD_MAX && PASSWORD_RULES.every((rule) => rule.test(password));
}
