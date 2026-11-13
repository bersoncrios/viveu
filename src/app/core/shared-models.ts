import { Category, JourneyStatus, Rating } from './models';

export const SHARED_RULES_VERSION = 1;
export const SHARED_PAGE_SIZE = 20;
export const MAX_SHARED_MEMBERS = 30;
export const MAX_SHARED_MILESTONES = 20;
export const SHARED_UNITS = [
  {value: 'capitulo', label: 'Capítulo'}, {value: 'episodio', label: 'Episódio'},
  {value: 'pagina', label: 'Página'}, {value: 'faixa', label: 'Faixa'},
  {value: 'sessao', label: 'Sessão'}, {value: 'etapa', label: 'Etapa'},
] as const;
export type SharedUnit = typeof SHARED_UNITS[number]['value'];
export type SharedPace = 'free' | 'milestones';
export interface SharedMilestone {
  id: string;
  title: string;
  position: number;
  meetingAt: number | null;
  question: string;
}
export interface SharedJourney {
  id: string;
  ownerId: string;
  ownerName: string;
  title: string;
  category: Category;
  description: string;
  pace: SharedPace;
  unit: SharedUnit;
  memberIds: string[];
  invitedIds: string[];
  audienceIds: string[];
  milestones: SharedMilestone[];
  archived: boolean;
  createdAt: number;
  updatedAt: number;
}
export type SharedMemberState = 'invited' | 'active' | 'declined' | 'left';
export interface SharedMember {
  uid: string;
  displayName: string;
  photoURL: string;
  role: 'owner' | 'member';
  state: SharedMemberState;
  progress: number;
  status: JourneyStatus;
  entryId: string;
  entryPublished: boolean;
  rating: Rating | null;
  reflection: string;
  joinedAt: number | null;
  invitedAt: number;
  updatedAt: number;
}
export type SharedPostKind = 'note' | 'question' | 'session';
export interface SharedPost {
  id: string;
  authorId: string;
  authorName: string;
  text: string;
  kind: SharedPostKind;
  progress: number | null;
  containsSpoilers: boolean;
  publishedPublicly: boolean;
  createdAt: number;
}
export interface CreateSharedJourneyInput {
  title: string;
  category: Category;
  description: string;
  pace: SharedPace;
  unit: SharedUnit;
}
export interface SharedPostInput {
  text: string;
  kind: SharedPostKind;
  progress: number | null;
  containsSpoilers: boolean;
  publishPublicly: boolean;
}
export interface FinishSharedJourneyInput {
  rating: Rating;
  reflection: string;
  publishPublicly: boolean;
}
export function sharedUnitLabel(unit: SharedUnit): string {
  return SHARED_UNITS.find(item => item.value === unit)?.label ?? 'Etapa';
}
/** Spoilers are a reading choice; membership is the actual access boundary. */
export function sharedPostHidden(post: SharedPost, member: SharedMember): boolean {
  return post.authorId !== member.uid && (post.containsSpoilers || (post.progress !== null && post.progress > member.progress));
}
