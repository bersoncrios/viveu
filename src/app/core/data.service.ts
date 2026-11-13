import { EnvironmentInjector, Injectable, inject, runInInjectionContext } from '@angular/core';
import { DocumentData, Firestore, QueryDocumentSnapshot, and, collection, deleteDoc, doc, documentId, getDoc, getDocs, limit, or, orderBy, query, runTransaction, setDoc, startAfter, where } from '@angular/fire/firestore';
import { AuthService, validUid } from './auth.service';
import { CATEGORIES, Category, ConsumptionEntry, EntryInput, FEELINGS, Following, JOURNEY_NOTE_MAX_LENGTH, JOURNEY_REASON_MAX_LENGTH, JOURNEY_STATUSES, MAX_FEELINGS, MAX_JOURNEY_NOTES, PAGE_SIZE, QueueItem, REFLECTION_MAX_LENGTH, RESUME_POINT_MAX_LENGTH, UserProfile } from './models';

export type Cursor = QueryDocumentSnapshot<DocumentData> | null;
export interface EntryPage { items: ConsumptionEntry[]; cursor: Cursor; hasMore: boolean; }
export interface ProfileSearchPage { items: UserProfile[]; cursor: Cursor; hasMore: boolean; }
export const MAX_FOLLOWING = 30;

@Injectable({ providedIn: 'root' })
export class DataService {
  private readonly db = inject(Firestore);
  private readonly auth = inject(AuthService);
  private readonly injector = inject(EnvironmentInjector);
  private run<T>(work: () => T): T { return runInInjectionContext(this.injector, work); }
  private uid(): string { return this.auth.requireUser().uid; }
  private checkUid(uid: string): void { if (!validUid(uid)) throw new Error('Informe um UID de perfil válido.'); }

  async getProfile(uid: string): Promise<UserProfile | null> {
    this.checkUid(uid);
    const snapshot = await this.run(() => getDoc(doc(this.db, 'users', uid)));
    return snapshot.exists() ? snapshot.data() as UserProfile : null;
  }

  async searchProfiles(name: string, cursor: Cursor = null): Promise<ProfileSearchPage> {
    const uid = this.uid();
    const text = name.trim().replace(/\s+/g, ' ');
    if (text.length < 2 || text.length > 60) throw new Error('Digite entre 2 e 60 caracteres do nome.');
    // Query the existing public name so older profiles remain discoverable without migration.
    const prefixes = [...new Set([text, text.toLocaleLowerCase('pt-BR'), text.toLocaleUpperCase('pt-BR'),
      text.toLocaleLowerCase('pt-BR').replace(/(^|\s)\S/g, letter => letter.toLocaleUpperCase('pt-BR'))])];
    const filters = prefixes.map(prefix => and(where('displayName', '>=', prefix), where('displayName', '<=', prefix + '\uf8ff')));
    const snapshot = await this.run(() => getDocs(query(collection(this.db, 'users'),
      or(...filters), orderBy('displayName', 'asc'), orderBy(documentId(), 'asc'),
      ...(cursor ? [startAfter(cursor)] : []), limit(PAGE_SIZE + 1))));
    const docs = snapshot.docs.slice(0, PAGE_SIZE);
    return {
      items: docs.filter(item => item.id !== uid).map(item => {
        const data = item.data();
        return {uid: item.id, displayName: data['displayName'] ?? '', bio: data['bio'] ?? '',
          photoURL: data['photoURL'] ?? '', createdAt: data['createdAt'], updatedAt: data['updatedAt']} as UserProfile;
      }),
      cursor: docs.at(-1) ?? null,
      hasMore: snapshot.size > PAGE_SIZE,
    };
  }

  async entriesPage(uid: string, cursor: Cursor = null): Promise<EntryPage> {
    this.checkUid(uid);
    return this.entryQuery([uid], cursor, false);
  }

  async feedPage(followedUids: string[], cursor: Cursor = null): Promise<EntryPage> {
    this.uid();
    const ids = [...new Set(followedUids)];
    ids.forEach((uid) => this.checkUid(uid));
    if (ids.length > MAX_FOLLOWING) throw new Error('O MVP permite acompanhar até 30 perfis. Remova perfis para carregar o feed.');
    if (!ids.length) return { items: [], cursor: null, hasMore: false };
    return this.entryQuery(ids, cursor, true);
  }

  private async entryQuery(ids: string[], cursor: Cursor, feed: boolean): Promise<EntryPage> {
    const snapshot = await this.run(() => getDocs(query(collection(this.db, 'entries'),
      where('authorId', feed ? 'in' : '==', feed ? ids : ids[0]),
      orderBy('createdAt', 'desc'), orderBy(documentId(), 'desc'),
      ...(cursor ? [startAfter(cursor)] : []), limit(PAGE_SIZE))));
    return {
      items: snapshot.docs.map((item) => ({ ...item.data(), id: item.id } as ConsumptionEntry)),
      cursor: snapshot.docs.at(-1) ?? null,
      hasMore: snapshot.size === PAGE_SIZE,
    };
  }

  async saveEntry(input: EntryInput, id?: string, queueId?: string): Promise<string> {
    const uid = this.uid();
    if (id) this.checkUid(id);
    if (queueId) this.checkUid(queueId);
    const title = input.title.trim();
    this.validateTitleCategory(title, input.category);
    // Validate supplied fields before any database work. Rating depends on the saved status.
    this.entryDetails(input);
    if (input.expectedUpdatedAt !== undefined && !Number.isFinite(input.expectedUpdatedAt)) {
      throw new Error('A versão deste registro é inválida. Recarregue a página.');
    }
    if (input.previousEntryId !== undefined && input.previousEntryId !== null) {
      if (typeof input.previousEntryId !== 'string') throw new Error('Informe um registro anterior válido.');
      this.checkUid(input.previousEntryId);
    }
    const profile = await this.getProfile(uid);
    if (!profile) throw new Error('Conclua seu perfil antes de registrar.');
    // Older profiles may omit optional identity fields; Firestore rejects undefined values.
    const author = {
      displayName: typeof profile.displayName === 'string' && profile.displayName.trim()
        ? profile.displayName.trim().slice(0, 60) : 'Pessoa Viveu',
      photoURL: typeof profile.photoURL === 'string' ? profile.photoURL : '',
    };
    const reference = this.run(() => id ? doc(this.db, 'entries', id) : doc(collection(this.db, 'entries')));
    const now = Date.now();
    const queueReference = queueId ? this.run(() => doc(this.db, 'users', uid, 'queue', queueId)) : null;
    await this.run(() => runTransaction(this.db, async (transaction) => {
      const existing = id ? await transaction.get(reference) : null;
      if (id && (!existing?.exists() || existing.data()['authorId'] !== uid)) throw new Error('Você só pode editar seus próprios registros.');
      const queued = queueReference ? await transaction.get(queueReference) : null;
      if (queueReference && !queued?.exists()) throw new Error('Este item não está mais na sua fila. Atualize a página.');
      const previous = existing?.data() ?? {};
      if (id && input.expectedUpdatedAt !== undefined && previous['updatedAt'] !== input.expectedUpdatedAt) {
        throw Object.assign(new Error('Este registro mudou em outra sessão. Recarregue antes de salvar para não perder alterações.'), {code: 'vaultlog/stale-entry'});
      }
      const previousEntryId = id ? previous['previousEntryId'] ?? null : input.previousEntryId ?? null;
      const sourceReference = !id && previousEntryId ? this.run(() => doc(this.db, 'entries', previousEntryId)) : null;
      const source = sourceReference ? await transaction.get(sourceReference) : null;
      if (sourceReference && (!source?.exists() || source.data()['authorId'] !== uid)) {
        throw new Error('Você só pode revisitar seus próprios registros existentes.');
      }
      // Omitted optional fields keep the saved value; source content is never copied into a revisit.
      const supplied = Object.fromEntries(Object.entries(input).filter(([, value]) => value !== undefined));
      const merged = {...previous, ...supplied};
      if (input.reason === undefined && previous['reason'] === undefined && queued?.exists()) {
        merged['reason'] = queued.data()['reason'];
      }
      const details = this.entryDetails(merged as EntryInput);
      if (details.status === 'completed' && input.rating === null) throw new Error('Escolha uma nota de 1 a 5 para concluir.');
      if (id && Array.isArray(previous['notes'])) {
        const dates = new Map((previous['notes'] as {id: string; createdAt: number}[]).map(note => [note.id, note.createdAt]));
        details.notes = details.notes.map(note => ({...note, createdAt: dates.get(note.id) ?? note.createdAt}));
      }
      const startedAt = previous['startedAt']
        ?? (['in_progress', 'paused'].includes(details.status) ? now : null);
      const completedAt = details.status === 'completed'
        ? previous['completedAt'] ?? (id && previous['status'] === undefined ? previous['createdAt'] ?? now : now) : null;
      transaction.set(reference, {
        authorId: uid,
        author,
        title, category: input.category, rating: input.rating, ...details, startedAt, completedAt, previousEntryId,
        createdAt: previous['createdAt'] ?? now,
        updatedAt: Math.max(now, typeof previous['updatedAt'] === 'number' && Number.isFinite(previous['updatedAt'])
          ? previous['updatedAt'] + 1 : now),
      });
      if (queueReference) transaction.delete(queueReference);
    }));
    return reference.id;
  }

  private entryDetails(input: EntryInput) {
    const text = (value: unknown, max: number, name: string): string => {
      if (value !== undefined && typeof value !== 'string') throw new Error(`${name} deve ser um texto.`);
      const result = (value as string | undefined)?.trim() ?? '';
      if (result.length > max) throw new Error(`${name} deve ter até ${max} caracteres.`);
      return result;
    };
    const quote = text(input.quote, 500, 'A frase');
    const reflection = text(input.reflection, REFLECTION_MAX_LENGTH, 'A reflexão');
    const reason = text(input.reason, JOURNEY_REASON_MAX_LENGTH, 'O motivo');
    const resumePoint = text(input.resumePoint, RESUME_POINT_MAX_LENGTH, 'O ponto de retomada');
    if (input.feelings !== undefined && (!Array.isArray(input.feelings)
      || Array.from(input.feelings).some(feeling => !FEELINGS.some(item => item.value === feeling)))) {
      throw new Error('Escolha sentimentos válidos.');
    }
    const feelings = [...new Set(input.feelings ?? [])];
    if (feelings.length > MAX_FEELINGS) throw new Error(`Escolha até ${MAX_FEELINGS} sentimentos.`);
    if (input.containsSpoilers !== undefined && typeof input.containsSpoilers !== 'boolean') {
      throw new Error('Informe se o registro contém spoilers.');
    }
    const status = input.status ?? 'completed';
    if (input.status === null || !JOURNEY_STATUSES.some(item => item.value === status)) throw new Error('Escolha um estado válido para sua jornada.');
    if (input.rating !== null && (!Number.isInteger(input.rating) || input.rating < 1 || input.rating > 5)) {
      throw new Error('Escolha uma nota de 1 a 5.');
    }
    if (input.notes !== undefined && (!Array.isArray(input.notes) || input.notes.length > MAX_JOURNEY_NOTES)) {
      throw new Error(`Use até ${MAX_JOURNEY_NOTES} notas na jornada.`);
    }
    const noteIds = new Set<string>();
    const notes = Array.from(input.notes ?? []).map(note => {
      if (!note || typeof note.id !== 'string' || !validUid(note.id) || noteIds.has(note.id)) {
        throw new Error('Cada nota precisa de um identificador único válido.');
      }
      noteIds.add(note.id);
      if (!Number.isFinite(note.createdAt) || typeof note.containsSpoilers !== 'boolean') {
        throw new Error('Confira a data e a indicação de spoilers de cada nota.');
      }
      const noteText = text(note.text, JOURNEY_NOTE_MAX_LENGTH, 'A nota');
      if (!noteText) throw new Error('Escreva um texto para a nota.');
      return {id: note.id, text: noteText, createdAt: note.createdAt, containsSpoilers: note.containsSpoilers};
    });
    return {quote, reflection, reason, resumePoint, feelings, status, notes, containsSpoilers: input.containsSpoilers ?? false};
  }

  async activeJourneys(): Promise<ConsumptionEntry[]> {
    const uid = this.uid();
    const snapshot = await this.run(() => getDocs(query(collection(this.db, 'entries'),
      where('authorId', '==', uid), where('status', 'in', ['in_progress', 'paused']),
      orderBy('updatedAt', 'desc'), orderBy(documentId(), 'desc'), limit(20))));
    return snapshot.docs.map(item => ({...item.data(), id: item.id} as ConsumptionEntry));
  }

  async getEntry(id: string): Promise<ConsumptionEntry | null> {
    this.checkUid(id);
    const snapshot = await this.run(() => getDoc(doc(this.db, 'entries', id)));
    return snapshot.exists() ? { ...snapshot.data(), id: snapshot.id } as ConsumptionEntry : null;
  }

  async deleteEntry(id: string): Promise<void> {
    const uid = this.uid();
    this.checkUid(id);
    const reference = this.run(() => doc(this.db, 'entries', id));
    await this.run(() => runTransaction(this.db, async (transaction) => {
      const snapshot = await transaction.get(reference);
      if (!snapshot.exists() || snapshot.data()['authorId'] !== uid) throw new Error('Você só pode excluir seus próprios registros.');
      transaction.delete(reference);
    }));
  }

  private validateTitleCategory(title: string, category: Category): void {
    if (!title || title.length > 160) throw new Error('Use um título com 1 a 160 caracteres.');
    if (!CATEGORIES.some((item) => item.value === category)) throw new Error('Escolha uma categoria válida.');
  }

  async queue(): Promise<QueueItem[]> {
    const uid = this.uid();
    const items: QueueItem[] = [];
    let cursor: Cursor = null;
    do {
      const page = await this.run(() => getDocs(query(collection(this.db, 'users', uid, 'queue'),
        orderBy('position', 'asc'), orderBy(documentId(), 'asc'),
        ...(cursor ? [startAfter(cursor)] : []), limit(100))));
      items.push(...page.docs.map((item) => ({ ...item.data(), id: item.id } as QueueItem)));
      cursor = page.size === 100 ? page.docs.at(-1)! : null;
    } while (cursor);
    return items;
  }

  async addQueue(titleInput: string, category: Category, reasonInput = ''): Promise<void> {
    const uid = this.uid();
    const title = titleInput.trim();
    if (typeof reasonInput !== 'string' || reasonInput.trim().length > JOURNEY_REASON_MAX_LENGTH) {
      throw new Error(`O motivo deve ter até ${JOURNEY_REASON_MAX_LENGTH} caracteres.`);
    }
    const reason = reasonInput.trim();
    this.validateTitleCategory(title, category);
    const items = await this.queue();
    const reference = this.run(() => doc(collection(this.db, 'users', uid, 'queue')));
    await this.run(() => setDoc(reference, { title, category, reason, position: (items.at(-1)?.position ?? 0) + 1, createdAt: Date.now() }));
  }

  async removeQueue(id: string): Promise<void> {
    const uid = this.uid();
    this.checkUid(id);
    await this.run(() => deleteDoc(doc(this.db, 'users', uid, 'queue', id)));
  }

  async moveQueue(items: QueueItem[], index: number, delta: number): Promise<void> {
    const uid = this.uid();
    const other = index + delta;
    if (![-1, 1].includes(delta) || !items[index] || !items[other]) return;
    const current = items[index];
    const adjacent = items[other];
    const currentRef = this.run(() => doc(this.db, 'users', uid, 'queue', current.id));
    const adjacentRef = this.run(() => doc(this.db, 'users', uid, 'queue', adjacent.id));
    await this.run(() => runTransaction(this.db, async (transaction) => {
      const currentDoc = await transaction.get(currentRef);
      const adjacentDoc = await transaction.get(adjacentRef);
      if (!currentDoc.exists() || !adjacentDoc.exists()) throw new Error('A fila mudou. Atualize e tente novamente.');
      if (currentDoc.data()['position'] !== current.position || adjacentDoc.data()['position'] !== adjacent.position) {
        throw new Error('A ordem mudou em outra sessão. Atualize e tente novamente.');
      }
      if (current.position === adjacent.position) {
        // Legacy/concurrent ties: move the selected item past the tied position.
        transaction.update(currentRef, { position: adjacent.position + (delta < 0 ? -0.5 : 0.5) });
      } else {
        transaction.update(currentRef, { position: adjacent.position });
        transaction.update(adjacentRef, { position: current.position });
      }
    }));
  }

  async following(): Promise<Following[]> {
    const uid = this.uid();
    const items: Following[] = [];
    let cursor: Cursor = null;
    do {
      const page = await this.run(() => getDocs(query(collection(this.db, 'users', uid, 'following'),
        orderBy(documentId(), 'asc'), ...(cursor ? [startAfter(cursor)] : []), limit(100))));
      items.push(...page.docs.map((item) => ({ ...item.data(), uid: item.id } as Following)));
      cursor = page.size === 100 ? page.docs.at(-1)! : null;
    } while (cursor);
    return items;
  }

  async follow(targetUid: string): Promise<void> {
    const uid = this.uid();
    this.checkUid(targetUid);
    if (targetUid === uid) throw new Error('Você já tem seus registros no seu diário. Escolha outro perfil.');
    if (!await this.getProfile(targetUid)) throw new Error('Não encontramos um perfil com este UID.');
    const following = await this.following();
    if (following.some((item) => item.uid === targetUid)) return;
    if (following.length >= MAX_FOLLOWING) throw new Error('Você pode acompanhar até 30 perfis neste MVP.');
    await this.run(() => setDoc(doc(this.db, 'users', uid, 'following', targetUid), { uid: targetUid, createdAt: Date.now() }));
  }

  async unfollow(targetUid: string): Promise<void> {
    const uid = this.uid();
    this.checkUid(targetUid);
    await this.run(() => deleteDoc(doc(this.db, 'users', uid, 'following', targetUid)));
  }
}
