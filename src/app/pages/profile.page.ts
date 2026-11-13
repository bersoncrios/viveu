import { dataErrorMessage } from '../core/data-error';
import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { AuthService } from '../core/auth.service';
import { Cursor, DataService, MAX_FOLLOWING } from '../core/data.service';
import { ConsumptionEntry, UserProfile } from '../core/models';
import { EntryCard } from './entry-card';

@Component({selector: 'app-profile-page', standalone: true, imports: [FormsModule, RouterLink, EntryCard], template: `
  @if (loading() && !profile()) {<p role="status" class="loading-state">Carregando perfil…</p>}
  @if (error()) {<div class="error" role="alert">{{error()}} @if (loadFailed()) {<button class="button ghost" type="button" (click)="load(uid)">Tentar novamente</button>}</div>}
  @if (!loading() && !profile() && !loadFailed()) {<section class="panel empty"><h1>Não encontramos este perfil.</h1><p>Confira o link e tente novamente.</p><a class="button secondary" routerLink="/feed">Voltar ao feed</a></section>}
  @if (profile(); as person) {
    <section class="profile-hero panel"><div class="profile-topline"><span class="eyebrow">UM ACERVO DE HISTÓRIAS</span><button class="button secondary" type="button" (click)="share()">Compartilhar perfil <span aria-hidden="true">↗</span></button></div><div class="profile-identity"><span class="avatar avatar-large" aria-hidden="true">@if (person.photoURL && !photoFailed()) {<img [src]="person.photoURL" alt="" referrerpolicy="no-referrer" (error)="photoFailed.set(true)">} @else {{{person.displayName.slice(0, 1).toUpperCase()}}}</span><div><h1>{{person.displayName}}</h1>@if (person.bio) {<p class="profile-bio">{{person.bio}}</p>}</div></div><div class="profile-actions button-row">
      @if (auth.user()?.uid === person.uid) {<button class="button secondary" type="button" (click)="startEdit()">Editar perfil</button>}
      @else if (auth.user()) {<button class="button" [class.primary]="!following()" [class.secondary]="following()" type="button" [disabled]="busy() || followingLoading()" (click)="toggleFollow()">{{busy() ? 'Atualizando…' : following() ? 'Deixar de seguir' : 'Seguir'}}</button>}
      @else {<a class="button primary" routerLink="/login" [queryParams]="{returnUrl: '/u/' + person.uid}">Entrar para acompanhar</a>}
    </div></section>
    <p class="notice" role="status">{{notice()}}</p>
    @if (shareFallback()) {<div class="panel field"><label for="profile-url">Copie o link abaixo para compartilhar seu perfil.</label><input id="profile-url" [value]="profileUrl()" readonly (focus)="selectLink($event)"></div>}
    @if (editing()) {<form class="panel profile-edit" (ngSubmit)="saveProfile()"><h2>Editar perfil</h2><div class="field"><label for="profile-name">Nome público</label><input id="profile-name" name="displayName" [(ngModel)]="displayName" required minlength="2" maxlength="60" [disabled]="busy()"></div><div class="field"><label for="profile-bio">Bio (opcional)</label><textarea id="profile-bio" name="bio" [(ngModel)]="bio" maxlength="240" rows="3" [disabled]="busy()" aria-describedby="bio-count"></textarea><span id="bio-count" class="field-help">{{bio.length}} / 240</span></div><div class="button-row"><button class="button primary" type="submit" [disabled]="busy()">{{busy() ? 'Salvando…' : 'Salvar alterações'}}</button><button class="button secondary" type="button" (click)="editing.set(false)" [disabled]="busy()">Cancelar</button></div></form>}
    <div class="section-heading"><h2>Diário cultural</h2><span class="eyebrow">UMA HISTÓRIA DE CADA VEZ</span></div>
    @if (!loading() && !entries().length && !entriesError()) {<section class="panel empty"><span class="empty-symbol" aria-hidden="true">▤</span><h2>Esta história ainda está começando.</h2><p>Os registros deste perfil vão aparecer aqui.</p>@if (auth.user()?.uid === person.uid) {<a class="button primary" routerLink="/entry/new">Guardar experiência</a>}</section>}
    @if (entriesError()) {<p class="error" role="alert">{{entriesError()}} <button class="button ghost" type="button" (click)="more(true)" [disabled]="loadingMore()">Tentar novamente</button></p>}
    <div class="entry-list">@for (entry of entries(); track entry.id) {<app-entry-card [entry]="entry"/>}</div>
    @if (hasMore()) {<div class="load-more"><button class="button secondary" type="button" [disabled]="loadingMore()" (click)="more()">{{loadingMore() ? 'Carregando…' : 'Carregar mais'}}</button></div>}
  }
`})
export class ProfilePage {
  auth = inject(AuthService); private data = inject(DataService); private route = inject(ActivatedRoute);
  profile = signal<UserProfile | null>(null); entries = signal<ConsumptionEntry[]>([]); loading = signal(false); loadingMore = signal(false); error = signal(''); notice = signal(''); loadFailed = signal(false); entriesError = signal(''); hasMore = signal(false); following = signal(false); followingLoading = signal(true); editing = signal(false); busy = signal(false); shareFallback = signal(false); photoFailed = signal(false);
  uid = ''; displayName = ''; bio = ''; private cursor: Cursor = null; private revision = 0;
  constructor() {this.route.paramMap.pipe(takeUntilDestroyed(inject(DestroyRef))).subscribe(params => {void this.load(params.get('uid') || '');});}
  profileUrl() {return `${window.location.origin}/u/${encodeURIComponent(this.uid)}`;}
  async load(uid: string) {
    const revision = ++this.revision; this.uid = uid; this.loading.set(true); this.error.set(''); this.loadFailed.set(false); this.profile.set(null); this.entries.set([]); this.hasMore.set(false); this.cursor = null; this.following.set(false); this.followingLoading.set(true); this.editing.set(false); this.notice.set(''); this.shareFallback.set(false); this.photoFailed.set(false); this.entriesError.set('');
    try {
      const person = await this.data.getProfile(uid); if (revision !== this.revision) return; this.profile.set(person);
      if (person) {
        try {const page = await this.data.entriesPage(uid); if (revision !== this.revision) return; this.entries.set(page.items); this.cursor = page.cursor; this.hasMore.set(page.hasMore);} catch (error) {if (revision === this.revision) this.entriesError.set(dataErrorMessage(error, 'Não foi possível carregar os registros.'));}
        await this.auth.ready;
        if (revision !== this.revision) return;
        if (this.auth.user() && this.auth.user()?.uid !== uid) {
          try {const following = await this.data.following(); if (revision === this.revision) this.following.set(following.some(item => item.uid === uid));} catch (error) {if (revision === this.revision) this.error.set(dataErrorMessage(error, 'Não foi possível verificar quem você acompanha. Recarregue o perfil para tentar novamente.'));}
        }
      }
    } catch (error) {if (revision === this.revision) {this.error.set(dataErrorMessage(error, 'Não foi possível carregar este perfil.')); this.loadFailed.set(true);}}
    finally {if (revision === this.revision) {this.loading.set(false); this.followingLoading.set(false);}}
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
