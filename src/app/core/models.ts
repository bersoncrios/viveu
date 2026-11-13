/** Shared Firestore contracts. Dates are UTC Unix milliseconds in this MVP. */
export const CATEGORIES = [
  { value: 'filme', label: 'Filmes', singular: 'Filme', icon: '◉' },
  { value: 'serie', label: 'Séries', singular: 'Série', icon: '▣' },
  { value: 'livro', label: 'Livros', singular: 'Livro', icon: '▤' },
  { value: 'jogo', label: 'Jogos', singular: 'Jogo', icon: '✦' },
  { value: 'podcast', label: 'Podcasts', singular: 'Podcast', icon: '◌' },
  { value: 'musica', label: 'Músicas', singular: 'Música', icon: '♫' },
] as const;

export type Category = (typeof CATEGORIES)[number]['value'];
export type Rating = 1 | 2 | 3 | 4 | 5;
export const JOURNEY_STATUSES = [
  {value: 'in_progress', label: 'Em andamento'},
  {value: 'paused', label: 'Pausado'},
  {value: 'completed', label: 'Terminei'},
  {value: 'abandoned', label: 'Deixei para depois'},
] as const;
export type JourneyStatus = (typeof JOURNEY_STATUSES)[number]['value'];
export const JOURNEY_REASON_MAX_LENGTH = 500;
export const RESUME_POINT_MAX_LENGTH = 160;
export const JOURNEY_NOTE_MAX_LENGTH = 1000;
export const MAX_JOURNEY_NOTES = 100;
export interface JourneyNote {
  id: string;
  text: string;
  createdAt: number;
  containsSpoilers: boolean;
}
export function journeyStatus(entry: Pick<ConsumptionEntry, 'status'>): JourneyStatus {
  return entry.status ?? 'completed';
}
export function journeyStatusLabel(status?: JourneyStatus): string {
  return JOURNEY_STATUSES.find(item => item.value === (status ?? 'completed'))!.label;
}

export const FEELINGS = [
  { value: 'inspirado', label: 'Inspirado' },
  { value: 'emocionado', label: 'Emocionado' },
  { value: 'curioso', label: 'Curioso' },
  { value: 'surpreso', label: 'Surpreso' },
  { value: 'decepcionado', label: 'Decepcionado' },
  { value: 'divertido', label: 'Divertido' },
] as const;
export type Feeling = (typeof FEELINGS)[number]['value'];
export const REFLECTION_MAX_LENGTH = 3000;
export const MAX_FEELINGS = 3;

export function reflectionPrompt(category: Category | ''): string {
  const prompts: Record<Category, string> = {
    filme: 'Que cena ou ideia deste filme ficou com você?',
    serie: 'Que personagem ou momento desta série marcou você?',
    livro: 'Que ideia ou passagem deste livro você quer levar consigo?',
    jogo: 'Que desafio ou descoberta deste jogo marcou sua experiência?',
    podcast: 'Que ideia ou conversa deste podcast fez você pensar?',
    musica: 'Que lembrança ou sentimento esta música despertou em você?',
  };
  return category ? prompts[category] : 'O que esta experiência deixou em você?';
}

/** Public document: users/{uid}. Never persist email or OAuth credentials here. */
export interface UserProfile {
  uid: string;
  displayName: string;
  bio: string;
  photoURL: string;
  createdAt: number;
  updatedAt: number;
}

/** Public document: entries/{id}. The id is supplied by the Firestore document. */
export interface ConsumptionEntry {
  id: string;
  authorId: string;
  author: Pick<UserProfile, 'displayName' | 'photoURL'>;
  title: string;
  category: Category;
  rating: Rating | null;
  quote: string;
  reflection?: string;
  feelings?: Feeling[];
  containsSpoilers?: boolean;
  status?: JourneyStatus;
  reason?: string;
  resumePoint?: string;
  notes?: JourneyNote[];
  startedAt?: number | null;
  completedAt?: number | null;
  previousEntryId?: string | null;
  createdAt: number;
  updatedAt: number;
}

export type EntryInput = Pick<ConsumptionEntry, 'title' | 'category' | 'rating'>
  & Partial<Pick<ConsumptionEntry, 'quote' | 'reflection' | 'feelings' | 'containsSpoilers'
    | 'status' | 'reason' | 'resumePoint' | 'notes' | 'previousEntryId'>>
  & {expectedUpdatedAt?: number};

/** users/{uid}/queue/{id}. Never included in public-profile reads. */
export interface QueueItem {
  id: string;
  title: string;
  category: Category;
  reason?: string;
  position: number;
  createdAt: number;
}

/** users/{uid}/following/{targetUid}; document id prevents duplicate follows. */
export interface Following {
  uid: string;
  createdAt: number;
}

export const PAGE_SIZE = 20;
export const FOLLOW_QUERY_CHUNK_SIZE = 30;

export function categoryLabel(category: Category): string {
  return CATEGORIES.find((item) => item.value === category)?.singular ?? category;
}
