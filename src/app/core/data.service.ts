import { EnvironmentInjector, Injectable, inject, runInInjectionContext } from '@angular/core';
import { DocumentData, Firestore, QueryDocumentSnapshot, and, collection, deleteDoc, doc, documentId, getDoc, getDocs, limit, or, orderBy, query, runTransaction, setDoc, startAfter, where } from '@angular/fire/firestore';
import { activityDates, badgesFor, calculateStreak, EngagementState, historyRanges, localDay } from './engagement';
import { AuthService, validUid } from './auth.service';
import { CATEGORIES, Category, ConsumptionEntry, EntryInput, FEELINGS, Following, JOURNEY_NOTE_MAX_LENGTH, JOURNEY_REASON_MAX_LENGTH, JOURNEY_STATUSES, MAX_FEELINGS, MAX_JOURNEY_NOTES, PAGE_SIZE, QueueItem, REFLECTION_MAX_LENGTH, RESUME_POINT_MAX_LENGTH, SharedMemory, SharedMemoryMessage, UserProfile } from './models';

export type Cursor = QueryDocumentSnapshot<DocumentData> | null;
export interface EntryPage { items: ConsumptionEntry[]; cursor: Cursor; hasMore: boolean; }
export interface ProfileSearchPage { items: UserProfile[]; cursor: Cursor; hasMore: boolean; }
export const MAX_FOLLOWING = 30;

@Injectable({ providedIn: 'root' })
export class DataService {
  private pendingBadges = new Map<string, string[]>();
  engagementWarning = '';
  private readonly db = inject(Firestore);
  private readonly auth = inject(AuthService);
  private readonly injector = inject(EnvironmentInjector);
  private run<T>(work: () => T): T { return runInInjectionContext(this.injector, work); }
  private uid(): string { return this.auth.requireUser().uid; }
  private checkUid(uid: string): void { if (!validUid(uid)) throw new Error('Informe um UID de perfil válido.'); }

  async createSharedMemory(input: {participantUid: string; workTitle: string; workCategory: Category}): Promise<string> {
    const uid=this.uid(), title=input.workTitle.trim(); this.checkUid(input.participantUid);
    if(input.participantUid===uid||!title||title.length>160||!CATEGORIES.some(c=>c.value===input.workCategory)) throw new Error('Confira a pessoa e a obra para compartilhar.');
    const ref=this.run(()=>doc(collection(this.db,'sharedMemories'))), now=Date.now();
    await this.run(()=>setDoc(ref,{participants:[uid,input.participantUid],workTitle:title,workCategory:input.workCategory,messageCount:0,createdAt:now,updatedAt:now}));
    return ref.id;
  }

  async sharedMemory(id: string): Promise<SharedMemory|null> {
    this.checkUid(id); const snapshot=await this.run(()=>getDoc(doc(this.db,'sharedMemories',id)));
    if(!snapshot.exists()) return null;
    const memory={...snapshot.data(),id:snapshot.id} as SharedMemory;
    if(!memory.participants.includes(this.uid())) throw new Error('Você não participa desta memória.');
    return memory;
  }

  async sharedMemoryMessages(id: string): Promise<SharedMemoryMessage[]> {
    this.checkUid(id); const memory=await this.sharedMemory(id); if(!memory) return [];
    const snapshot=await this.run(()=>getDocs(query(collection(this.db,'sharedMemories',id,'messages'),orderBy('createdAt','asc'),limit(100))));
    return snapshot.docs.map(item=>({...item.data(),id:item.id} as SharedMemoryMessage));
  }

  async sendSharedMemoryMessage(id: string, input: {text: string; hasSpoiler: boolean}): Promise<void> {
    this.checkUid(id); const uid=this.uid(), text=input.text.trim();
    if(!text||text.length>500||typeof input.hasSpoiler!=='boolean') throw new Error('A mensagem deve ter de 1 a 500 caracteres.');
    const parent=this.run(()=>doc(this.db,'sharedMemories',id)), message=this.run(()=>doc(collection(this.db,'sharedMemories',id,'messages'))), now=Date.now();
    await this.run(()=>runTransaction(this.db,async tx=>{const snapshot=await tx.get(parent);if(!snapshot.exists()||!(snapshot.data()['participants'] as string[]).includes(uid))throw new Error('Você não participa desta memória.');const count=snapshot.data()['messageCount'];if(!Number.isInteger(count)||count<0||count>=100)throw new Error('Esta memória já chegou a 100 mensagens.');tx.update(parent,{messageCount:count+1,updatedAt:now});tx.set(message,{uid,text,hasSpoiler:input.hasSpoiler,createdAt:now});}));
  }

  async completeOnboarding(favoriteCategories: Category[]): Promise<void> {
    const uid=this.uid(), favorites=[...new Set(favoriteCategories)];
    if(favorites.length!==3 || favorites.some(category=>!CATEGORIES.some(item=>item.value===category))) throw new Error('Escolha três categorias favoritas.');
    const patch = {favoriteCategories:favorites,onboardingCompleted:true,updatedAt:Date.now()};
    await this.run(()=>setDoc(doc(this.db,'users',uid),patch,{merge:true}));
    // Publish the confirmed write before the caller advances or the guard reads the profile.
    if (this.auth.user()?.uid === uid) {
      this.auth.profile.update(profile => profile?.uid === uid ? {...profile, ...patch} : profile);
    }
  }
  async lists(ownerUid=this.uid()): Promise<import('./models').ThematicList[]> {
    this.checkUid(ownerUid);
    const snapshot=await this.run(()=>getDocs(query(collection(this.db,'lists'),where('ownerUid','==',ownerUid),orderBy('updatedAt','desc'),limit(10))));
    return snapshot.docs.map(d=>({...d.data(),id:d.id} as import('./models').ThematicList));
  }
  async getList(id:string):Promise<import('./models').ThematicList|null>{this.checkUid(id);const s=await this.run(()=>getDoc(doc(this.db,'lists',id)));if(!s.exists())return null;const data=s.data();if(data['isPublic']!==true&&data['ownerUid']!==this.uid())return null;return {...data,id:s.id} as import('./models').ThematicList;}
  async getEntryReactions(entryId:string):Promise<import('./models').EntryReaction[]>{this.checkUid(entryId);const docs=await this.run(()=>getDocs(collection(this.db,'entries',entryId,'reactions')));return docs.docs.map(d=>({...d.data(),uid:d.id} as import('./models').EntryReaction));}
  async saveList(input: Omit<import('./models').ThematicList,'id'|'ownerUid'|'items'|'createdAt'|'updatedAt'>, id?:string): Promise<string> {
    const uid=this.uid(), title=input.title.trim(), description=input.description.trim();
    if(!title||title.length>80||description.length>280||!['mixed',...CATEGORIES.map(c=>c.value)].includes(input.category)) throw new Error('Confira o título, descrição e categoria da lista.');
    const reference=this.run(()=>id?doc(this.db,'lists',id):doc(collection(this.db,'lists'))), now=Date.now();
    if(!id && (await this.lists()).length>=10) throw new Error('Você pode criar até 10 listas.');
    await this.run(()=>runTransaction(this.db,async tx=>{const old=await tx.get(reference); if(old.exists()&&old.data()['ownerUid']!==uid) throw new Error('Você só pode editar suas listas.'); tx.set(reference,{...input,title,description,ownerUid:uid,items:old.exists()?old.data()['items']:[],createdAt:old.exists()?old.data()['createdAt']:now,updatedAt:now});})); return reference.id;
  }
  async addListItem(id:string,titleInput:string,noteInput=''):Promise<void>{
    const uid=this.uid(),title=titleInput.trim(),note=noteInput.trim(); if(!title||title.length>160||note.length>280) throw new Error('Confira o título e a nota.');
    const ref=this.run(()=>doc(this.db,'lists',id)); await this.run(()=>runTransaction(this.db,async tx=>{const s=await tx.get(ref);if(!s.exists()||s.data()['ownerUid']!==uid)throw new Error('Lista não encontrada.');const items=s.data()['items'] as import('./models').ThematicListItem[];if(items.length>=50)throw new Error('Cada lista aceita até 50 obras.');tx.update(ref,{items:[...items,{title,...(note?{note}:{})}],updatedAt:Date.now()});}));
  }
  async toggleReaction(entryId:string,emoji:import('./models').EntryReaction['emoji']):Promise<void>{
    const uid=this.uid(), entryRef=this.run(()=>doc(this.db,'entries',entryId)), ref=this.run(()=>doc(this.db,'entries',entryId,'reactions',uid));
    await this.run(()=>runTransaction(this.db,async tx=>{const [entry,reaction]=await Promise.all([tx.get(entryRef),tx.get(ref)]);if(!entry.exists()||entry.data()['authorId']===uid)throw new Error('Você não pode reagir ao próprio registro.');if(reaction.exists()&&reaction.data()['emoji']===emoji)tx.delete(ref);else tx.set(ref,{uid,emoji,reactedAt:Date.now()});}));
  }
  async setNowWatching(value:import('./models').NowWatching|null):Promise<void>{const uid=this.uid();if(value&&(!value.title.trim()||value.title.length>160||!CATEGORIES.some(c=>c.value===value.category)))throw new Error('Confira o título e a categoria.');await this.run(()=>setDoc(doc(this.db,'users',uid),{nowWatching:value?{...value,title:value.title.trim(),since:Date.now(),expiresAt:Date.now()+7*86400000}:null,updatedAt:Date.now()},{merge:true}));}
  async setNotificationPreferences(value:NonNullable<UserProfile['notificationPreferences']>):Promise<void>{const uid=this.uid();await this.run(()=>setDoc(doc(this.db,'users',uid,'private','notifications'),value));}
  async getNotificationPreferences():Promise<NonNullable<UserProfile['notificationPreferences']>>{const uid=this.uid();const snapshot=await this.run(()=>getDoc(doc(this.db,'users',uid,'private','notifications')));return snapshot.exists()?snapshot.data() as NonNullable<UserProfile['notificationPreferences']>:{enabled:false,matchInQueue:false,reactions:false,streakReminder:false};}

  async getProfile(uid: string): Promise<UserProfile | null> {
    this.checkUid(uid);
    const snapshot = await this.run(() => getDoc(doc(this.db, 'users', uid)));
    return snapshot.exists() ? snapshot.data() as UserProfile : null;
  }

  /** Complete history is required for lifetime achievements; page through the existing index. */
  async allEntries(uid = this.uid()): Promise<ConsumptionEntry[]> {
    const entries: ConsumptionEntry[] = []; let cursor: Cursor = null;
    do {const page = await this.entriesPage(uid, cursor); entries.push(...page.items); cursor = page.hasMore ? page.cursor : null;} while (cursor);
    return entries;
  }

  async entriesBetween(uid: string, start: number, end: number): Promise<ConsumptionEntry[]> {
    this.checkUid(uid);
    if (!Number.isFinite(start) || !Number.isFinite(end) || start >= end) throw new Error('Confira o período.');
    const items: ConsumptionEntry[] = []; let cursor: Cursor = null;
    do {
      const page = await this.run(() => getDocs(query(collection(this.db, 'entries'), where('authorId', '==', uid),
        where('createdAt', '>=', start), where('createdAt', '<', end), orderBy('createdAt', 'desc'), orderBy(documentId(), 'desc'),
        ...(cursor ? [startAfter(cursor)] : []), limit(100))));
      items.push(...page.docs.map(d => ({...d.data(), id: d.id} as ConsumptionEntry)));
      cursor = page.size === 100 ? page.docs.at(-1)! : null;
    } while (cursor);
    return items;
  }

  async historyEntries(now = new Date()): Promise<ConsumptionEntry[]> {
    const uid = this.uid();
    const results = await Promise.all(historyRanges(now).map(r => this.entriesBetween(uid, r.start, r.end)));
    return [...new Map(results.flat().map(e => [e.id, e])).values()].sort((a, b) => b.createdAt - a.createdAt);
  }

  /** A visitor can only create their own immutable receipt; never edit another user's profile. */
  async recordProfileVisit(targetUid: string): Promise<void> {
    const visitor = this.uid(); this.checkUid(targetUid); if (targetUid === visitor) return;
    const reference = this.run(() => doc(this.db, 'users', targetUid, 'visits', visitor));
    await this.run(() => runTransaction(this.db, async tx => {
      const existing = await tx.get(reference);
      if (!existing.exists()) tx.set(reference, {visitorId: visitor, createdAt: Date.now()});
    }));
  }

  private async recordActivity(now: number): Promise<void> {
    const uid = this.uid(), day = localDay(now);
    await this.run(() => setDoc(doc(this.db, 'users', uid, 'activityDays', day), {date: day, createdAt: now}));
  }

  async unlockTogetherBadge(): Promise<void> {
    const uid = this.uid();
    const reference = this.run(() => doc(this.db, 'users', uid));
    await this.run(() => runTransaction(this.db, async tx => {
      const snapshot = await tx.get(reference); if (!snapshot.exists()) return;
      const badges = snapshot.data()['badges'] ?? [];
      if (!badges.includes('first-together')) {tx.update(reference, {badges: [...badges, 'first-together']}); this.pendingBadges.set(uid, [...(this.pendingBadges.get(uid) ?? []), 'first-together']);}
    }));
    await this.recordActivity(Date.now());
  }

  acknowledgeBadges(): void {this.pendingBadges.delete(this.uid());}

  private async refreshEngagement(): Promise<void> {
    const uid = this.uid();
    try {
      const [entries, queue] = await Promise.all([this.allEntries(uid), this.queue()]);
      if (this.uid() !== uid) return;
      const state = await this.syncEngagement(entries, queue);
      this.pendingBadges.set(uid, state.newBadges);
      this.engagementWarning = '';
    } catch {this.engagementWarning = 'Sua experiência foi salva. As conquistas serão atualizadas quando você voltar ao feed.';}
  }

  async activityTimestamps(): Promise<number[]> {
    const uid = this.uid();
    const days = await this.run(() => getDocs(query(collection(this.db, 'users', uid, 'activityDays'))));
    return days.docs.map(d => d.data()['createdAt'] as number).filter(Number.isFinite);
  }

  async syncEngagement(entries: ConsumptionEntry[], queue: QueueItem[]): Promise<EngagementState> {
    const uid = this.uid();
    const [ledger, visits] = await Promise.all([
      this.run(() => getDocs(query(collection(this.db, 'users', uid, 'activityDays')))),
      this.run(() => getDocs(query(collection(this.db, 'users', uid, 'visits'), limit(1)))),
    ]);
    if (this.uid() !== uid) throw new Error('A conta mudou. Recarregue seu feed.');
    const dates = [...activityDates(entries.filter(entry => !entry.authorId || entry.authorId === uid), queue), ...ledger.docs.map(d => d.data()['createdAt'] as number)];
    const streakCount = calculateStreak(dates);
    const last = dates.filter(Number.isFinite).sort((a, b) => b - a)[0];
    const lastActivityDate = last ? localDay(last) : '';
    const unlocked = badgesFor(entries.filter(entry => !entry.authorId || entry.authorId === uid), queue, !visits.empty);
    const reference = this.run(() => doc(this.db, 'users', uid));
    return this.run(() => runTransaction(this.db, async tx => {
      const snapshot = await tx.get(reference); if (!snapshot.exists()) throw new Error('Conclua seu perfil.');
      const profile = snapshot.data();
      const previous = Array.isArray(profile['badges']) ? profile['badges'] as string[] : [];
      const badges = [...new Set([...previous, ...unlocked])];
      const broken = (profile['streakCount'] ?? 0) > 0 && streakCount === 0;
      const state = {streakCount, lastActivityDate, badges, newBadges: [...new Set([...(this.pendingBadges.get(uid) ?? []), ...badges.filter(id => !previous.includes(id))])], broken};
      tx.update(reference, {streakCount, lastActivityDate, badges});
      return state;
    }));
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
    let qualifiesActivity = false;
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
      qualifiesActivity = details.status === 'completed' || details.notes.some(note => !(previous['notes'] ?? []).some((old: {id: string; text: string}) => old.id === note.id && old.text === note.text));
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
      const active = profile.nowWatching;
      if (details.status === 'completed' && active && active.category === input.category
        && active.title.trim().normalize('NFKC').toLocaleLowerCase('pt-BR') === title.normalize('NFKC').toLocaleLowerCase('pt-BR')) {
        transaction.update(this.run(() => doc(this.db, 'users', uid)), {nowWatching: null, updatedAt: now});
      }
    }));
    if (qualifiesActivity) await this.recordActivity(now).catch(() => {this.engagementWarning = 'Não foi possível atualizar sua sequência. Tente novamente ao voltar ao feed.';});
    await this.refreshEngagement();
    if(typeof window!=='undefined') window.dispatchEvent(new Event('viveu-entry-saved'));
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
    const now = Date.now();
    await this.run(() => setDoc(reference, { title, category, reason, position: (items.at(-1)?.position ?? 0) + 1, createdAt: now }));
    await this.recordActivity(now).catch(() => {this.engagementWarning = 'Não foi possível atualizar sua sequência. Tente novamente ao voltar ao feed.';});
    await this.refreshEngagement();
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
