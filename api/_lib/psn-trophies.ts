// A game's trophies for its Trophies page (api/psn-trophies.ts): PlayStation's list of the
// trophies (names, descriptions, icons, which part of the game) put together with your progress
// in it (earned and when, how rare, how far along). Pure, so it's tested without PlayStation.
import type { TrophyCounts, TrophyProgress } from './models.js';

export type TrophyGrade = keyof TrophyCounts;

export interface TrophyItem {
  id: number;
  name: string;
  detail: string;
  icon: string | null;
  grade: TrophyGrade;
  /** A secret trophy: the page keeps its name and description out of sight until it's earned. */
  hidden: boolean;
  earned: boolean;
  /** ms */
  earnedAt: number | null;
  /** How many players have it, in % (4.2), when PlayStation says. */
  rate: number | null;
  /** For trophies that count towards something (PS5 only): how far along, out of the target. */
  progress: { value: number; target: number } | null;
}

export interface TrophyGroupView {
  /** "default" is the game itself; "001", "002"… its add-ons. */
  id: string;
  name: string;
  trophies: TrophyItem[];
}

export interface TrophyListView {
  listId: string;
  platform: string;
  groups: TrophyGroupView[];
}

/** One trophy as PlayStation lists it for the game (psn-api's getTitleTrophies). */
export interface TitleTrophyData {
  trophyId: number;
  trophyHidden: boolean;
  trophyType: string;
  trophyName?: string;
  trophyDetail?: string;
  trophyIconUrl?: string;
  trophyGroupId?: string;
  trophyProgressTargetValue?: string;
}

/**
 * One trophy as PlayStation reports it for you (getUserTrophiesEarnedForTitle). `progress` is
 * sent for trophies that count towards something, though psn-api's types leave it out.
 */
export interface UserTrophyData {
  trophyId: number;
  earned?: boolean;
  earnedDateTime?: string;
  trophyEarnedRate?: string;
  trophyProgressTargetValue?: string;
  progress?: string;
}

export interface TrophyGroupData {
  trophyGroupId: string;
  trophyGroupName?: string;
}

const GRADES: readonly string[] = ['bronze', 'silver', 'gold', 'platinum'];

const number = (value: string | undefined): number | null => {
  const n = value === undefined || value === '' ? NaN : Number(value);
  return Number.isFinite(n) ? n : null;
};

/** The game's trophies, by part of the game (the game itself first), each with your progress. */
export function buildTrophyList(
  listId: string,
  platform: string,
  title: readonly TitleTrophyData[],
  mine: readonly UserTrophyData[],
  groups: readonly TrophyGroupData[],
): TrophyListView {
  const yours = new Map(mine.map((t) => [t.trophyId, t]));
  const byGroup = new Map<string, TrophyItem[]>();
  for (const t of title) {
    const you = yours.get(t.trophyId);
    const earnedAt = you?.earnedDateTime ? Date.parse(you.earnedDateTime) : NaN;
    const target = number(t.trophyProgressTargetValue ?? you?.trophyProgressTargetValue);
    const value = number(you?.progress);
    const item: TrophyItem = {
      id: t.trophyId,
      name: t.trophyName?.trim() || 'Trophy',
      detail: t.trophyDetail?.trim() ?? '',
      icon: t.trophyIconUrl ?? null,
      grade: (GRADES.includes(t.trophyType) ? t.trophyType : 'bronze') as TrophyGrade,
      hidden: t.trophyHidden,
      earned: you?.earned === true,
      earnedAt: you?.earned && !Number.isNaN(earnedAt) ? earnedAt : null,
      rate: number(you?.trophyEarnedRate),
      progress: target && target > 1 ? { value: Math.min(value ?? 0, target), target } : null,
    };
    const group = t.trophyGroupId ?? 'default';
    byGroup.set(group, [...(byGroup.get(group) ?? []), item]);
  }
  const names = new Map(groups.map((g) => [g.trophyGroupId, g.trophyGroupName?.trim() ?? '']));
  const ids = [...byGroup.keys()].sort((a, b) =>
    a === 'default' ? -1 : b === 'default' ? 1 : a.localeCompare(b),
  );
  return {
    listId,
    platform,
    groups: ids.map((id, i) => ({
      id,
      name: names.get(id) || (id === 'default' ? 'Game' : `Add-on ${i}`),
      trophies: byGroup.get(id)!,
    })),
  };
}

/** A trophy list from your profile (getUserTitles), as much as finding a game's list needs. */
export interface ProfileTrophyList {
  npCommunicationId: string;
  npServiceName: 'trophy' | 'trophy2';
  trophyTitlePlatform: string;
  progress: number;
  definedTrophies: TrophyCounts;
  earnedTrophies: TrophyCounts;
}

const sameCounts = (a: TrophyCounts, b: TrophyCounts) =>
  a.bronze === b.bronze && a.silver === b.silver && a.gold === b.gold && a.platinum === b.platinum;

/**
 * For a game synced before its list's id was kept: the one list on your profile with exactly its
 * platform and counts. Null when none or several match (better nothing than another game's).
 */
export function findTrophyList(
  lists: readonly ProfileTrophyList[],
  trophies: TrophyProgress,
): ProfileTrophyList | null {
  const found = lists.filter(
    (l) =>
      l.trophyTitlePlatform === trophies.platform &&
      l.progress === trophies.progress &&
      sameCounts(l.definedTrophies, trophies.defined) &&
      sameCounts(l.earnedTrophies, trophies.earned),
  );
  return found.length === 1 ? found[0] : null;
}
