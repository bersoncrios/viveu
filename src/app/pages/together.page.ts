import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService } from '../core/auth.service';
import { DataService, Cursor } from '../core/data.service';
import { dataErrorMessage } from '../core/data-error';
import { CATEGORIES, Category, UserProfile, categoryLabel } from '../core/models';
import { SharedJourneyService } from '../core/shared-journey.service';
import { MAX_SHARED_MEMBERS, SHARED_UNITS, SharedJourney, SharedPace, SharedUnit } from '../core/shared-models';

@Component({
  selector: 'app-together-page', standalone: true, imports: [FormsModule, RouterLink],
  template: `
    <header class="page-heading"><div><span class="eyebrow">UMA OBRA, VÁRIOS OLHARES</span><h1>Jornadas em companhia</h1><p class="subtitle">Convide amigos, combine o ritmo e guarde o que vocês descobrem pelo caminho.</p></div><button class="button primary" type="button" (click)="toggleCreate()" [disabled]="disabled() || loading() || busy() || !!createdId()">{{disabled() ? 'Aguardando ativação' : showCreate() ? 'Fechar criação' : 'Criar jornada'}}</button></header>
    @if (disabled()) {<section class="panel shared-unavailable" role="status"><span class="eyebrow">RECURSO AINDA DESATIVADO</span><h2>Jornadas em companhia aguardam ativação neste ambiente</h2><p>A equipe responsável precisa habilitar o recurso. Depois disso, você poderá criar jornadas, aceitar convites e compartilhar experiências aqui.</p></section>}
    @else if (error()) {<div class="error" role="alert">{{error()}} <button class="button ghost" type="button" [disabled]="loading()" (click)="load(true)">Tentar novamente</button></div>}
    @if (createdId()) {<div class="notice shared-created-notice" role="status"><p>{{creationNotice()}}</p>@if (createError()) {<p class="error" role="alert">{{createError()}}</p>}<a [routerLink]="['/together', createdId()]">Abrir jornada →</a></div>}
    @if (showCreate() && !disabled() && !createdId()) {
      <form class="panel shared-create" (ngSubmit)="create()" novalidate>
        <h2>O que vamos viver juntos?</h2>
        @if (fromQueue) {<p class="field-help">Obra escolhida da sua fila. O item continua lá enquanto você combina a jornada com os amigos.</p>}
        <div class="field"><label for="shared-title">Obra</label><input id="shared-title" name="title" [(ngModel)]="title" maxlength="160" required [disabled]="busy()" placeholder="O livro, jogo, filme ou outra descoberta"></div>
        <div class="shared-form-grid"><div class="field"><label for="shared-category">Categoria</label><select id="shared-category" name="category" [(ngModel)]="category" (ngModelChange)="chooseUnit()" [disabled]="busy()" required><option value="" disabled>Escolha</option>@for (item of categories; track item.value) {<option [value]="item.value">{{item.singular}}</option>}</select></div>
        <div class="field"><label for="shared-unit">Como acompanhar o progresso?</label><select id="shared-unit" name="unit" [(ngModel)]="unit" [disabled]="busy()">@for (item of units; track item.value) {<option [value]="item.value">{{item.label}}</option>}</select></div></div>
        <div class="field"><label for="shared-description">Um convite com a sua cara (opcional)</label><textarea id="shared-description" name="description" [(ngModel)]="description" maxlength="500" rows="3" [disabled]="busy()" placeholder="Por que vale a pena viver essa história juntos?"></textarea></div>
        <fieldset class="shared-friends-picker"><legend>Quem você quer convidar?</legend><p class="field-help">Escolha entre as pessoas que você acompanha. Cada convite precisa ser aceito.</p>
          @if (friendsLoading()) {<p class="field-help" role="status">Carregando seus amigos…</p>}
          @if (friendsError()) {<p class="error" role="alert">{{friendsError()}} <button class="button ghost small" type="button" [disabled]="friendsLoading() || busy()" (click)="loadFriends(true)">Tentar novamente</button></p>}
          @if (!friendsLoading() && !friendsError() && !friends().length) {<p class="field-help">Você ainda não acompanha ninguém. <a routerLink="/feed">Encontre amigos</a> e volte para convidá-los.</p>}
          @if (friends().length) {<p class="field-help">{{selectedFriendIds().length}} de {{maxInitialInvites}} convites selecionados</p><div class="shared-friend-options">@for (friend of friends(); track friend.uid) {<label class="shared-friend-option"><input type="checkbox" [checked]="isFriendSelected(friend.uid)" [disabled]="busy() || (!isFriendSelected(friend.uid) && selectedFriendIds().length >= maxInitialInvites)" (change)="toggleFriend(friend.uid, $any($event.target).checked)"><span class="shared-friend-avatar">@if (friend.photoURL) {<img [src]="friend.photoURL" alt="" referrerpolicy="no-referrer">} @else {{{friend.displayName.slice(0, 1).toUpperCase()}}}</span><span class="shared-friend-copy"><strong>{{friend.displayName}}</strong>@if (friend.bio) {<small>{{friend.bio}}</small>}</span></label>}</div>}
        </fieldset>
        <fieldset class="shared-pace"><legend>O ritmo da companhia</legend><label><input type="radio" name="pace" value="free" [(ngModel)]="pace" [disabled]="busy()"><span><strong>Cada um no seu tempo</strong><small>Compartilhem descobertas sem combinar etapas.</small></span></label><label><input type="radio" name="pace" value="milestones" [(ngModel)]="pace" [disabled]="busy()"><span><strong>Com marcos combinados</strong><small>Definam capítulos, episódios ou sessões para conversar.</small></span></label></fieldset>
        <p class="field-help">Convites exigem aceite. O mural fica restrito aos participantes; publicar algo no diário é uma escolha separada.</p>
        @if (createError()) {<p class="error" role="alert">{{createError()}}</p>}
        <div class="button-row"><button class="button primary" type="submit" [disabled]="busy()">{{busy() ? selectedFriendIds().length ? 'Criando e enviando convites…' : 'Criando…' : selectedFriendIds().length ? 'Criar e convidar ' + selectedFriendIds().length : 'Criar jornada'}}</button><button class="button secondary" type="button" (click)="showCreate.set(false)" [disabled]="busy()">Cancelar</button></div>
      </form>
    }
    @if (loading() && !items().length) {<p class="loading-state" role="status">Buscando suas companhias…</p>}
    @if (!loading() && !disabled() && !error() && !items().length) {<section class="panel empty"><img src="/viveu-symbol.svg" width="44" height="44" alt=""><h2>Tem uma história que merece companhia?</h2><p>Comece uma jornada, encontre amigos pelo nome e convide quem você quer por perto.</p><button class="button primary" type="button" (click)="openCreate()">Criar minha primeira jornada</button></section>}
    <div class="shared-journey-grid">@for (item of items(); track item.id) {<a class="panel shared-journey-card" [routerLink]="['/together', item.id]"><div class="button-row"><span class="category-pill" [attr.data-category]="item.category">{{categoryConfig(item.category)?.icon}} {{label(item.category)}}</span>@if (invited(item)) {<span class="shared-invite-badge">Convite para você</span>} @else if (item.archived) {<span class="journey-status">Arquivada</span>}</div><h2>{{item.title}}</h2><p>{{item.description || 'Uma história para viver e conversar.'}}</p><span class="field-help">{{item.memberIds.length}} {{item.memberIds.length === 1 ? 'participante' : 'participantes'}} · {{item.pace === 'free' ? 'Cada um no seu tempo' : 'Com marcos combinados'}}</span><span class="shared-card-link">{{invited(item) ? 'Ver convite de ' + item.ownerName : 'Abrir jornada'}} →</span></a>}</div>
    @if (hasMore()) {<div class="load-more"><button class="button secondary" type="button" [disabled]="loading()" (click)="load()">{{loading() ? 'Carregando…' : 'Mais jornadas'}}</button></div>}
  `,
  styleUrl: './together.css',
})
export class TogetherPage {
  readonly auth = inject(AuthService); private shared = inject(SharedJourneyService); private data = inject(DataService);
  private route = inject(ActivatedRoute); private router = inject(Router);
  items = signal<SharedJourney[]>([]); loading = signal(false); error = signal(''); disabled = signal(false); hasMore = signal(false);
  busy = signal(false); createError = signal(''); createdId = signal(''); showCreate = signal(false);
  friends = signal<UserProfile[]>([]); friendsLoading = signal(false); friendsError = signal(''); selectedFriendIds = signal<string[]>([]); creationNotice = signal('');
  readonly maxInitialInvites = MAX_SHARED_MEMBERS - 1; private friendsLoaded = false;
  title = ''; category: Category | '' = ''; description = ''; pace: SharedPace = 'free'; unit: SharedUnit = 'capitulo';
  categoryConfig(value: string) {return CATEGORIES.find(item => item.value === value);}
  categories = CATEGORIES; units = SHARED_UNITS; label = categoryLabel; private cursor: Cursor = null;
  fromQueue = this.route.snapshot.queryParamMap.get('queue');
  constructor() {void this.initialize();}
  private async initialize() {
    await this.auth.ready; await this.load(true);
    if (this.fromQueue && !this.disabled()) {
      try {const item = (await this.data.queue()).find(item => item.id === this.fromQueue); if (!item) throw new Error('missing'); this.title = item.title; this.category = item.category; this.chooseUnit(); this.openCreate();}
      catch (error) {this.error.set(dataErrorMessage(error, 'Não foi possível abrir a obra da fila. Você pode criar a jornada preenchendo os dados.'));}
    }
  }
  chooseUnit() {const defaults: Record<string, SharedUnit> = {livro: 'capitulo', serie: 'episodio', filme: 'etapa', jogo: 'sessao', musica: 'faixa', podcast: 'episodio'}; this.unit = defaults[this.category] ?? 'etapa';}
  toggleCreate() {if (this.showCreate()) this.showCreate.set(false); else this.openCreate();}
  openCreate() {this.showCreate.set(true); void this.loadFriends();}
  isFriendSelected(uid: string) {return this.selectedFriendIds().includes(uid);}
  toggleFriend(uid: string, selected: boolean) {
    if (selected) {
      if (this.selectedFriendIds().length >= this.maxInitialInvites) return;
      this.selectedFriendIds.update(ids => ids.includes(uid) ? ids : [...ids, uid]);
    } else this.selectedFriendIds.update(ids => ids.filter(item => item !== uid));
  }
  async loadFriends(force = false) {
    if (this.friendsLoading() || (this.friendsLoaded && !force)) return;
    this.friendsLoading.set(true); this.friendsError.set('');
    try {
      const links = await this.data.following();
      const profiles = await Promise.all(links.map(link => this.data.getProfile(link.uid)));
      this.friends.set(profiles.filter((profile): profile is UserProfile => !!profile && profile.uid !== this.auth.user()?.uid)
        .sort((a, b) => a.displayName.localeCompare(b.displayName, 'pt-BR')));
      this.friendsLoaded = true;
    } catch (error) {this.friendsError.set(dataErrorMessage(error, 'Não foi possível carregar seus amigos.'));}
    finally {this.friendsLoading.set(false);}
  }
  invited(item: SharedJourney) {return item.invitedIds.includes(this.auth.user()?.uid ?? '');}
  async load(reset = false) {
    if (this.loading()) return; this.loading.set(true); this.error.set(''); this.disabled.set(false);
    try {await this.auth.ready; const page = await this.shared.list(reset ? null : this.cursor); this.items.update(items => reset ? page.items : [...items, ...page.items.filter(item => !items.some(current => current.id === item.id))]); this.cursor = page.cursor; this.hasMore.set(page.hasMore);}
    catch (error) {this.disabled.set((error as {code?: string})?.code === 'vaultlog/shared-disabled'); this.error.set(dataErrorMessage(error, 'Não foi possível carregar suas jornadas em companhia.'));}
    finally {this.loading.set(false);}
  }
  async create() {
    if (this.busy() || this.createdId() || this.disabled()) return; this.createError.set('');
    if (!this.title.trim() || this.title.trim().length > 160 || !this.category || this.description.trim().length > 500) {this.createError.set('Informe uma obra de até 160 caracteres, a categoria e um convite de até 500 caracteres.'); return;}
    this.busy.set(true);
    try {
      const id = await this.shared.create({title: this.title.trim(), category: this.category, description: this.description.trim(), pace: this.pace, unit: this.unit});
      this.createdId.set(id);
      const inviteIds = [...this.selectedFriendIds()]; let sent = 0; const failed: string[] = [];
      for (const uid of inviteIds) {
        try {await this.shared.invite(id, uid); sent++;}
        catch {failed.push(this.friends().find(friend => friend.uid === uid)?.displayName ?? 'um amigo');}
      }
      if (failed.length) {
        this.creationNotice.set(`Jornada criada. ${sent} de ${inviteIds.length} convites foram enviados.`);
        this.createError.set(`Não foi possível convidar ${failed.join(', ')}. Abra a jornada para tentar novamente.`);
        return;
      }
      this.creationNotice.set(inviteIds.length ? `Jornada criada e convites enviados a ${sent} ${sent === 1 ? 'pessoa' : 'pessoas'}. Elas precisam aceitar para participar.` : 'Jornada criada. Agora você pode abrir para convidar amigos.');
      try {await this.router.navigate(['/together', id]);} catch { /* Saved state keeps a link without repeating the write. */ }
    }
    catch (error) {this.createError.set(dataErrorMessage(error, 'Não foi possível criar. Seus dados continuam aqui.'));}
    finally {this.busy.set(false);}
  }
}
