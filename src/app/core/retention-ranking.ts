import { ConsumptionEntry, QueueItem } from './models';

export interface RankingPerson {uid: string; name: string;}
export interface RankingRow extends RankingPerson {value: number; isCurrentUser: boolean;}
export interface MonthlyFriendRanking {registrations: RankingRow[]; streak: RankingRow[]; categories: RankingRow[];}

/** Return a whole-day inactivity count using the browser's local calendar. */
export function daysSinceActivity(lastActivityDate: string | number | null | undefined, now = Date.now()): number | null {
  if (lastActivityDate === null || lastActivityDate === undefined || lastActivityDate === '') return null;
  const timestamp = typeof lastActivityDate === 'number' ? lastActivityDate : Date.parse(lastActivityDate);
  if (!Number.isFinite(timestamp) || timestamp > now) return null;
  const date = typeof lastActivityDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(lastActivityDate)
    ? new Date(Number(lastActivityDate.slice(0, 4)), Number(lastActivityDate.slice(5, 7)) - 1, Number(lastActivityDate.slice(8, 10)))
    : new Date(timestamp);
  const today = new Date(now);
  const activityDay = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
  const currentDay = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.max(0, Math.floor((currentDay - activityDay) / 86400000));
}

export function oldestQueueItem(queue: QueueItem[]): QueueItem | null {
  return [...queue].sort((a, b) => a.createdAt - b.createdAt || a.position - b.position)[0] ?? null;
}

/** Rank only people and entries already held by the caller; no data loading occurs here. */
export function monthlyFriendRanking(entries: ConsumptionEntry[], people: RankingPerson[], currentUid: string, year: number, month: number): MonthlyFriendRanking {
  const start = new Date(year, month - 1, 1).getTime(), end = new Date(year, month, 1).getTime();
  const identities = new Map(people.map(person => [person.uid, person]));
  for (const entry of entries) identities.set(entry.authorId, {uid: entry.authorId, name: entry.author.displayName || 'Pessoa seguida'});
  const stats = new Map<string, {count: number; categories: Set<string>; days: Set<number>}>();
  for (const uid of identities.keys()) stats.set(uid, {count: 0, categories: new Set(), days: new Set()});
  for (const entry of entries) {
    const timestamp = entry.createdAt;
    if (timestamp < start || timestamp >= end) continue;
    const record = stats.get(entry.authorId);
    if (!record) continue;
    record.count++;
    record.categories.add(entry.category);
    for (const activityAt of [entry.createdAt, entry.completedAt ?? 0]) {
      if (activityAt >= start && activityAt < end) {
        const date = new Date(activityAt);
        record.days.add(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86400000);
      }
    }
  }
  const makeRows = (value: (uid: string) => number): RankingRow[] => [...identities.values()]
    .map(person => ({...person, value: value(person.uid), isCurrentUser: person.uid === currentUid}))
    .sort((a, b) => b.value - a.value || Number(b.isCurrentUser) - Number(a.isCurrentUser) || a.name.localeCompare(b.name))
    .slice(0, 5);
  return {
    registrations: makeRows(uid => stats.get(uid)?.count ?? 0),
    streak: makeRows(uid => {
      const days = [...(stats.get(uid)?.days ?? [])].sort((a, b) => a - b);
      let best = 0, run = 0, previous = -2;
      for (const day of days) {run = day === previous + 1 ? run + 1 : 1; best = Math.max(best, run); previous = day;}
      return best;
    }),
    categories: makeRows(uid => stats.get(uid)?.categories.size ?? 0),
  };
}
