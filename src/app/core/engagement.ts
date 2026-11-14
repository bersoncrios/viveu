import type { ConsumptionEntry, QueueItem } from './models';

export const BADGES = [
  {id: 'first-entry', icon: '✨', name: 'Primeira obra', description: 'Sua primeira obra concluída.'},
  {id: 'avid-reader', icon: '📚', name: 'Leitor ávido', description: 'Dez obras concluídas no seu acervo.'},
  {id: 'cinephile', icon: '🎬', name: 'Cinéfilo', description: 'Cinco filmes ou séries concluídos.'},
  {id: 'first-together', icon: '🤝', name: 'Primeira companhia', description: 'Uma jornada em companhia concluída.'},
  {id: 'public-profile', icon: '🌟', name: 'Vitrine aberta', description: 'Outra pessoa conheceu seu perfil.'},
  {id: 'full-queue', icon: '🗂️', name: 'Fila cheia', description: 'Cinco obras esperando sua vez.'},
  {id: 'explorer', icon: '🧭', name: 'Explorador', description: 'Registros em três categorias diferentes.'},
] as const;
export interface EngagementState {streakCount: number; lastActivityDate: string; badges: string[]; newBadges: string[]; broken: boolean;}
export function localDay(value: number | Date): string {
  const d = new Date(value);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
export function activityDates(entries: ConsumptionEntry[], queue: QueueItem[]): number[] {
  return [...entries.flatMap(e => [...((e.status ?? 'completed') === 'completed' ? [e.createdAt, e.updatedAt] : []), ...(e.notes ?? []).map(n => n.createdAt)]), ...queue.map(q => q.createdAt)].filter(Number.isFinite);
}
export function calculateStreak(dates: number[], now = new Date()): number {
  const days = new Set(dates.filter(d => Number.isFinite(d) && d <= now.getTime()).map(localDay));
  const cursor = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (!days.has(localDay(cursor))) cursor.setDate(cursor.getDate() - 1);
  let count = 0;
  while (days.has(localDay(cursor))) {count++; cursor.setDate(cursor.getDate() - 1);}
  return count;
}
export function badgesFor(entries: ConsumptionEntry[], queue: QueueItem[], visited = false, together = false): string[] {
  const complete = entries.filter(e => (e.status ?? 'completed') === 'completed');
  return [complete.length >= 1 && 'first-entry', complete.length >= 10 && 'avid-reader',
    complete.filter(e => e.category === 'filme' || e.category === 'serie').length >= 5 && 'cinephile',
    together && 'first-together', visited && 'public-profile', queue.length >= 5 && 'full-queue',
    new Set(entries.map(e => e.category)).size >= 3 && 'explorer'].filter((id): id is string => typeof id === 'string');
}
export function historyRanges(now = new Date()): {start: number; end: number}[] {
  return [12, 6, 1].map(months => {
    const target = new Date(now.getFullYear(), now.getMonth() - months, 1);
    target.setDate(Math.min(now.getDate(), new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate()));
    const start = new Date(target); start.setDate(start.getDate() - 3);
    const end = new Date(target); end.setDate(end.getDate() + 4);
    return {start: start.getTime(), end: end.getTime()};
  });
}
