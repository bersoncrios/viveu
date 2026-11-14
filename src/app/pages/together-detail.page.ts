import { DatePipe } from '@angular/common';
import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { AuthService } from '../core/auth.service';
import { Cursor, DataService } from '../core/data.service';
import { dataErrorMessage } from '../core/data-error';
import { CATEGORIES, JourneyStatus, Rating, UserProfile, categoryLabel, journeyStatusLabel } from '../core/models';
import { SharedJourneyService } from '../core/shared-journey.service';
import { MAX_SHARED_MEMBERS, SharedJourney, SharedMember, SharedMilestone, SharedPost, SharedPostKind, sharedPostHidden, sharedUnitLabel } from '../core/shared-models';

@Component({
  selector: 'app-together-detail-page', standalone: true, imports: [FormsModule, RouterLink, DatePipe],
  template: `
    <a class="button ghost shared-back" routerLink="/together">← Minhas companhias</a>
    @if (disabled()) {<section class="panel shared-unavailable" role="status"><span class="eyebrow">RECURSO AINDA DESATIVADO</span><h1>Jornadas em companhia aguardam ativação neste ambiente</h1><p>A equipe responsável precisa habilitar o recurso. Depois disso, você poderá abrir esta jornada e participar do grupo.</p><a class="button secondary" routerLink="/together">Voltar às jornadas</a></section>}
    @else if (error()) {<div class="error" role="alert">{{error()}} <button class="button ghost" type="button" [disabled]="loading() || busy()" (click)="load(id)">Atualizar jornada</button></div>}
    @if (notice()) {<p class="notice" role="status">{{notice()}}</p>}
    @if (loading() && !group() && !disabled()) {<p class="loading-state" role="status">Abrindo a jornada…</p>}
    @if (departed()) {<section class="panel empty"><h1>{{departed()}}</h1><a class="button secondary" routerLink="/together">Voltar às minhas jornadas</a></section>}
    @else if (group(); as journey) {
      <header class="shared-hero panel"><div class="button-row"><span class="category-pill" [attr.data-category]="journey.category">{{categoryConfig(journey.category)?.icon}} {{category(journey.category)}}</span><span class="journey-status">{{journey.pace === 'free' ? 'Cada um no seu tempo' : 'Marcos combinados'}}</span>@if (journey.archived) {<span class="journey-status">Arquivada</span>}</div><h1>{{journey.title}}</h1>@if (journey.description) {<p>{{journey.description}}</p>}<p class="field-help">Um convite de {{journey.ownerName}} · {{journey.memberIds.length}} {{journey.memberIds.length === 1 ? 'participante' : 'participantes'}}</p></header>
      @if (me()?.state === 'invited') {<section class="panel shared-invitation"><h2>Tem lugar para o seu olhar.</h2><p>Ao aceitar, você entra no grupo e pode ler e compartilhar impressões com os participantes. Nada do mural vai para o seu perfil sem você escolher publicar.</p>@if (journey.archived) {<p class="notice">Este grupo foi arquivado. O convite não pode mais ser aceito; você pode recusá-lo para removê-lo da sua lista.</p>}<div class="button-row"><button class="button primary" type="button" [disabled]="busy() || journey.archived" (click)="respond(true)">Aceitar e começar</button><button class="button secondary" type="button" [disabled]="busy()" (click)="respond(false)">Agora não</button></div></section>}
      @else if (me()?.state === 'active') {
        <div class="shared-toolbar"><span class="field-help">Mural restrito a quem aceitou o convite.</span><div class="button-row"><button class="button ghost" type="button" [disabled]="loading() || busy()" (click)="load(id)">Atualizar</button>@if (owner() && !journey.archived) {<button class="button ghost" type="button" [disabled]="busy()" (click)="confirmation.set('archive')">Arquivar grupo</button>} @else if (!owner()) {<button class="button ghost" type="button" [disabled]="busy()" (click)="confirmation.set('leave')">Sair da jornada</button>}</div></div>
        @if (journey.archived) {<p class="notice">Esta companhia foi arquivada. O mural continua disponível para leitura e você pode concluir sua experiência individual.</p>}
        @if (confirmation()) {<section class="panel confirm-panel"><h2>{{confirmation() === 'leave' ? 'Sair desta jornada?' : 'Arquivar esta companhia?'}}</h2><p>{{confirmation() === 'leave' ? 'Você deixa de acessar o mural. Suas contribuições já compartilhadas permanecem com o grupo.' : 'Novos convites, marcos e mensagens serão encerrados. As experiências pessoais continuam com cada participante.'}}</p><div class="button-row"><button class="button secondary" type="button" [disabled]="busy()" (click)="confirmation.set('')">Cancelar</button><button class="button danger" type="button" [disabled]="busy()" (click)="confirmAction()">Confirmar</button></div></section>}
        <div class="shared-detail-layout"><div class="shared-main-column">
          <section class="panel"><h2>Seu momento nesta história</h2><p class="field-help">{{statusLabel(me()?.status)}} · {{unitLabel(journey.unit)}} {{me()?.progress}}</p>@if (!journey.archived) {<form class="shared-progress-form" (ngSubmit)="saveProgress()"><div class="field"><label for="my-progress">Até onde você foi? ({{unitLabel(journey.unit)}})</label><input id="my-progress" name="progress" type="number" min="0" max="1000000" step="1" [(ngModel)]="progress" [disabled]="busy()"></div><div class="field"><label for="my-status">Seu ritmo</label><select id="my-status" name="status" [(ngModel)]="progressStatus" [disabled]="busy()"><option value="in_progress">Em andamento</option><option value="paused">Pausado</option><option value="abandoned">Deixei para depois</option></select></div><button class="button secondary" type="submit" [disabled]="busy()">{{me()?.status === 'completed' ? 'Retomar minha jornada' : 'Guardar progresso'}}</button></form>}</section>
          @if (journey.pace === 'milestones') {<section class="panel"><h2>Nossos próximos encontros</h2>@if (!journey.milestones.length) {<p class="field-help">Ainda não há marcos combinados. Quem criou o grupo pode sugerir o primeiro.</p>}<ol class="shared-milestones">@for (milestone of journey.milestones; track milestone.id) {<li><span class="journey-status">{{unitLabel(journey.unit)}} {{milestone.position}}</span><h3>{{milestone.title}}</h3>@if (milestone.meetingAt) {<p class="field-help">Encontro: {{milestone.meetingAt | date:'dd/MM/yyyy HH:mm'}}</p>}@if (milestone.question) {<p>{{milestone.question}}</p>}<button class="button ghost small" type="button" [disabled]="busy() || journey.archived" (click)="replyTo(milestone)">Conversar sobre este marco →</button></li>}</ol>
          @if (owner() && !journey.archived) {<details class="shared-disclosure"><summary>Combinar um novo marco</summary><form (ngSubmit)="addMilestone()"><div class="field"><label for="milestone-title">O que vamos combinar?</label><input id="milestone-title" name="milestoneTitle" [(ngModel)]="milestoneTitle" maxlength="120" required [disabled]="busy()" placeholder="Conversar sobre os capítulos 1–5"></div><div class="shared-form-grid"><div class="field"><label for="milestone-position">Até qual {{unitLabel(journey.unit).toLowerCase()}}?</label><input id="milestone-position" name="milestonePosition" type="number" min="0" max="1000000" step="1" [(ngModel)]="milestonePosition" required [disabled]="busy()"></div><div class="field"><label for="milestone-date">Quando? (opcional)</label><input id="milestone-date" name="meetingAt" type="datetime-local" [(ngModel)]="meetingAt" [disabled]="busy()"></div></div><div class="field"><label for="milestone-question">Pergunta do encontro (opcional)</label><textarea id="milestone-question" name="milestoneQuestion" [(ngModel)]="milestoneQuestion" maxlength="500" [disabled]="busy()" placeholder="Você teria feito a mesma escolha?"></textarea></div><button class="button secondary" type="submit" [disabled]="busy()">Guardar marco</button></form></details>}</section>}
          <section class="panel shared-wall" aria-labelledby="wall-title"><h2 id="wall-title">O que a gente vai descobrindo</h2><p class="field-help">Cada impressão tem seu tempo. Textos com spoiler ou além do seu progresso começam ocultos.</p>
            @if (!journey.archived) {<form class="shared-post-form" (ngSubmit)="addPost()"><div class="field"><label for="post-kind">O que quer compartilhar?</label><select id="post-kind" name="postKind" [(ngModel)]="postKind" [disabled]="busy()"><option value="note">Uma impressão</option><option value="question">Uma pergunta para o grupo</option><option value="session">Uma sessão que vivemos juntos</option></select></div><div class="field"><label for="post-text">Sua contribuição</label><textarea id="post-text" name="postText" [(ngModel)]="postText" maxlength="1000" rows="4" required [disabled]="busy()" placeholder="Uma descoberta, uma pergunta ou algo que aconteceu na sessão…" aria-describedby="post-count"></textarea><span id="post-count" class="field-help character-count">{{postText.length}} / 1000</span></div><div class="field"><label for="post-progress">Sobre qual {{unitLabel(journey.unit).toLowerCase()}}? (opcional)</label><input id="post-progress" name="postProgress" type="number" min="0" max="1000000" step="1" [(ngModel)]="postProgress" [disabled]="busy()"></div><label class="shared-check"><input name="postSpoiler" type="checkbox" [(ngModel)]="postSpoiler" [disabled]="busy()"> Meu texto tem spoilers</label><label class="shared-check"><input name="postPublic" type="checkbox" [(ngModel)]="postPublic" [disabled]="busy()"> Também guardar esta nota no meu diário público</label>@if (postPublic) {<p class="notice">Só o seu texto será copiado para uma experiência pública sua. Mensagens de outras pessoas e os dados do grupo continuam no grupo.</p>}<button class="button primary" type="submit" [disabled]="busy() || loadingPosts()">Compartilhar com o grupo</button></form>}
            @if (postsError()) {<p class="error" role="alert">{{postsError()}} <button class="button ghost" type="button" [disabled]="loadingPosts() || busy()" (click)="morePosts(true)">Tentar novamente</button></p>}
            @if (loadingPosts()) {<p class="field-help" role="status">Buscando impressões…</p>}
            @if (!posts().length && !postsError() && !loadingPosts()) {<p class="shared-wall-empty">Uma boa conversa pode começar com a sua primeira impressão.</p>}
            <ol class="shared-post-list">@for (post of posts(); track post.id) {<li><article><div class="shared-post-meta"><strong>{{post.authorName}}</strong><time [attr.datetime]="post.createdAt | date:'yyyy-MM-ddTHH:mm:ss'">{{post.createdAt | date:'dd/MM/yyyy HH:mm'}}</time></div><div class="button-row"><span class="category-pill">{{kindLabel(post.kind)}}</span>@if (post.progress !== null) {<span class="field-help">{{unitLabel(journey.unit)}} {{post.progress}}</span>}@if (post.publishedPublicly) {<span class="field-help">Autor também publicou no próprio diário</span>}</div>@if (!postVisible(post)) {<div class="spoiler-warning"><p>{{post.containsSpoilers ? 'Esta contribuição tem spoilers.' : 'Esta contribuição está além do seu progresso.'}}</p><button class="button secondary small" type="button" (click)="togglePost(post)" [attr.aria-controls]="'shared-post-' + post.id" aria-expanded="false">Ler mesmo assim</button></div>}<div [id]="'shared-post-' + post.id">@if (postVisible(post)) {<p class="shared-post-text">{{post.text}}</p>@if (needsReveal(post)) {<button class="button ghost small" type="button" (click)="togglePost(post)" [attr.aria-controls]="'shared-post-' + post.id" aria-expanded="true">Ocultar novamente</button>}}</div></article></li>}</ol>
            @if (hasMorePosts()) {<button class="button secondary" type="button" [disabled]="loadingPosts() || busy()" (click)="morePosts()">Mais impressões</button>}
          </section>
          <section class="panel"><h2>O que ficou para você?</h2><p class="field-help">Cada pessoa conclui no seu tempo. Sua avaliação e reflexão ficam com os participantes; você escolhe se quer levá-las ao diário público.</p><form class="shared-finish-form" (ngSubmit)="finish()"><div class="field"><label for="finish-rating">Sua avaliação</label><select id="finish-rating" name="finishRating" [(ngModel)]="finishRating" [disabled]="busy()" required><option [ngValue]="null" disabled>Escolha uma nota</option>@for (rating of ratings; track rating) {<option [ngValue]="rating">{{rating}} de 5</option>}</select></div><div class="field"><label for="finish-reflection">Sua reflexão (opcional)</label><textarea id="finish-reflection" name="finishReflection" [(ngModel)]="finishReflection" maxlength="3000" rows="5" [disabled]="busy()"></textarea></div><label class="shared-check"><input name="finishPublic" type="checkbox" [(ngModel)]="finishPublic" [disabled]="busy()"> Também publicar minha conclusão no diário</label>@if (finishPublic) {<p class="notice">Sua avaliação e reflexão serão públicas, com aviso de spoiler na reflexão. O restante do mural não será copiado. Você pode ajustar o aviso depois no diário.</p>}<button class="button primary" type="submit" [disabled]="busy()">{{me()?.status === 'completed' ? 'Atualizar minha reflexão' : 'Concluir minha experiência'}}</button></form>@if (me()?.entryPublished) {<a class="button ghost" [routerLink]="['/entry', me()?.entryId, 'edit']">Ver minha experiência no diário →</a>}</section>
          @if (completedMembers().length) {<section class="panel"><h2>Memórias da companhia</h2><p class="field-help">A mesma história, olhares diferentes. Reflexões finais começam ocultas para quem ainda não terminou.</p>@for (person of completedMembers(); track person.uid) {<article class="shared-memory"><h3>{{person.displayName}} <span class="field-help">· {{person.rating}} / 5</span></h3>@if (person.reflection) {@if (!reflectionVisible(person)) {<button class="button secondary small" type="button" (click)="revealReflection(person)">Ler reflexão final com spoilers</button>} @else {<p>{{person.reflection}}</p>}}</article>}</section>}
        </div><aside class="shared-side-column">
          <section class="panel"><h2>Quem está por perto</h2><p class="field-help">{{journey.memberIds.length}} participantes · até {{maxMembers}} pessoas, contando convites.</p><ul class="shared-member-list">@for (person of members(); track person.uid) {<li><span class="avatar avatar-small" aria-hidden="true">{{person.displayName.slice(0, 1).toUpperCase()}}</span><div><strong>{{person.displayName}}</strong><span>{{person.state === 'invited' ? 'Convite pendente' : statusLabel(person.status)}}</span>@if (person.state === 'active') {<small>{{unitLabel(journey.unit)}} {{person.progress}}</small>}</div></li>}</ul></section>
          @if (owner() && !journey.archived) {<section class="panel"><h2>Mais uma companhia?</h2><form (ngSubmit)="findPeople()"><div class="field"><label for="invite-name">Buscar amigo pelo nome</label><input id="invite-name" name="friendName" [(ngModel)]="friendName" (ngModelChange)="resetPeople()" minlength="2" maxlength="60" placeholder="Ex.: Ana" [disabled]="busy()"><p class="field-help">Use o início do nome público, com os acentos.</p></div><button class="button secondary" type="submit" [disabled]="finding() || busy()">{{finding() ? 'Buscando…' : 'Buscar amigos'}}</button></form>@if (peopleError()) {<p class="error" role="alert">{{peopleError()}}</p>}<div aria-live="polite">@if (peopleSearched() && !people().length) {<p class="field-help">Não encontramos perfis nesta página.</p>}<ul class="shared-invite-list">@for (person of people(); track person.uid) {<li><strong>{{person.displayName}}</strong>@if (person.bio) {<p>{{person.bio}}</p>}<button class="button secondary small" type="button" [disabled]="busy() || alreadyHere(person.uid) || journey.audienceIds.length >= maxMembers" (click)="invite(person.uid)">{{alreadyHere(person.uid) ? 'Já faz parte ou foi convidado' : 'Convidar'}}</button></li>}</ul>@if (morePeople()) {<button class="button ghost" type="button" [disabled]="finding() || busy()" (click)="findPeople(true)">Mais pessoas</button>}</div></section>}
        </aside></div>
      }
    }
    @else if (!loading() && !error()) {<section class="panel empty"><h1>Não encontramos esta jornada.</h1><p>Confira o endereço ou abra um convite recebido.</p><a class="button secondary" routerLink="/together">Minhas jornadas</a></section>}
  `,
  styleUrl: './together.css',
})
export class TogetherDetailPage {
  readonly auth = inject(AuthService); private shared = inject(SharedJourneyService); private data = inject(DataService); private route = inject(ActivatedRoute);
  id = ''; group = signal<SharedJourney | null>(null); me = signal<SharedMember | null>(null); members = signal<SharedMember[]>([]);
  loading = signal(false); disabled = signal(false); error = signal(''); notice = signal(''); busy = signal(false); departed = signal(''); confirmation = signal<'leave' | 'archive' | ''>('');
  posts = signal<SharedPost[]>([]); loadingPosts = signal(false); postsError = signal(''); hasMorePosts = signal(false); private postCursor: Cursor = null;
  progress = 0; progressStatus: JourneyStatus = 'in_progress'; postText = ''; postKind: SharedPostKind = 'note'; postProgress: number | null = null; postSpoiler = false; postPublic = false;
  finishRating: Rating | null = null; finishReflection = ''; finishPublic = false; ratings = [1, 2, 3, 4, 5] as const;
  milestoneTitle = ''; milestonePosition: number | null = null; meetingAt = ''; milestoneQuestion = '';
  friendName = ''; finding = signal(false); people = signal<UserProfile[]>([]); peopleError = signal(''); peopleSearched = signal(false); morePeople = signal(false);
  private peopleCursor: Cursor = null; private searchedName = ''; private peopleRevision = 0; private revision = 0; private populatedId = '';
  private revealedPosts = signal<string[]>([]); private revealedReflections = signal<string[]>([]);
  categoryConfig(value: string) {return CATEGORIES.find(item => item.value === value);}
  maxMembers = MAX_SHARED_MEMBERS; category = categoryLabel; statusLabel = journeyStatusLabel; unitLabel = sharedUnitLabel;
  constructor() {this.route.paramMap.pipe(takeUntilDestroyed(inject(DestroyRef))).subscribe(params => {void this.load(params.get('id') ?? '');});}
  owner() {return this.group()?.ownerId === this.auth.user()?.uid;}
  completedMembers() {return this.members().filter(person => person.state === 'active' && person.status === 'completed');}
  alreadyHere(uid: string) {return this.group()?.audienceIds.includes(uid) ?? false;}
  kindLabel(kind: SharedPostKind) {return kind === 'question' ? 'Pergunta para o grupo' : kind === 'session' ? 'Sessão em companhia' : 'Impressão';}
  private postKey(post: SharedPost) {return JSON.stringify([this.id, post.id, post.text, post.containsSpoilers, post.progress]);}
  needsReveal(post: SharedPost) {const me = this.me(); return !!me && sharedPostHidden(post, me);}
  postVisible(post: SharedPost) {return !this.needsReveal(post) || this.revealedPosts().includes(this.postKey(post));}
  togglePost(post: SharedPost) {const key = this.postKey(post); this.revealedPosts.update(keys => keys.includes(key) ? keys.filter(value => value !== key) : [...keys, key]);}
  private reflectionKey(person: SharedMember) {return JSON.stringify([this.id, person.uid, person.reflection]);}
  reflectionVisible(person: SharedMember) {return person.uid === this.me()?.uid || this.me()?.status === 'completed' || this.revealedReflections().includes(this.reflectionKey(person));}
  revealReflection(person: SharedMember) {this.revealedReflections.update(keys => [...keys, this.reflectionKey(person)]);}
  async load(id: string) {
    const changingJourney = id !== this.id;
    const populateForms = changingJourney || id !== this.populatedId;
    if (changingJourney) this.populatedId = '';
    const revision = ++this.revision; this.id = id; this.loading.set(true); this.disabled.set(false); this.error.set(''); this.notice.set(''); this.group.set(null); this.me.set(null); this.members.set([]); this.posts.set([]); this.postCursor = null; this.hasMorePosts.set(false); this.postsError.set(''); this.busy.set(false); this.departed.set(''); this.confirmation.set(''); this.loadingPosts.set(false); this.revealedPosts.set([]); this.revealedReflections.set([]); this.resetPeople();
    if (populateForms) {this.postText = ''; this.postPublic = false; this.postSpoiler = false; this.postKind = 'note'; this.postProgress = null; this.finishPublic = false; this.milestoneTitle = ''; this.milestoneQuestion = ''; this.milestonePosition = null; this.meetingAt = '';}
    try {await this.auth.ready; await this.refresh(id, revision, populateForms);}
    catch (error) {if (revision === this.revision) {this.disabled.set((error as {code?: string})?.code === 'vaultlog/shared-disabled'); this.error.set(dataErrorMessage(error, 'Não foi possível abrir esta jornada. Confira seu convite e tente novamente.'));}}
    finally {if (revision === this.revision) this.loading.set(false);}
  }
  private async refresh(id: string, revision: number, populateForms = false) {
    const [group, me] = await Promise.all([this.shared.get(id), this.shared.membership(id)]);
    if (revision !== this.revision) return;
    this.group.set(group); this.me.set(me);
    if (me && populateForms) {this.progress = me.progress; this.progressStatus = me.status === 'completed' ? 'in_progress' : me.status; this.finishRating = me.rating; this.finishReflection = me.reflection; this.populatedId = id;}
    if (group && me?.state === 'active') {
      const members = await this.shared.members(id); if (revision !== this.revision) return; this.members.set(members);
      await this.morePosts(true);
    }
  }
  private async action(work: (id: string) => Promise<unknown>, message: string, after?: () => void, refresh = true): Promise<boolean> {
    if (this.busy() || this.loading()) return false;
    const id = this.id, revision = this.revision; this.busy.set(true); this.error.set(''); this.notice.set('');
    try {await work(id);}
    catch (error) {if (revision === this.revision) {this.error.set(dataErrorMessage(error, 'Não foi possível concluir. Seus dados continuam aqui.')); this.busy.set(false);} return false;}
    if (revision !== this.revision) return false;
    after?.(); this.notice.set(message);
    if (refresh) {try {await this.refresh(id, revision);} catch (error) {if (revision === this.revision) this.error.set(dataErrorMessage(error, 'A alteração foi salva. Não foi possível atualizar a jornada. Atualize para continuar.'));}}
    if (revision === this.revision) this.busy.set(false); return true;
  }
  async respond(accept: boolean) {await this.action(id => this.shared.respond(id, accept), accept ? 'Convite aceito. Boa jornada!' : 'Convite recusado.', () => {if (!accept) this.departed.set('Convite recusado. Quem sabe em outra história?');}, accept);}
  async confirmAction() {
    if (this.confirmation() === 'archive') await this.action(id => this.shared.archive(id), 'Grupo arquivado.', () => this.confirmation.set(''));
    else if (this.confirmation() === 'leave') await this.action(id => this.shared.leave(id), 'Você saiu da jornada.', () => {this.confirmation.set(''); this.departed.set('Você saiu desta jornada.');}, false);
  }
  async saveProgress() {await this.action(id => this.shared.updateProgress(id, this.progress, this.progressStatus), 'Seu progresso foi guardado.');}
  async invite(uid: string) {await this.action(id => this.shared.invite(id, uid), 'Convite enviado. A pessoa escolhe quando aceitar.');}
  async addMilestone() {
    if (this.milestonePosition === null) {this.error.set('Informe até qual ponto combinar o encontro.'); return;}
    const meetingAt = this.meetingAt ? new Date(this.meetingAt).getTime() : null;
    await this.action(id => this.shared.addMilestone(id, {title: this.milestoneTitle, position: this.milestonePosition!, meetingAt, question: this.milestoneQuestion}), 'Marco combinado com o grupo.', () => {this.milestoneTitle = ''; this.milestonePosition = null; this.meetingAt = ''; this.milestoneQuestion = '';});
  }
  replyTo(milestone: SharedMilestone) {this.postKind = 'note'; this.postProgress = milestone.position; this.postText = `Sobre “${milestone.title}”: `; setTimeout(() => {document.getElementById('post-text')?.focus(); document.getElementById('post-text')?.scrollIntoView({behavior: 'smooth', block: 'center'});});}
  async addPost() {await this.action(id => this.shared.addPost(id, {text: this.postText, kind: this.postKind, progress: this.postProgress, containsSpoilers: this.postSpoiler, publishPublicly: this.postPublic}), this.postPublic ? 'Contribuição compartilhada com o grupo e guardada no seu diário público.' : 'Sua contribuição ficou com o grupo.', () => {this.postText = ''; this.postSpoiler = false; this.postPublic = false; this.postProgress = null;});}
  async finish() {if (!this.finishRating) {this.error.set('Escolha uma avaliação para concluir sua experiência.'); return;} await this.action(id => this.shared.finish(id, {rating: this.finishRating!, reflection: this.finishReflection, publishPublicly: this.finishPublic}), this.finishPublic ? 'Sua conclusão ficou com o grupo e no seu diário público.' : 'Sua conclusão ficou com o grupo.', () => {this.finishPublic = false;});}
  async morePosts(reset = false) {
    if (this.loadingPosts()) return; const id = this.id, revision = this.revision; this.loadingPosts.set(true); this.postsError.set('');
    try {const page = await this.shared.posts(id, reset ? null : this.postCursor); if (revision !== this.revision) return; this.posts.update(items => reset ? page.items : [...items, ...page.items.filter(item => !items.some(existing => existing.id === item.id))]); this.postCursor = page.cursor; this.hasMorePosts.set(page.hasMore);}
    catch (error) {if (revision === this.revision) this.postsError.set(dataErrorMessage(error, 'Não foi possível carregar o mural.'));}
    finally {if (revision === this.revision) this.loadingPosts.set(false);}
  }
  resetPeople() {++this.peopleRevision; this.people.set([]); this.peopleCursor = null; this.morePeople.set(false); this.peopleError.set(''); this.peopleSearched.set(false); this.finding.set(false);}
  async findPeople(more = false) {
    if (this.finding() || this.busy()) return; if (!more) this.resetPeople(); const revision = this.peopleRevision;
    const name = more ? this.searchedName : this.friendName.trim();
    if (name.length < 2 || name.length > 60) {this.peopleError.set('Digite entre 2 e 60 caracteres do início do nome.'); return;}
    this.searchedName = name; this.finding.set(true); this.peopleError.set('');
    try {const page = await this.data.searchProfiles(name, more ? this.peopleCursor : null); if (revision !== this.peopleRevision) return; this.people.update(items => more ? [...items, ...page.items.filter(item => !items.some(existing => existing.uid === item.uid))] : page.items); this.peopleCursor = page.cursor; this.morePeople.set(page.hasMore); this.peopleSearched.set(true);}
    catch (error) {if (revision === this.peopleRevision) this.peopleError.set(dataErrorMessage(error, 'Não foi possível buscar amigos.'));}
    finally {if (revision === this.peopleRevision) this.finding.set(false);}
  }
}
