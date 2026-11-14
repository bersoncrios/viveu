import { Category, ConsumptionEntry, QueueItem, journeyStatus } from './models';

export function normalizeTitle(title: string): string {
  return title.trim().normalize('NFKC').toLocaleLowerCase('pt-BR').replace(/\s+/g, ' ');
}
export function tasteProfile(entries: ConsumptionEntry[]) {
  const completed = entries.filter(entry => journeyStatus(entry) === 'completed');
  const rated = completed.filter(entry => entry.rating !== null);
  const counts = new Map<Category, number>();
  for (const entry of entries) counts.set(entry.category, (counts.get(entry.category) ?? 0) + 1);
  return {
    favorites: [...counts].map(([category, count]) => ({category, count})).sort((a, b) => b.count - a.count || a.category.localeCompare(b.category)).slice(0, 3),
    average: rated.length ? rated.reduce((sum, entry) => sum + (entry.rating ?? 0), 0) / rated.length : null,
    best: [...rated].sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0) || (b.completedAt ?? b.createdAt) - (a.completedAt ?? a.createdAt))[0] ?? null,
    total: entries.length, completed: completed.length,
    quote: [...entries].filter(entry => entry.quote?.trim() && !entry.containsSpoilers).sort((a, b) => b.updatedAt - a.updatedAt || b.createdAt - a.createdAt)[0] ?? null,
  };
}
export interface CulturalCompatibility {
  score: number;
  sharedWorks: number;
  sharedCategories: number;
  comparableParts: number;
}
/** Calculates a symmetric compatibility score from the two in-memory libraries. */
export function culturalCompatibility(first: ConsumptionEntry[], second: ConsumptionEntry[]): CulturalCompatibility {
  const parts: Array<{score: number; weight: number}> = [];
  const works = (entries: ConsumptionEntry[]) => new Set(entries
    .map(entry => ({title: normalizeTitle(entry.title), category: entry.category}))
    .filter(work => work.title)
    .map(work => `${work.title}\u0000${work.category}`));
  const firstWorks = works(first), secondWorks = works(second);
  let sharedWorks = 0;
  if (firstWorks.size && secondWorks.size) {
    for (const work of firstWorks) if (secondWorks.has(work)) sharedWorks++;
    const union = new Set([...firstWorks, ...secondWorks]).size;
    parts.push({score: sharedWorks / union, weight: 50});
  }

  const firstTaste = tasteProfile(first), secondTaste = tasteProfile(second);
  const firstCategories = firstTaste.favorites.map(item => item.category);
  const secondCategorySet = new Set(secondTaste.favorites.map(item => item.category));
  const sharedCategories = firstCategories.filter(category => secondCategorySet.has(category)).length;
  if (firstCategories.length && secondTaste.favorites.length) {
    parts.push({score: sharedCategories / Math.max(firstCategories.length, secondTaste.favorites.length), weight: 30});
  }

  if (firstTaste.average !== null && secondTaste.average !== null) {
    parts.push({score: 1 - Math.abs(firstTaste.average - secondTaste.average) / 4, weight: 20});
  }
  const weight = parts.reduce((sum, part) => sum + part.weight, 0);
  const score = weight ? Math.round(parts.reduce((sum, part) => sum + part.score * part.weight, 0) / weight * 100) : 0;
  return {score: Math.max(0, Math.min(100, score)), sharedWorks, sharedCategories, comparableParts: parts.length};
}
export function recommendQueue(entries: ConsumptionEntry[], queue: QueueItem[], now = Date.now()): QueueItem | null {
  const recent = entries.filter(entry => journeyStatus(entry) === 'completed' && (entry.completedAt ?? entry.createdAt) >= now - 30 * 86400000 && (entry.completedAt ?? entry.createdAt) <= now);
  const counts = new Map<Category, number>();
  for (const entry of recent) counts.set(entry.category, (counts.get(entry.category) ?? 0) + 1);
  const favorite = [...counts].sort((a, b) => b[1] - a[1])[0]?.[0];
  const ordered = [...queue].sort((a, b) => a.position - b.position || a.id.localeCompare(b.id));
  return ordered.find(item => item.category === favorite) ?? ordered[0] ?? null;
}
