import { EnvironmentInjector, Injectable, inject, runInInjectionContext } from '@angular/core';
import { DocumentData, Firestore, QueryDocumentSnapshot, Transaction, collection, doc, documentId, getDoc, getDocs, limit, orderBy, query, runTransaction, startAfter, where } from '@angular/fire/firestore';
import { AuthService, validUid } from './auth.service';
import { CATEGORIES, JOURNEY_STATUSES, JourneyStatus, MAX_JOURNEY_NOTES, REFLECTION_MAX_LENGTH } from './models';
import { CreateSharedJourneyInput, FinishSharedJourneyInput, MAX_SHARED_MEMBERS, MAX_SHARED_MILESTONES, SHARED_PAGE_SIZE, SHARED_RULES_VERSION, SHARED_UNITS, SharedJourney, SharedMember, SharedMilestone, SharedPost, SharedPostInput } from './shared-models';

export type SharedCursor = QueryDocumentSnapshot<DocumentData> | null;
export interface SharedJourneyPage {items: SharedJourney[]; cursor: SharedCursor; hasMore: boolean;}
export interface SharedPostPage {items: SharedPost[]; cursor: SharedCursor; hasMore: boolean;}
type SharedErrorCode = 'shared-validation' | 'shared-access' | 'shared-disabled';

@Injectable({providedIn: 'root'})
export class SharedJourneyService {
  private readonly db = inject(Firestore);
  private readonly auth = inject(AuthService);
  private readonly injector = inject(EnvironmentInjector);
  private run<T>(work: () => T): T {return runInInjectionContext(this.injector, work);}
  private fail(code: SharedErrorCode, message: string): never {throw Object.assign(new Error(message), {code: `vaultlog/${code}`});}
  private uid(): string {
    try {return this.auth.requireUser().uid;} catch {return this.fail('shared-access', 'Entre com sua conta para abrir jornadas em companhia.');}
  }
  private id(value: string): void {
    if (typeof value !== 'string' || !validUid(value)) this.fail('shared-validation', 'Confira o identificador da jornada ou do perfil.');
  }
  private groupRef(id: string) {return this.run(() => doc(this.db, 'sharedJourneys', id));}
  private memberRef(id: string, uid: string) {return this.run(() => doc(this.db, 'sharedJourneys', id, 'members', uid));}
  private version(previous?: number): number {return Math.max(Date.now(), typeof previous === 'number' && Number.isFinite(previous) ? previous + 1 : 0);}
  private text(value: unknown, max: number, label: string, required = false): string {
    if (typeof value !== 'string') this.fail('shared-validation', `${label} precisa ser um texto.`);
    const text = value.trim();
    if ((required && !text) || text.length > max) this.fail('shared-validation', `${label}: use ${required ? 'de 1 a' : 'até'} ${max} caracteres.`);
    return text;
  }
  private progress(value: unknown, nullable = false): number | null {
    if (nullable && value === null) return null;
    if (typeof value !== 'number' || !Number.isInteger(value) || value < 0 || value > 1000000) this.fail('shared-validation', 'Informe um progresso inteiro de 0 a 1.000.000.');
    return value;
  }
  private enabled(data: DocumentData | undefined): void {
    if (data?.['enabled'] !== true || data?.['rulesVersion'] !== SHARED_RULES_VERSION) {
      this.fail('shared-disabled', 'As jornadas em companhia ainda não estão disponíveis. Tente novamente mais tarde.');
    }
  }
  async ensureAvailable(): Promise<void> {
    try {
      const snapshot = await this.run(() => getDoc(doc(this.db, 'appConfig', 'sharedJourneys')));
      this.enabled(snapshot.exists() ? snapshot.data() : undefined);
    } catch (error) {
      if ((error as {code?: string})?.code === 'vaultlog/shared-disabled') throw error;
      this.fail('shared-disabled', 'Não foi possível verificar a disponibilidade das jornadas em companhia. Tente novamente mais tarde.');
    }
  }
  private async transactionGate(tx: Transaction): Promise<void> {
    const snapshot = await tx.get(this.run(() => doc(this.db, 'appConfig', 'sharedJourneys')));
    this.enabled(snapshot.exists() ? snapshot.data() : undefined);
  }
  private access(group: SharedJourney | null, member: SharedMember | null, allowInvite = false, allowArchived = false): asserts member is SharedMember {
    if (!group || !member || (member.state !== 'active' && !(allowInvite && member.state === 'invited'))) {
      this.fail('shared-access', 'Você precisa participar desta jornada para continuar.');
    }
    if (group.archived && !allowArchived) this.fail('shared-access', 'Esta jornada está arquivada. Você ainda pode consultar o que foi compartilhado.');
  }
  private owner(group: SharedJourney, member: SharedMember, uid: string): void {
    if (group.ownerId !== uid || member.role !== 'owner') this.fail('shared-access', 'Somente quem criou a jornada pode realizar esta ação.');
  }
  private async identity(uid: string): Promise<{displayName: string; photoURL: string}> {
    const snapshot = await this.run(() => getDoc(doc(this.db, 'users', uid)));
    if (!snapshot.exists()) this.fail('shared-validation', 'Não encontramos um perfil para esta pessoa.');
    const data = snapshot.data();
    return {
      displayName: typeof data['displayName'] === 'string' && data['displayName'].trim() ? data['displayName'].trim().slice(0, 60) : 'Pessoa Viveu',
      photoURL: typeof data['photoURL'] === 'string' && data['photoURL'].length <= 2048 ? data['photoURL'] : '',
    };
  }
  private async context(id: string, allowInvite = false) {
    await this.ensureAvailable(); this.id(id); const uid = this.uid();
    const [groupDoc, memberDoc] = await Promise.all([
      this.run(() => getDoc(this.groupRef(id))), this.run(() => getDoc(this.memberRef(id, uid))),
    ]);
    const group = groupDoc.exists() ? {...groupDoc.data(), id} as SharedJourney : null;
    const member = memberDoc.exists() ? memberDoc.data() as SharedMember : null;
    this.access(group, member, allowInvite, true);
    return {group: group!, member, uid};
  }
  private async change(id: string, work: (tx: Transaction, group: SharedJourney, member: SharedMember, uid: string) => Promise<void>, allowInvite = false, allowArchived = false): Promise<void> {
    await this.ensureAvailable(); this.id(id); const uid = this.uid();
    await this.run(() => runTransaction(this.db, async tx => {
      await this.transactionGate(tx);
      const groupDoc = await tx.get(this.groupRef(id));
      const memberDoc = await tx.get(this.memberRef(id, uid));
      const group = groupDoc.exists() ? {...groupDoc.data(), id} as SharedJourney : null;
      const member = memberDoc.exists() ? memberDoc.data() as SharedMember : null;
      this.access(group, member, allowInvite, allowArchived);
      await work(tx, group!, member, uid);
    }));
  }
  async list(cursor: SharedCursor = null): Promise<SharedJourneyPage> {
    await this.ensureAvailable(); const uid = this.uid();
    const snapshot = await this.run(() => getDocs(query(collection(this.db, 'sharedJourneys'),
      where('audienceIds', 'array-contains', uid), orderBy('updatedAt', 'desc'), orderBy(documentId(), 'desc'),
      ...(cursor ? [startAfter(cursor)] : []), limit(SHARED_PAGE_SIZE + 1))));
    const docs = snapshot.docs.slice(0, SHARED_PAGE_SIZE);
    return {items: docs.map(item => ({...item.data(), id: item.id} as SharedJourney)), cursor: docs.at(-1) ?? null, hasMore: snapshot.size > SHARED_PAGE_SIZE};
  }
  async get(id: string): Promise<SharedJourney | null> {
    await this.ensureAvailable(); this.id(id); const uid = this.uid();
    const snapshot = await this.run(() => getDoc(this.groupRef(id)));
    if (!snapshot.exists()) return null;
    const group = {...snapshot.data(), id} as SharedJourney;
    const own = await this.run(() => getDoc(this.memberRef(id, uid)));
    this.access(group, own.exists() ? own.data() as SharedMember : null, true, true);
    return group;
  }
  async membership(id: string): Promise<SharedMember | null> {
    await this.ensureAvailable(); this.id(id); const uid = this.uid();
    const snapshot = await this.run(() => getDoc(this.memberRef(id, uid)));
    return snapshot.exists() ? snapshot.data() as SharedMember : null;
  }
  async members(id: string): Promise<SharedMember[]> {
    await this.context(id);
    const snapshot = await this.run(() => getDocs(query(collection(this.db, 'sharedJourneys', id, 'members'),
      where('state', 'in', ['active', 'invited']), orderBy(documentId(), 'asc'), limit(MAX_SHARED_MEMBERS))));
    return snapshot.docs.map(item => ({...item.data(), uid: item.id} as SharedMember));
  }
  async posts(id: string, cursor: SharedCursor = null): Promise<SharedPostPage> {
    await this.context(id);
    const snapshot = await this.run(() => getDocs(query(collection(this.db, 'sharedJourneys', id, 'posts'),
      orderBy('createdAt', 'desc'), orderBy(documentId(), 'desc'), ...(cursor ? [startAfter(cursor)] : []), limit(SHARED_PAGE_SIZE + 1))));
    const docs = snapshot.docs.slice(0, SHARED_PAGE_SIZE);
    return {items: docs.map(item => ({...item.data(), id: item.id} as SharedPost)), cursor: docs.at(-1) ?? null, hasMore: snapshot.size > SHARED_PAGE_SIZE};
  }
  async create(input: CreateSharedJourneyInput): Promise<string> {
    await this.ensureAvailable(); const uid = this.uid();
    const title = this.text(input.title, 160, 'O título', true);
    const description = this.text(input.description, 1000, 'A descrição');
    if (!CATEGORIES.some(item => item.value === input.category) || !SHARED_UNITS.some(item => item.value === input.unit)
      || !['free', 'milestones'].includes(input.pace)) this.fail('shared-validation', 'Escolha uma categoria, unidade e ritmo válidos.');
    const identity = await this.identity(uid);
    const reference = this.run(() => doc(collection(this.db, 'sharedJourneys')));
    const entryId = this.run(() => doc(collection(this.db, 'entries'))).id;
    const now = Date.now();
    await this.run(() => runTransaction(this.db, async tx => {
      await this.transactionGate(tx);
      tx.set(reference, {ownerId: uid, ownerName: identity.displayName, title, category: input.category, description,
        pace: input.pace, unit: input.unit, memberIds: [uid], audienceIds: [uid], invitedIds: [], milestones: [], archived: false, createdAt: now, updatedAt: now});
      tx.set(this.memberRef(reference.id, uid), this.newMember(uid, identity, entryId, 'owner', 'active', now));
    }));
    return reference.id;
  }
  private newMember(uid: string, identity: {displayName: string; photoURL: string}, entryId: string, role: 'owner' | 'member', state: 'active' | 'invited', now: number): SharedMember {
    return {uid, ...identity, role, state, entryId, entryPublished: false, progress: 0, status: 'in_progress', rating: null, reflection: '', joinedAt: state === 'active' ? now : null, invitedAt: now, updatedAt: now};
  }
  async invite(id: string, targetUid: string): Promise<void> {
    await this.ensureAvailable(); this.id(targetUid); const uid = this.uid();
    if (uid === targetUid) this.fail('shared-validation', 'Você já participa desta jornada. Escolha outra pessoa.');
    const identity = await this.identity(targetUid);
    await this.change(id, async (tx, group, member, uid) => {
      this.owner(group, member, uid);
      const reference = this.memberRef(id, targetUid); const target = await tx.get(reference);
      const existing = target.exists() ? target.data() as SharedMember : null;
      if (existing && ['active', 'invited'].includes(existing.state)) this.fail('shared-validation', 'Esta pessoa já participa ou tem um convite pendente.');
      if (new Set([...group.audienceIds, targetUid]).size > MAX_SHARED_MEMBERS) this.fail('shared-validation', 'Esta jornada já atingiu o limite de 30 pessoas, incluindo convites.');
      const now = this.version(existing?.updatedAt);
      if (existing) tx.update(reference, {state: 'invited', invitedAt: now, updatedAt: now});
      else tx.set(reference, this.newMember(targetUid, identity, this.run(() => doc(collection(this.db, 'entries'))).id, 'member', 'invited', now));
      tx.update(this.groupRef(id), {audienceIds: [...new Set([...group.audienceIds, targetUid])], invitedIds: [...new Set([...group.invitedIds, targetUid])], updatedAt: this.version(group.updatedAt)});
    });
  }
  async respond(id: string, accept: boolean): Promise<void> {
    await this.ensureAvailable();
    if (typeof accept !== 'boolean') this.fail('shared-validation', 'Escolha aceitar ou recusar o convite.');
    await this.change(id, async (tx, group, member, uid) => {
      if (member.state !== 'invited') this.fail('shared-access', 'Este convite não está mais pendente.');
      const now = this.version(member.updatedAt);
      tx.update(this.memberRef(id, uid), {state: accept ? 'active' : 'declined', joinedAt: accept ? now : member.joinedAt, updatedAt: now});
      tx.update(this.groupRef(id), {invitedIds: group.invitedIds.filter(value => value !== uid),
        memberIds: accept ? [...new Set([...group.memberIds, uid])] : group.memberIds.filter(value => value !== uid),
        audienceIds: accept ? [...new Set([...group.audienceIds, uid])] : group.audienceIds.filter(value => value !== uid), updatedAt: this.version(group.updatedAt)});
    }, true, !accept);
  }
  async updateProgress(id: string, progress: number, status: JourneyStatus): Promise<void> {
    await this.ensureAvailable(); const amount = this.progress(progress)!;
    if (!JOURNEY_STATUSES.some(item => item.value === status) || status === 'completed') this.fail('shared-validation', 'Para concluir, use a avaliação individual da jornada.');
    await this.change(id, async (tx, group, member, uid) => {
      tx.update(this.memberRef(id, uid), {progress: amount, status, updatedAt: this.version(member.updatedAt)});
      tx.update(this.groupRef(id), {updatedAt: this.version(group.updatedAt)});
    });
  }
  async leave(id: string): Promise<void> {
    await this.change(id, async (tx, group, member, uid) => {
      if (group.ownerId === uid || member.role === 'owner') this.fail('shared-access', 'Quem criou a jornada pode arquivá-la, mas não sair dela.');
      tx.update(this.memberRef(id, uid), {state: 'left', updatedAt: this.version(member.updatedAt)});
      tx.update(this.groupRef(id), {memberIds: group.memberIds.filter(value => value !== uid), invitedIds: group.invitedIds.filter(value => value !== uid), audienceIds: group.audienceIds.filter(value => value !== uid), updatedAt: this.version(group.updatedAt)});
    }, false, true);
  }
  async archive(id: string): Promise<void> {
    await this.change(id, async (tx, group, member, uid) => {
      this.owner(group, member, uid); tx.update(this.groupRef(id), {archived: true, updatedAt: this.version(group.updatedAt)});
    });
  }
  async addMilestone(id: string, input: Omit<SharedMilestone, 'id'>): Promise<void> {
    await this.ensureAvailable();
    const title = this.text(input.title, 120, 'O título do marco', true);
    const question = this.text(input.question, 500, 'A pergunta'); const position = this.progress(input.position)!;
    if (input.meetingAt !== null && (typeof input.meetingAt !== 'number' || !Number.isFinite(input.meetingAt) || input.meetingAt < 0)) this.fail('shared-validation', 'Informe uma data válida para o encontro.');
    await this.change(id, async (tx, group, member, uid) => {
      this.owner(group, member, uid);
      if (group.pace !== 'milestones' || group.milestones.length >= MAX_SHARED_MILESTONES) this.fail('shared-validation', 'Use uma jornada por marcos, com até 20 marcos.');
      if (group.milestones.some(item => item.position === position)) this.fail('shared-validation', 'Já existe um marco neste ponto da jornada.');
      const milestone: SharedMilestone = {id: crypto.randomUUID(), title, question, position, meetingAt: input.meetingAt};
      tx.update(this.groupRef(id), {milestones: [...group.milestones, milestone].sort((a, b) => a.position - b.position), updatedAt: this.version(group.updatedAt)});
    });
  }
  private publicEntry(group: SharedJourney, member: SharedMember, uid: string, previous: DocumentData | undefined): DocumentData {
    if (previous && previous['authorId'] !== uid) this.fail('shared-access', 'Este registro público não pertence à sua conta.');
    const now = Date.now();
    return previous ? {...previous} : {authorId: uid, author: {displayName: member.displayName, photoURL: member.photoURL || ''},
      title: group.title, category: group.category, rating: null, quote: '', reflection: '', feelings: [], containsSpoilers: false,
      status: 'in_progress', reason: '', resumePoint: '', notes: [], startedAt: member.joinedAt ?? now, completedAt: null,
      previousEntryId: null, createdAt: now};
  }
  async addPost(id: string, input: SharedPostInput): Promise<void> {
    await this.ensureAvailable(); this.id(id); const text = this.text(input.text, 1000, 'O texto', true);
    const progress = this.progress(input.progress, true);
    if (!['note', 'question', 'session'].includes(input.kind) || typeof input.containsSpoilers !== 'boolean'
      || (input.publishPublicly !== undefined && typeof input.publishPublicly !== 'boolean')) this.fail('shared-validation', 'Confira o tipo da mensagem e as escolhas de publicação e spoilers.');
    const publishPublicly = input.publishPublicly === true;
    const reference = this.run(() => doc(collection(this.db, 'sharedJourneys', id, 'posts')));
    await this.change(id, async (tx, group, member, uid) => {
      const entryReference = this.run(() => doc(this.db, 'entries', member.entryId));
      const snapshot = publishPublicly ? await tx.get(entryReference) : null;
      const now = Date.now();
      const post: Omit<SharedPost, 'id'> = {authorId: uid, authorName: member.displayName, text, kind: input.kind, progress,
        containsSpoilers: input.containsSpoilers, publishedPublicly: publishPublicly, createdAt: now};
      if (publishPublicly) {
        const entry = this.publicEntry(group, member, uid, snapshot?.exists() ? snapshot.data() : undefined);
        const notes = Array.isArray(entry['notes']) ? entry['notes'] : [];
        if (notes.length >= MAX_JOURNEY_NOTES) this.fail('shared-validation', 'Seu registro público já tem 100 notas. A mensagem não foi publicada; você pode enviá-la somente à jornada.');
        tx.set(entryReference, {...entry, notes: [...notes, {id: reference.id, text, createdAt: now, containsSpoilers: input.containsSpoilers}], updatedAt: this.version(entry['updatedAt'])});
        tx.update(this.memberRef(id, uid), {entryPublished: true, updatedAt: this.version(member.updatedAt)});
      }
      tx.set(reference, post);
      tx.update(this.groupRef(id), {updatedAt: this.version(group.updatedAt)});
    });
  }
  async finish(id: string, input: FinishSharedJourneyInput): Promise<void> {
    await this.ensureAvailable(); const reflection = this.text(input.reflection, REFLECTION_MAX_LENGTH, 'A reflexão');
    if (!Number.isInteger(input.rating) || input.rating < 1 || input.rating > 5
      || (input.publishPublicly !== undefined && typeof input.publishPublicly !== 'boolean')) this.fail('shared-validation', 'Escolha uma nota de 1 a 5 e confira a opção de publicação.');
    const publishPublicly = input.publishPublicly === true;
    await this.change(id, async (tx, group, member, uid) => {
      const entryReference = this.run(() => doc(this.db, 'entries', member.entryId));
      const snapshot = publishPublicly ? await tx.get(entryReference) : null;
      const now = Date.now();
      if (publishPublicly) {
        const entry = this.publicEntry(group, member, uid, snapshot?.exists() ? snapshot.data() : undefined);
        tx.set(entryReference, {...entry, status: 'completed', rating: input.rating, reflection,
          containsSpoilers: reflection ? true : entry['containsSpoilers'] ?? false,
          completedAt: entry['completedAt'] ?? now, updatedAt: this.version(entry['updatedAt'])});
      }
      tx.update(this.memberRef(id, uid), {status: 'completed', rating: input.rating, reflection,
        entryPublished: member.entryPublished || publishPublicly, updatedAt: this.version(member.updatedAt)});
      tx.update(this.groupRef(id), {updatedAt: this.version(group.updatedAt)});
    }, false, true);
  }
}
