import { ConsumptionEntry, QueueItem, journeyStatus } from './models';

export function previousMonth(now = new Date()): {year: number; month: number} {
  const previous = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  return {year: previous.getFullYear(), month: previous.getMonth() + 1};
}
export function validWrappedMonth(year: number, month: number, now = new Date()): boolean {
  return Number.isInteger(year) && Number.isInteger(month) && year >= 1970 && month >= 1 && month <= 12
    && new Date(year, month, 1).getTime() <= new Date(now.getFullYear(), now.getMonth(), 1).getTime();
}
export function monthlySummary(entries: ConsumptionEntry[], year: number, month: number, activity: number[] = []) {
  const start = new Date(year, month - 1, 1).getTime(), end = new Date(year, month, 1).getTime();
  const completed = entries.filter(entry => journeyStatus(entry) === 'completed' && (entry.completedAt ?? entry.createdAt) >= start && (entry.completedAt ?? entry.createdAt) < end);
  const rated = completed.filter(entry => entry.rating !== null);
  const categories = new Map<string, number>();
  for (const entry of completed) categories.set(entry.category, (categories.get(entry.category) ?? 0) + 1);
  const top = [...rated].sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0) || b.createdAt - a.createdAt)[0] ?? null;
  const quote = [...entries].filter(entry => entry.quote.trim() && !entry.containsSpoilers && entry.updatedAt >= start && entry.updatedAt < end).sort((a, b) => b.updatedAt - a.updatedAt)[0] ?? null;
  const dates = [...activity, ...entries.flatMap(entry => [...(journeyStatus(entry) === 'completed' ? [entry.createdAt, entry.updatedAt] : []), ...(entry.notes ?? []).map(note => note.createdAt)])];
  const days = [...new Set(dates.filter(date => date >= start && date < end).map(date => {const d = new Date(date); return Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86400000;}))].sort((a, b) => a - b);
  let maximum = 0, current = 0, last = -Infinity;
  for (const day of days) {current = day === last + 1 ? current + 1 : 1; maximum = Math.max(maximum, current); last = day;}
  return {total: completed.length, average: rated.length ? rated.reduce((sum, entry) => sum + (entry.rating ?? 0), 0) / rated.length : null, categories: [...categories].map(([category, count]) => ({category, count})).sort((a, b) => b.count - a.count), top, quote, maximum};
}
export function suggestQueue(entries: ConsumptionEntry[], queue: QueueItem[], now = Date.now()): QueueItem | null {
  const counts = new Map<string, number>();
  for (const entry of entries) if (journeyStatus(entry) === 'completed' && (entry.completedAt ?? entry.createdAt) >= now - 30 * 86400000 && (entry.completedAt ?? entry.createdAt) <= now) counts.set(entry.category, (counts.get(entry.category) ?? 0) + 1);
  const favorite = [...counts].sort((a, b) => b[1] - a[1])[0]?.[0];
  const ordered = [...queue].sort((a, b) => a.position - b.position || a.createdAt - b.createdAt);
  return ordered.find(item => item.category === favorite) ?? ordered[0] ?? null;
}
