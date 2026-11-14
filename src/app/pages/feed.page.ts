import { SkeletonCard } from '../shared/skeleton-card';
import { EngagementPanel } from './engagement-panel';
import { SharedMemorySuggestions } from './shared-memory-suggestions';
import { RetentionPanels } from './retention-panels';
import { normalizeTitle } from '../core/discovery';
import { dataErrorMessage } from '../core/data-error';
import { Component, inject, signal, computed } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthService } from '../core/auth.service';
import { Cursor, DataService, MAX_FOLLOWING } from '../core/data.service';
import { CATEGORIES, Category, ConsumptionEntry, Following, UserProfile } from '../core/models';
import { EntryCard } from './entry-card';
import { ActiveJourneys } from './active-journeys';

@Component({selector: 'app-feed-page', standalone: true, imports: [FormsModule, RouterLink, EntryCard, ActiveJourneys, EngagementPanel, SkeletonCard, SharedMemorySuggestions, RetentionPanels], template: `
  <header class="page-heading"><div><span class="eyebrow">ENTRE BOAS COMPANHIAS</span><h1>Seu círculo cultural</h1><p class="subtitle">Descubra o que ficou com quem você acompanha.</p></div><a class="button primary" routerLink="/entry/new"><span aria-hidden="true">＋</span> Guardar experiência</a></header>
  <section class="panel together-prompt"><div><span class="eyebrow">UMA OBRA, VÁRIOS OLHARES</span><h2>Tem uma história que merece companhia?</h2><p class="field-help">Combine uma leitura, um jogo ou uma sessão e compartilhe o caminho com amigos.</p></div><a class="button secondary" routerLink="/together">Viver uma história juntos →</a></section>
  <app-engagement-panel />
  <app-retention-panels [entries]="entries()" [followed]="followed()" [currentUid]="auth.user()?.uid ?? ''" [currentName]="auth.profile()?.displayName ?? 'Você'" [lastActivityDate]="auth.profile()?.lastActivityDate ?? null" />
  <app-shared-memory-suggestions [friendEntries]="entries()" />
  <app-active-journeys />
  <div class="feed-layout"><section aria-label="Registros dos amigos">
    @if (error()) {<div class="error" role="alert">{{error()}}<button class="button ghost" type="button" (click)="load(true)" [disabled]="loading()">Tentar novamente</button></div>}
    @if (loading() && !entries().length) {<div role="status" aria-label="Carregando seu círculo" class="skeleton-list"><app-skeleton-card/><app-skeleton-card/><app-skeleton-card/></div>}
    @if (!loading() && !error() && !entries().length) {
      <div class="panel empty"><span class="empty-symbol" aria-hidden="true">◎</span><h2>{{followed().length ? 'Seu círculo ainda está começando.' : 'Boas histórias ficam melhores em companhia.'}}</h2><p>{{followed().length ? 'Os novos registros de quem você acompanha vão aparecer aqui.' : 'Abra o perfil de um amigo para começar a acompanhar seus registros.'}}</p>@if (!followed().length) {<button class="button secondary" type="button" (click)="focusFriend()">Encontrar um amigo</button>}</div>
    }
    <div class="category-filters" role="group" aria-label="Filtrar registros por categoria"><button class="button secondary" type="button" [attr.aria-pressed]="!activeCategory()" (click)="selectCategory('')">Todos</button>@for (item of categories; track item.value) {<button class="button secondary" type="button" [attr.aria-pressed]="activeCategory() === item.value" (click)="selectCategory(item.value)" [style.border-color]="item.color"><span aria-hidden="true">{{item.icon}}</span> {{item.label}}</button>}</div>
    <p class="notice" role="status">{{queueNotice()}}</p>
    @if (entries().length && !visibleEntries().length) {<p class="panel">Nenhum registro desta categoria entre os já carregados.</p>}
    <div class="entry-list">@for (entry of visibleEntries(); track entry.id) {<div><app-entry-card [entry]="entry" [nowWatching]="followedNow()[entry.authorId] || null"/><button class="button secondary feed-add" type="button" [disabled]="adding() !== ''" (click)="addToQueue(entry)" [attr.aria-label]="'Adicionar ' + entry.title + ' à minha fila'">{{adding() === entry.id ? 'Adicionando…' : '＋ Quero ver isso também'}}</button></div>}</div>
    @if (hasMore()) {<div class="load-more"><button class="button secondary" type="button" (click)="load()" [disabled]="loading()">{{loading() ? 'Carregando…' : 'Carregar mais'}}</button></div>}
  </section><aside class="feed-aside"><form class="panel friend-form" (ngSubmit)="findFriend()"><span class="eyebrow">HISTÓRIAS SE CONECTAM</span><h2>Encontre um amigo</h2><div class="field"><label for="friend-name">Nome do amigo</label><input id="friend-name" name="friend" [(ngModel)]="friend" (ngModelChange)="resetSearch()" placeholder="Ex.: Ana" required minlength="2" maxlength="60" autocomplete="off" aria-describedby="friend-help"><p class="field-help" id="friend-help">Digite pelo menos 2 letras do início do nome público. Use os acentos do nome.</p></div>@if (friendError()) {<p class="error" role="alert">{{friendError()}}</p>}<button class="button secondary" type="submit" [disabled]="searching()">{{searching() ? 'Buscando…' : 'Buscar amigos'}}</button>
    <div class="friend-results" aria-live="polite" aria-busy="{{searching()}}">
      @if (searched()) {<p class="field-help">{{friends().length ? 'Escolha um perfil para conhecer e acompanhar.' : 'Nenhum perfil encontrado. Confira o nome ou tente outro início.'}}</p>}
      <ul class="friend-list">@for (person of friends(); track person.uid) {<li><a [routerLink]="['/u', person.uid]"><span class="avatar avatar-small" aria-hidden="true">{{person.displayName.slice(0, 1).toUpperCase()}}</span><span><strong>{{person.displayName}}</strong>@if (person.bio) {<span class="friend-bio">{{person.bio}}</span>}<span class="friend-profile-link">Ver perfil →</span></span></a></li>}</ul>
      @if (moreFriends()) {<button class="button ghost" type="button" [disabled]="searching()" (click)="findFriend(true)">{{searching() ? 'Buscando…' : 'Mais pessoas'}}</button>}
    </div><p class="field-help">Você pode acompanhar até {{maxFollowing}} perfis.</p></form><div class="panel queue-prompt"><span class="eyebrow">E A PRÓXIMA HISTÓRIA?</span><h2>Tem algo na sua lista?</h2><p>Deixe sua próxima experiência esperando por você.</p><a class="button ghost" routerLink="/queue">Organizar minha fila <span aria-hidden="true">→</span></a></div>
  @if (followed().length) {<section class="panel"><h2>Acompanhando</h2><p class="field-help">{{followed().length}} de {{maxFollowing}} perfis</p><ul class="following-list">@for (item of followed(); track item.uid) {<li><a [routerLink]="['/u', item.uid]">{{followedNames()[item.uid] || 'Perfil indisponível'}}</a></li>}</ul></section>}
  </aside></div>
`})
export class FeedPage {
  categories = CATEGORIES;
  activeCategory = signal<Category | ''>(this.savedCategory());
  visibleEntries = computed(() => this.entries().filter(entry => !this.activeCategory() || entry.category === this.activeCategory()));
  queueNotice = signal(''); adding = signal('');
  private savedCategory(): Category | '' {try {const value = sessionStorage.getItem('viveu-feed-category'); return CATEGORIES.find(item => item.value === value)?.value ?? '';} catch {return '';}}
  selectCategory(value: Category | '') {this.activeCategory.set(value); try {sessionStorage.setItem('viveu-feed-category', value);} catch { /* Session remains available in memory. */ }}
  async addToQueue(entry: ConsumptionEntry) {
    if (this.adding()) return;
    this.adding.set(entry.id); this.queueNotice.set('');
    try {
      await this.auth.ready;
      const [queue, own] = await Promise.all([this.data.queue(), this.data.allEntries()]);
      const same = (item: {title: string; category: Category}) => item.category === entry.category && normalizeTitle(item.title) === normalizeTitle(entry.title);
      if (queue.some(same)) {this.queueNotice.set('Essa obra já está na sua fila'); return;}
      if (own.some(same)) {this.queueNotice.set('Você já registrou essa obra'); return;}
      await this.data.addQueue(entry.title, entry.category);
      this.queueNotice.set('Adicionado à sua fila!');
    } catch (error) {this.queueNotice.set(dataErrorMessage(error, 'Não foi possível adicionar à fila. Tente novamente.'));}
    finally {this.adding.set('');}
  }
  auth = inject(AuthService); private data = inject(DataService);
  entries = signal<ConsumptionEntry[]>([]); followed = signal<Following[]>([]); loading = signal(false); error = signal(''); friendError = signal(''); hasMore = signal(false);
  maxFollowing = MAX_FOLLOWING; friend = ''; private cursor: Cursor = null;
  constructor() {void this.load(true);}
  friends = signal<UserProfile[]>([]); searching = signal(false); searched = signal(false); moreFriends = signal(false);
  followedNames = signal<Record<string, string>>({});
  followedNow = signal<Record<string, import('../core/models').NowWatching>>({});
  private friendCursor: Cursor = null; private searchRevision = 0; private searchedName = '';
  focusFriend() {document.getElementById('friend-name')?.focus();}
  resetSearch() {
    ++this.searchRevision; this.searching.set(false); this.searched.set(false); this.friendError.set('');
    this.friends.set([]); this.moreFriends.set(false); this.friendCursor = null;
  }
  async findFriend(more = false) {
    if (this.searching()) return;
    if (!more) this.resetSearch();
    const name = more ? this.searchedName : this.friend.trim().replace(/\s+/g, ' ');
    if (name.length < 2 || name.length > 60) {this.friendError.set('Digite entre 2 e 60 caracteres do nome.'); return;}
    const revision = this.searchRevision;
    this.searchedName = name; this.searching.set(true); this.friendError.set('');
    try {
      await this.auth.ready;
      const page = await this.data.searchProfiles(name, more ? this.friendCursor : null);
      if (revision !== this.searchRevision) return;
      this.friends.update(items => more ? [...items, ...page.items.filter(person => !items.some(item => item.uid === person.uid))] : page.items);
      this.friendCursor = page.cursor; this.moreFriends.set(page.hasMore); this.searched.set(true);
    } catch (error) {
      if (revision === this.searchRevision) this.friendError.set(dataErrorMessage(error, 'Não foi possível buscar amigos. Tente novamente.'));
    } finally {if (revision === this.searchRevision) this.searching.set(false);}
  }
  private async loadFollowedNames() {
    const names: Record<string, string> = {};
    const now: Record<string, import('../core/models').NowWatching> = {};
    const results = await Promise.allSettled(this.followed().map(async item => {
      const profile = await this.data.getProfile(item.uid);
      return {uid: item.uid, name: profile?.displayName || 'Perfil indisponível', now:profile?.nowWatching};
    }));
    for (const result of results) if (result.status === 'fulfilled') {names[result.value.uid] = result.value.name;if(result.value.now&&result.value.now.expiresAt>Date.now())now[result.value.uid]=result.value.now;}
    this.followedNames.set(names);
    this.followedNow.set(now);
  }
  async load(reset = false) {
    if (this.loading()) return; this.loading.set(true); this.error.set('');
    try {await this.auth.ready; if (reset) {this.followed.set(await this.data.following()); await this.loadFollowedNames();}
      const page = await this.data.feedPage(this.followed().map(item => item.uid), reset ? null : this.cursor);
      this.cursor = page.cursor; this.entries.update(items => reset ? page.items : [...items, ...page.items.filter(item => !items.some(existing => existing.id === item.id))]); this.hasMore.set(page.hasMore);
    } catch (error) {this.error.set(dataErrorMessage(error, 'Não foi possível carregar o feed. Tente novamente.'));} finally {this.loading.set(false);}
  }
}
