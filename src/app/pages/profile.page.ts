import { SkeletonCard } from '../shared/skeleton-card';
import { culturalCompatibility, tasteProfile } from '../core/discovery';
import { BADGES } from '../core/engagement';
import { dataErrorMessage } from '../core/data-error';
import { DatePipe } from '@angular/common';
import { Component, DestroyRef, inject, signal, computed } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { AuthService } from '../core/auth.service';
import { Cursor, DataService, MAX_FOLLOWING } from '../core/data.service';
import { categoryConfig, ConsumptionEntry, UserProfile } from '../core/models';
import { EntryCard } from './entry-card';
import { AccountExtras } from './account-extras';

@Component({selector: 'app-profile-page', standalone: true, imports: [FormsModule, RouterLink, EntryCard, DatePipe, SkeletonCard, AccountExtras], template: `
  @if (loading() && !profile()) {<div role="status" aria-label="Carregando perfil" class="skeleton-list"><app-skeleton-card/><app-skeleton-card/><app-skeleton-card/></div>}
  @if (error()) {<div class="error" role="alert">{{error()}} @if (loadFailed()) {<button class="button ghost" type="button" (click)="load(uid)">Tentar novamente</button>}</div>}
  @if (!loading() && !profile() && !loadFailed()) {<section class="panel empty"><h1>Não encontramos este perfil.</h1><p>Confira o link e tente novamente.</p><a class="button secondary" routerLink="/feed">Voltar ao feed</a></section>}
  @if (profile(); as person) {
    <section class="profile-hero panel"><div class="profile-topline"><span class="eyebrow">UM ACERVO DE HISTÓRIAS</span><button class="button secondary" type="button" (click)="share()">Compartilhar perfil <span aria-hidden="true">↗</span></button></div><div class="profile-identity"><span class="avatar avatar-large" aria-hidden="true">@if (person.photoURL && !photoFailed()) {<img [src]="person.photoURL" alt="" referrerpolicy="no-referrer" (error)="photoFailed.set(true)">} @else {{{person.displayName.slice(0, 1).toUpperCase()}}}</span><div><h1>{{person.displayName}}</h1>@if (person.bio) {<p class="profile-bio">{{person.bio}}</p>}</div></div><blockquote class="identity-quote">@if (taste().quote; as quotation) {<p>“{{quotation.quote}}”</p><footer>{{config(quotation.category).icon}} {{quotation.title}} · {{config(quotation.category).singular}}</footer>} @else {<p>Nenhuma frase registrada ainda</p>}</blockquote><div class="profile-actions button-row">
      @if (auth.user()?.uid === person.uid) {<button class="button secondary" type="button" (click)="startEdit()">Editar perfil</button><a class="button secondary" [routerLink]="wrappedLink">Meu mês no Viveu</a>}
      @else if (auth.user()) {<button class="button" [class.primary]="!following()" [class.secondary]="following()" type="button" [disabled]="busy() || followingLoading()" (click)="toggleFollow()">{{busy() ? 'Atualizando…' : following() ? 'Deixar de seguir' : 'Seguir'}}</button>}
      @else {<a class="button primary" routerLink="/login" [queryParams]="{returnUrl: '/u/' + person.uid}">Entrar para acompanhar</a>}
    </div></section>
    <p class="notice" role="status">{{notice()}}</p>
    @if (shareFallback()) {<div class="panel field"><label for="profile-url">Copie o link abaixo para compartilhar seu perfil.</label><input id="profile-url" [value]="profileUrl()" readonly (focus)="selectLink($event)"></div>}
    @if (editing()) {<form class="panel profile-edit" (ngSubmit)="saveProfile()"><h2>Editar perfil</h2><div class="field"><label for="profile-name">Nome público</label><input id="profile-name" name="displayName" [(ngModel)]="displayName" required minlength="2" maxlength="60" [disabled]="busy()"></div><div class="field"><label for="profile-bio">Bio (opcional)</label><textarea id="profile-bio" name="bio" [(ngModel)]="bio" maxlength="240" rows="3" [disabled]="busy()" aria-describedby="bio-count"></textarea><span id="bio-count" class="field-help">{{bio.length}} / 240</span></div><div class="button-row"><button class="button primary" type="submit" [disabled]="busy()">{{busy() ? 'Salvando…' : 'Salvar alterações'}}</button><button class="button secondary" type="button" (click)="editing.set(false)" [disabled]="busy()">Cancelar</button></div></form>}
    <section class="panel taste-summary" aria-label="Perfil de gosto"><h2>Seu universo cultural</h2><p>{{taste().total}} obras registradas · {{taste().completed}} concluídas @if (hasMore()) {<span class="field-help">· Entre os registros carregados</span>}</p><p>Nota média: {{taste().average === null ? 'Ainda sem notas' : taste().average?.toFixed(1) + ' / 5'}}</p><div class="button-row">@for (favorite of taste().favorites; track favorite.category) {<span class="category-pill" [style.background]="config(favorite.category).bgColor" [style.color]="config(favorite.category).textColor">{{config(favorite.category).icon}} {{config(favorite.category).label}} · {{favorite.count}}</span>}</div>@if (taste().best; as best) {<p>Obra mais marcante: <strong>{{best.title}}</strong> · {{best.rating}} / 5</p>}</section>
    @if (auth.user() && auth.user()?.uid !== person.uid) {<section class="panel compatibility-card" aria-label="Compatibilidade cultural"><h2>Gosto em comum</h2>@if (compatibilityLoading()) {<p role="status">Comparando seus universos culturais…</p>} @else if (compatibilityError()) {<p class="error" role="alert">{{compatibilityError()}} <button class="button ghost" type="button" (click)="loadCompatibility(person.uid)">Tentar novamente</button></p>} @else if (ownEntriesLoaded() && compatibility().comparableParts) {<p class="compatibility-score">{{compatibility().score}}%</p><p>Você e {{person.displayName}} têm {{compatibility().score}}% de gosto parecido.</p><p class="field-help">{{compatibility().sharedWorks}} obras em comum · {{compatibility().sharedCategories}} categorias compartilhadas</p>@if (hasMore()) {<p class="field-help">O cálculo usa os registros deste perfil carregados até agora.</p>}} @else if (ownEntriesLoaded()) {<p>Adicione mais registros para descobrir o que vocês têm em comum.</p>}</section>}
    <section class="panel" aria-label="Conquistas"><h2>Conquistas</h2><div class="badge-grid">@for (badge of badgeDefinitions; track badge.id) {@if (person.badges?.includes(badge.id)) {<div class="badge-item"><span aria-hidden="true">{{badge.icon}}</span><strong>{{badge.name}}</strong><p>{{badge.description}}</p></div>}}</div>@if (!person.badges?.length) {<p>As próximas histórias vão trazer novas conquistas.</p>}</section>
    @if (auth.user()?.uid === person.uid) {<div class="button-row"><a class="button secondary" routerLink="/lists">Minhas listas</a></div>}<app-account-extras [uid]="person.uid"/>
    <div class="section-heading"><h2>Diário cultural</h2><span class="eyebrow">UMA HISTÓRIA DE CADA VEZ</span></div>
    <div class="profile-view-toggle" role="group" aria-label="Visualização do diário"><button class="button secondary" type="button" [attr.aria-pressed]="viewMode() === 'list'" (click)="viewMode.set('list')">Lista</button><button class="button secondary" type="button" [attr.aria-pressed]="viewMode() === 'timeline'" (click)="viewMode.set('timeline')">Linha do tempo</button></div>
    @if (!loading() && !entries().length && !entriesError()) {<section class="panel empty"><span class="empty-symbol" aria-hidden="true">▤</span><h2>Esta história ainda está começando.</h2><p>Os registros deste perfil vão aparecer aqui.</p>@if (auth.user()?.uid === person.uid) {<a class="button primary" routerLink="/entry/new">Guardar experiência</a>}</section>}
    @if (entriesError()) {<p class="error" role="alert">{{entriesError()}} <button class="button ghost" type="button" (click)="more(true)" [disabled]="loadingMore()">Tentar novamente</button></p>}
    @if (viewMode() === 'list') {<div class="entry-list">@for (entry of entries(); track entry.id) {<app-entry-card [entry]="entry"/>}</div>}
    @else {<ol class="profile-timeline">@for (group of timelineGroups(); track group.key) {<li class="timeline-month"><h3>{{group.label}}</h3><ol>@for (entry of group.entries; track entry.id) {<li class="timeline-entry"><time>{{(entry.completedAt ?? entry.updatedAt) | date:'dd/MM/yyyy'}}</time><span class="timeline-category" [style.background]="config(entry.category).bgColor">{{config(entry.category).icon}}</span><div><h4>{{entry.title}}</h4>@if(entry.rating){<p>{{entry.rating}} / 5</p>}@if(entry.quote && !entry.containsSpoilers){<blockquote>“{{entry.quote}}”</blockquote>}</div></li>}</ol></li>}</ol>}
    @if (hasMore()) {<div class="load-more"><button class="button secondary" type="button" [disabled]="loadingMore()" (click)="more()">{{loadingMore() ? 'Carregando…' : 'Carregar mais'}}</button></div>}
  }
`})
export class ProfilePage {
  auth = inject(AuthService); private data = inject(DataService); private route = inject(ActivatedRoute);
  profile = signal<UserProfile | null>(null); entries = signal<ConsumptionEntry[]>([]); ownEntries = signal<ConsumptionEntry[]>([]); ownEntriesLoaded = signal(false); compatibilityLoading = signal(false); compatibilityError = signal(''); loading = signal(false); loadingMore = signal(false); error = signal(''); notice = signal(''); loadFailed = signal(false); entriesError = signal(''); hasMore = signal(false); following = signal(false); followingLoading = signal(true); editing = signal(false); busy = signal(false); shareFallback = signal(false); photoFailed = signal(false);
  private readonly previousMonth = new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1);
  readonly wrappedLink = ['/wrapped', this.previousMonth.getFullYear(), this.previousMonth.getMonth() + 1];
  config = categoryConfig; badgeDefinitions = BADGES; taste = computed(() => tasteProfile(this.entries()));
  compatibility = computed(() => culturalCompatibility(this.ownEntries(), this.entries()));
  viewMode = signal<'list'|'timeline'>('list');
  timelineGroups = computed(() => {
    const groups = new Map<string, {key:string;label:string;entries:ConsumptionEntry[]}>();
    for(const entry of this.entries()) {const date=new Date(entry.completedAt ?? entry.updatedAt);const key=`${date.getFullYear()}-${date.getMonth()}`;let group=groups.get(key);if(!group){group={key,label:date.toLocaleDateString('pt-BR',{month:'long',year:'numeric'}),entries:[]};groups.set(key,group);}group.entries.push(entry);}
    return [...groups.values()];
  });
  uid = ''; displayName = ''; bio = ''; private cursor: Cursor = null; private revision = 0;
  constructor() {this.route.paramMap.pipe(takeUntilDestroyed(inject(DestroyRef))).subscribe(params => {void this.load(params.get('uid') || '');});}
  profileUrl() {return `${window.location.origin}/u/${encodeURIComponent(this.uid)}`;}
  async load(uid: string) {
    const revision = ++this.revision; this.uid = uid; this.loading.set(true); this.error.set(''); this.loadFailed.set(false); this.profile.set(null); this.entries.set([]); this.ownEntries.set([]); this.ownEntriesLoaded.set(false); this.compatibilityError.set(''); this.compatibilityLoading.set(false); this.hasMore.set(false); this.cursor = null; this.following.set(false); this.followingLoading.set(true); this.editing.set(false); this.notice.set(''); this.shareFallback.set(false); this.photoFailed.set(false); this.entriesError.set('');
    try {
      const person = await this.data.getProfile(uid); if (revision !== this.revision) return; this.profile.set(person);
      if (person) {
        try {const page = await this.data.entriesPage(uid); if (revision !== this.revision) return; this.entries.set(page.items); this.cursor = page.cursor; this.hasMore.set(page.hasMore);} catch (error) {if (revision === this.revision) this.entriesError.set(dataErrorMessage(error, 'Não foi possível carregar os registros.'));}
        await this.auth.ready;
        if (revision !== this.revision) return;
        if (this.auth.user() && this.auth.user()?.uid !== uid) {
          void this.loadCompatibility(uid, revision);
          void this.data.recordProfileVisit(uid).catch(() => { /* Reading the public profile remains available. */ });
          try {const following = await this.data.following(); if (revision === this.revision) this.following.set(following.some(item => item.uid === uid));} catch (error) {if (revision === this.revision) this.error.set(dataErrorMessage(error, 'Não foi possível verificar quem você acompanha. Recarregue o perfil para tentar novamente.'));}
        }
      }
    } catch (error) {if (revision === this.revision) {this.error.set(dataErrorMessage(error, 'Não foi possível carregar este perfil.')); this.loadFailed.set(true);}}
    finally {if (revision === this.revision) {this.loading.set(false); this.followingLoading.set(false);}}
  }
  async loadCompatibility(targetUid = this.uid, revision = this.revision) {
    const viewerUid = this.auth.user()?.uid;
    if (!viewerUid || viewerUid === targetUid) return;
    this.compatibilityLoading.set(true); this.compatibilityError.set(''); this.ownEntriesLoaded.set(false);
    try {
      const loaded = await this.data.allEntries(viewerUid);
      if (revision !== this.revision || this.uid !== targetUid || this.auth.user()?.uid !== viewerUid) return;
      this.ownEntries.set(loaded); this.ownEntriesLoaded.set(true);
    } catch (error) {
      if (revision === this.revision) this.compatibilityError.set(dataErrorMessage(error, 'Não foi possível comparar os perfis agora.'));
    } finally {
      if (revision === this.revision) this.compatibilityLoading.set(false);
    }
  }
  async more(reset = false) {
    if (this.loadingMore()) return; const revision = this.revision; this.loadingMore.set(true); this.entriesError.set('');
    try {const page = await this.data.entriesPage(this.uid, reset ? null : this.cursor); if (revision !== this.revision) return; this.entries.update(items => reset ? page.items : [...items, ...page.items.filter(item => !items.some(existing => existing.id === item.id))]); this.cursor = page.cursor; this.hasMore.set(page.hasMore);} catch (error) {if (revision === this.revision) this.entriesError.set(dataErrorMessage(error, 'Não foi possível carregar os registros.'));} finally {this.loadingMore.set(false);}
  }
  startEdit() {const person = this.profile(); if (!person || this.auth.user()?.uid !== person.uid) return; this.displayName = person.displayName; this.bio = person.bio; this.editing.set(true); this.error.set(''); setTimeout(() => document.getElementById('profile-name')?.focus());}
  async saveProfile() {
    if (this.busy()) return; this.error.set('');
    if (this.displayName.trim().length < 2 || this.displayName.trim().length > 60) {this.error.set('Use entre 2 e 60 caracteres no nome.'); document.getElementById('profile-name')?.focus(); return;}
    if (this.bio.length > 240) {this.error.set('Use até 240 caracteres na bio.'); document.getElementById('profile-bio')?.focus(); return;}
    const revision = this.revision;
    this.busy.set(true); try {await this.auth.updateProfile({displayName: this.displayName.trim(), bio: this.bio.trim()}); if (revision !== this.revision) return; this.profile.set(this.auth.profile()); this.editing.set(false); this.notice.set('Perfil atualizado.');} catch (error) {if (revision === this.revision) this.error.set(dataErrorMessage(error, 'Não foi possível salvar seu perfil. Tente novamente.'));} finally {this.busy.set(false);}
  }
  async toggleFollow() {
    if (this.busy() || this.followingLoading()) return; this.busy.set(true); this.error.set(''); this.notice.set('');
    const revision = this.revision, targetUid = this.uid, name = this.profile()?.displayName;
    const wasFollowing = this.following();
    try {
      if (wasFollowing) {
        await this.data.unfollow(targetUid);
        if (revision !== this.revision) return;
        this.following.set(false); this.notice.set(`Você deixou de acompanhar ${name}.`);
      } else {
        const follows = await this.data.following();
        if (revision !== this.revision) return;
        if (follows.length >= MAX_FOLLOWING && !follows.some(item => item.uid === targetUid)) {this.error.set(`Você pode acompanhar até ${MAX_FOLLOWING} perfis. Deixe de seguir um perfil para adicionar outro.`); return;}
        await this.data.follow(targetUid);
        if (revision !== this.revision) return;
        this.following.set(true); this.notice.set(`Você está acompanhando ${name}.`);
      }
    } catch (error) {if (revision === this.revision) this.error.set(dataErrorMessage(error, 'Não foi possível atualizar quem você acompanha. Tente novamente.'));} finally {this.busy.set(false);}
  }
  async share() {try {await navigator.clipboard.writeText(this.profileUrl()); this.notice.set('Link do perfil copiado.'); this.shareFallback.set(false);} catch {this.shareFallback.set(true); this.notice.set('Copie o link abaixo para compartilhar seu perfil.'); setTimeout(() => document.getElementById('profile-url')?.focus());}}
  selectLink(event: FocusEvent) {(event.target as HTMLInputElement).select();}
}
