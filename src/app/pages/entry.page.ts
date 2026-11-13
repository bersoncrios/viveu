import { dataErrorMessage } from '../core/data-error';
import { DatePipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService } from '../core/auth.service';
import { DataService } from '../core/data.service';
import { CATEGORIES, Category, Rating, FEELINGS, Feeling, MAX_FEELINGS, REFLECTION_MAX_LENGTH, reflectionPrompt, JOURNEY_STATUSES, JourneyStatus, JourneyNote, journeyStatus, JOURNEY_REASON_MAX_LENGTH, RESUME_POINT_MAX_LENGTH, JOURNEY_NOTE_MAX_LENGTH, MAX_JOURNEY_NOTES } from '../core/models';

@Component({selector: 'app-entry-page', standalone: true, imports: [FormsModule, RouterLink, DatePipe], template: `
  <div class="form-page"><header class="page-heading"><div><span class="eyebrow">UMA EXPERIÊNCIA PARA LEMBRAR</span><h1>{{entryId ? 'Minha jornada' : previousEntryId ? 'Viver esta obra novamente' : 'Guardar uma experiência'}}</h1><p class="subtitle">Do primeiro interesse ao que ficou com você: cada passo faz parte da história.</p></div></header>
  @if (loading()) {<p role="status" class="loading-state">Carregando experiência…</p>}
  @if (error()) {<p class="error" role="alert">{{error()}}</p>}
  @if (saved()) {<section class="panel" role="status"><h2>Registro salvo.</h2><p>Seu registro já está no seu diário.</p><a class="button primary" routerLink="/diary">Ver meu diário</a></section>}
  @if (!loading() && !loadFailed() && !saved()) {
    <form class="panel entry-form" (ngSubmit)="save()" novalidate>
      @if (queueId) {<p class="notice">Da sua fila para a sua jornada. O título só sai da fila depois de salvar.</p>}
      <div class="field"><label for="entry-title">Título</label><input id="entry-title" name="title" [(ngModel)]="title" maxlength="160" required placeholder="Que obra faz parte da sua jornada?" [attr.aria-invalid]="submitted() && !title.trim()" [disabled]="busy()"></div>
      <fieldset class="category-fieldset"><legend>Categoria</legend><div class="category-options">@for (item of categories; track item.value) {<label class="category-option" [class.selected]="category === item.value" [attr.data-category]="item.value"><input type="radio" name="category" [value]="item.value" [(ngModel)]="category" required [disabled]="busy()"><span aria-hidden="true">{{item.icon}}</span>{{item.singular}}</label>}</div></fieldset>
      @if (previousEntryId) {<p class="notice">Uma nova passagem por esta obra. Sua experiência anterior continua guardada.</p>}
      <div class="field"><label for="journey-status">Em que momento você está?</label><select id="journey-status" name="status" [(ngModel)]="status" [disabled]="busy()">@for (option of statuses; track option.value) {<option [value]="option.value">{{option.label}}</option>}</select><p class="field-help">Tudo bem pausar ou deixar uma obra para depois. Você pode retomar quando quiser.</p></div>
      <div class="field"><label for="journey-reason">Por que quis começar? <span class="muted">(opcional)</span></label><textarea id="journey-reason" name="reason" [(ngModel)]="reason" [maxlength]="reasonMaxLength" rows="3" [disabled]="busy()" placeholder="Uma indicação, uma curiosidade, uma vontade…" aria-describedby="reason-count"></textarea><span id="reason-count" class="field-help character-count">{{reason.length}} / {{reasonMaxLength}}</span></div>
      @if (status !== 'completed') {<div class="field"><label for="journey-resume">De onde parei <span class="muted">(opcional)</span></label><input id="journey-resume" name="resumePoint" [(ngModel)]="resumePoint" [maxlength]="resumeMaxLength" [disabled]="busy()" placeholder="Capítulo 8, episódio 3, próxima missão…"><p class="field-help">Uma lembrança simples para facilitar sua próxima visita.</p></div>}
      <fieldset class="rating-fieldset"><legend>Sua nota {{status === 'completed' ? '' : '(opcional durante a jornada)'}}</legend><p class="field-help">{{status === 'completed' ? 'Agora que terminou, como foi a experiência? Escolha de 1 a 5.' : 'Você pode deixar a avaliação para quando terminar.'}}</p><div class="rating-options">@for (value of ratings; track value) {<label class="rating-option" [class.selected]="rating === value"><input type="radio" name="rating" [value]="value" [(ngModel)]="rating" [disabled]="busy()" [required]="status === 'completed'"><span aria-hidden="true">★</span><span>{{value}}</span></label>}</div>@if (rating && status !== 'completed') {<button class="button ghost small" type="button" [disabled]="busy()" (click)="rating = null">Avaliar depois</button>}</fieldset>
      <section class="journey-notes" aria-labelledby="journey-notes-title"><h2 id="journey-notes-title">Durante o caminho</h2><p class="field-help">Guarde impressões ao longo da experiência. As notas são públicas e só serão gravadas ao salvar a jornada.</p>
        <ol class="journey-timeline">@for (note of notes; track note.id) {<li><time [attr.datetime]="note.createdAt | date:'yyyy-MM-ddTHH:mm:ss'">{{note.createdAt | date:'dd/MM/yyyy HH:mm'}}</time>@if (note.containsSpoilers) {<span class="category-pill">Contém spoilers</span>}<p>{{note.text}}</p><button type="button" class="button ghost small" [disabled]="busy()" (click)="removeNote(note.id)">Remover nota</button></li>}</ol>
        <div class="field"><label for="journey-note">Uma impressão de agora <span class="muted">(opcional)</span></label><textarea id="journey-note" name="noteDraft" [(ngModel)]="noteDraft" [maxlength]="noteMaxLength" rows="3" [disabled]="busy() || notes.length >= maxNotes" placeholder="O que chamou sua atenção neste momento?" aria-describedby="note-count"></textarea><span id="note-count" class="field-help character-count">{{noteDraft.length}} / {{noteMaxLength}} · {{notes.length}} de {{maxNotes}} notas</span></div>
        <label class="note-spoiler"><input type="checkbox" name="noteSpoilers" [(ngModel)]="noteSpoilers" [disabled]="busy()"> Esta nota contém spoilers</label><button type="button" class="button secondary small" [disabled]="busy() || !noteDraft.trim() || notes.length >= maxNotes" (click)="addNote()">Adicionar à jornada</button>
        @if (notes.length >= maxNotes) {<p class="field-help">Você atingiu o limite de {{maxNotes}} notas nesta experiência.</p>}
      </section>
      @if (status === 'completed' && reason.trim()) {<section class="expectation-recall"><h2>Você começou esperando isto</h2><p>{{reason}}</p><p class="field-help">O que encontrou? Conte na reflexão abaixo.</p></section>}
      <fieldset class="feelings-fieldset" aria-describedby="feelings-help feelings-count"><legend>Como você se sentiu? <span class="muted">(opcional)</span></legend><p class="field-help" id="feelings-help">Escolha até {{maxFeelings}} sentimentos que combinam com sua experiência.</p><div class="feeling-options">@for (feeling of feelingsOptions; track feeling.value) {<label class="feeling-option" [class.selected]="feelings.includes(feeling.value)"><input type="checkbox" name="feeling-{{feeling.value}}" [checked]="feelings.includes(feeling.value)" (change)="toggleFeeling(feeling.value)" [disabled]="busy() || (feelings.length >= maxFeelings && !feelings.includes(feeling.value))">{{feeling.label}}</label>}</div><p class="field-help" id="feelings-count" aria-live="polite">{{feelings.length}} de {{maxFeelings}} selecionados</p></fieldset>
      <div class="field"><label for="entry-reflection">O que ficou com você? <span class="muted">(opcional)</span></label><p class="field-help" id="reflection-help">{{prompt(category)}} Uma impressão curta ou uma reflexão maior: esse espaço é seu.</p><textarea id="entry-reflection" name="reflection" [(ngModel)]="reflection" [maxlength]="reflectionMaxLength" rows="7" placeholder="Conte com suas palavras…" [disabled]="busy()" aria-describedby="reflection-help reflection-count"></textarea><span class="field-help character-count" id="reflection-count">{{reflection.length}} / {{reflectionMaxLength}}</span></div>
      <div class="field"><label for="entry-quote">Uma frase para guardar <span class="muted">(opcional)</span></label><textarea id="entry-quote" name="quote" [(ngModel)]="quote" maxlength="500" rows="3" placeholder="Uma citação da obra que merece ficar." [disabled]="busy()" aria-describedby="quote-count"></textarea><span class="field-help character-count" id="quote-count">{{quote.length}} / 500</span></div>
      <div class="spoiler-setting"><label><input type="checkbox" name="containsSpoilers" aria-describedby="spoiler-help" [(ngModel)]="containsSpoilers" [disabled]="busy()"> Meu texto contém spoilers</label><p class="field-help" id="spoiler-help">A reflexão e a frase ficam ocultas nos cartões até a pessoa escolher ler. O título, a nota e os sentimentos continuam visíveis.</p></div>
      <p class="field-help public-note"><span aria-hidden="true">◉</span> Sua jornada, motivo, ponto de retomada e notas ficam no seu perfil público. Os avisos de spoiler apenas ocultam a leitura; não tornam o texto privado.</p>
      <div class="button-row"><button class="button primary" type="submit" [disabled]="busy()">{{busy() ? 'Salvando…' : entryId ? 'Salvar alterações' : 'Guardar experiência'}}</button><a class="button secondary" [routerLink]="queueId ? '/queue' : '/diary'" [attr.aria-disabled]="busy()" (click)="busy() && $event.preventDefault()">Cancelar</a></div>
    </form>
  }
  @if (loadFailed()) {<a class="button secondary" routerLink="/diary">Voltar ao diário</a>}
  </div>
`})
export class EntryPage {
  private auth = inject(AuthService); private data = inject(DataService); private route = inject(ActivatedRoute); private router = inject(Router);
  categories = CATEGORIES; ratings = [1, 2, 3, 4, 5] as const;
  feelingsOptions = FEELINGS; maxFeelings = MAX_FEELINGS; reflectionMaxLength = REFLECTION_MAX_LENGTH; prompt = reflectionPrompt;
  reflection = ''; feelings: Feeling[] = []; containsSpoilers = false;
  title = ''; category: Category | '' = ''; rating: Rating | null = null; quote = '';
  statuses = JOURNEY_STATUSES; status: JourneyStatus = 'completed'; reason = ''; resumePoint = ''; notes: JourneyNote[] = [];
  noteDraft = ''; noteSpoilers = false; reasonMaxLength = JOURNEY_REASON_MAX_LENGTH; resumeMaxLength = RESUME_POINT_MAX_LENGTH;
  noteMaxLength = JOURNEY_NOTE_MAX_LENGTH; maxNotes = MAX_JOURNEY_NOTES; private expectedUpdatedAt?: number;
  previousEntryId = this.route.snapshot.queryParamMap.get('revisit') || undefined;
  entryId = this.route.snapshot.paramMap.get('id') || undefined;
  queueId = this.route.snapshot.queryParamMap.get('queue') || undefined;
  saved = signal(false); loading = signal(false); busy = signal(false); error = signal(''); submitted = signal(false); loadFailed = signal(false);
  constructor() { if (this.route.snapshot.queryParamMap.get('start') === '1' || this.previousEntryId) this.status = 'in_progress'; void this.initialize(); }
  async initialize() {
    if (!this.entryId && !this.queueId && !this.previousEntryId) return;
    this.loading.set(true);
    try {
      await this.auth.ready;
      if (this.entryId) {
        const entry = await this.data.getEntry(this.entryId);
        if (!entry || entry.authorId !== this.auth.user()?.uid) throw new Error('entry-unavailable');
        this.title = entry.title; this.category = entry.category; this.rating = entry.rating; this.quote = entry.quote ?? '';
        this.reflection = entry.reflection ?? ''; this.feelings = [...(entry.feelings ?? [])]; this.containsSpoilers = entry.containsSpoilers ?? false;
        this.status = journeyStatus(entry); this.reason = entry.reason ?? ''; this.resumePoint = entry.resumePoint ?? '';
        this.notes = (entry.notes ?? []).map(note => ({...note})); this.expectedUpdatedAt = entry.updatedAt;
        this.previousEntryId = entry.previousEntryId || undefined; this.queueId = undefined;
      } else if (this.queueId) {
        const item = (await this.data.queue()).find(item => item.id === this.queueId);
        if (!item) throw new Error('queue-unavailable');
        this.title = item.title; this.category = item.category; this.reason = item.reason ?? ''; this.previousEntryId = undefined;
      } else if (this.previousEntryId) {
        const source = await this.data.getEntry(this.previousEntryId);
        if (!source || source.authorId !== this.auth.user()?.uid) throw new Error('entry-unavailable');
        this.title = source.title; this.category = source.category; this.status = 'in_progress';
      }
    } catch (error) {this.loadFailed.set(true); this.error.set(dataErrorMessage(error, 'Não foi possível abrir este registro ou item da fila. Confira o link e tente novamente.'));} finally {this.loading.set(false);}
  }
  addNote(): boolean {
    if (this.busy()) return false;
    const text = this.noteDraft.trim();
    if (!text || text.length > this.noteMaxLength || this.notes.length >= this.maxNotes) {
      this.error.set(`Escreva uma nota de até ${this.noteMaxLength} caracteres. Cada experiência aceita até ${this.maxNotes} notas.`);
      return false;
    }
    this.notes = [...this.notes, {id: crypto.randomUUID(), text, createdAt: Date.now(), containsSpoilers: this.noteSpoilers}];
    this.noteDraft = ''; this.noteSpoilers = false; this.error.set(''); return true;
  }
  removeNote(id: string) {if (!this.busy()) this.notes = this.notes.filter(note => note.id !== id);}
  toggleFeeling(feeling: Feeling) {
    if (this.busy()) return;
    if (this.feelings.includes(feeling)) this.feelings = this.feelings.filter(value => value !== feeling);
    else if (this.feelings.length < this.maxFeelings) this.feelings = [...this.feelings, feeling];
  }
  async save() {
    if (this.busy() || this.saved()) return;
    this.submitted.set(true); this.error.set('');
    if (!this.title.trim() || this.title.trim().length > 160) {this.error.set('Informe um título com até 160 caracteres.'); document.getElementById('entry-title')?.focus(); return;}
    if (!this.category) {this.error.set('Escolha uma categoria.'); document.querySelector<HTMLInputElement>('input[name="category"]')?.focus(); return;}
    if ((this.status === 'completed' && this.rating === null) || (this.rating !== null && (!Number.isInteger(this.rating) || this.rating < 1 || this.rating > 5))) {this.error.set('Escolha uma nota inteira de 1 a 5.'); document.querySelector<HTMLInputElement>('input[name="rating"]')?.focus(); return;}
    if (this.quote.length > 500) {this.error.set('Use até 500 caracteres para a frase.'); document.getElementById('entry-quote')?.focus(); return;}
    if (this.reflection.trim().length > this.reflectionMaxLength) {this.error.set(`Use até ${this.reflectionMaxLength} caracteres para sua reflexão.`); document.getElementById('entry-reflection')?.focus(); return;}
    if (this.reason.trim().length > this.reasonMaxLength || this.resumePoint.trim().length > this.resumeMaxLength) {this.error.set('Revise o limite do motivo e do ponto de retomada.'); return;}
    if (this.noteDraft.trim() && !this.addNote()) return;
    this.busy.set(true);
    try {
      await this.data.saveEntry({title: this.title.trim(), category: this.category, rating: this.rating, quote: this.quote.trim(), reflection: this.reflection.trim(), feelings: [...this.feelings], containsSpoilers: this.containsSpoilers, status: this.status, reason: this.reason.trim(), resumePoint: this.resumePoint.trim(), notes: this.notes.map(note => ({...note})), previousEntryId: this.previousEntryId, expectedUpdatedAt: this.expectedUpdatedAt}, this.entryId, this.queueId);
      this.saved.set(true);
    } catch (error) {this.error.set(dataErrorMessage(error, 'Não foi possível salvar. Seu texto continua aqui; tente novamente.'));}
    finally {this.busy.set(false);}
    if (this.saved()) {try {await this.router.navigate(['/diary']);} catch { /* The saved state provides a link without resubmitting the write. */ }}
  }
}
