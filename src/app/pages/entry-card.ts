import { Component, computed, input, output, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { categoryLabel, ConsumptionEntry, FEELINGS, journeyStatusLabel, JourneyNote } from '../core/models';

@Component({
  selector: 'app-entry-card', standalone: true, imports: [DatePipe, RouterLink],
  template: `
    <article class="panel entry-card">
      <div class="entry-meta">
        <a class="author-link" [routerLink]="['/u', entry().authorId]">
          <span class="avatar avatar-small" aria-hidden="true">{{entry().author.displayName.slice(0, 1).toUpperCase()}}</span>
          <span>{{entry().author.displayName}}</span>
        </a>
        <time [attr.datetime]="entry().createdAt | date:'yyyy-MM-dd'">{{entry().createdAt | date:'dd/MM/yyyy'}}</time>
      </div>
      <div class="entry-body">
        <span class="category-pill" [attr.data-category]="entry().category">{{label(entry().category)}}</span>
        <span class="journey-status">{{statusLabel(entry().status)}}</span>
        @if (entry().previousEntryId) {<span class="journey-status">Revisitando esta obra</span>}
        <h2>{{entry().title}}</h2>
        @if (entry().rating; as rating) {<p class="rating" [attr.aria-label]="rating + ' de 5 estrelas'"><span aria-hidden="true">{{'★'.repeat(rating)}}<span class="muted">{{'☆'.repeat(5 - rating)}}</span></span><span class="rating-number" aria-hidden="true">{{rating}} / 5</span></p>}
        @if (entry().reason) {<div class="journey-context"><h3>Por que quis começar</h3><p>{{entry().reason}}</p></div>}
        @if (entry().resumePoint && entry().status !== 'completed') {<p class="journey-resume">De onde parei: {{entry().resumePoint}}</p>}
        @if (entry().startedAt || entry().completedAt) {<p class="field-help journey-dates">@if (entry().startedAt) {Começou em {{entry().startedAt | date:'dd/MM/yyyy'}}}@if (entry().startedAt && entry().completedAt) { · }@if (entry().completedAt) {Terminou em {{entry().completedAt | date:'dd/MM/yyyy'}}}</p>}
        @if (entry().feelings?.length) {
          <ul class="entry-feelings" aria-label="Sentimentos desta experiência">@for (feeling of entry().feelings; track feeling) {<li>{{feelingLabel(feeling)}}</li>}</ul>
        }
        @if (entry().reflection || entry().quote) {
          @if (entry().containsSpoilers) {
            <div class="spoiler-warning"><p>Este texto contém spoilers.</p><button class="button secondary small" type="button" (click)="toggleSpoilers()" [attr.aria-expanded]="textVisible()" [attr.aria-controls]="'entry-text-' + entry().id">{{textVisible() ? 'Ocultar spoilers' : 'Ler mesmo assim'}}</button></div>
          }
          <div [id]="'entry-text-' + entry().id">
            @if (textVisible()) {
              @if (entry().reflection) {<div class="entry-reflection"><h3>O que ficou</h3><p>{{entry().reflection}}</p></div>}
              @if (entry().quote) { <blockquote>{{entry().quote}}</blockquote> }
            }
          </div>
        }
        @if (entry().notes?.length) {<details class="journey-notes"><summary>Durante o caminho · {{entry().notes?.length}} notas</summary><ol class="journey-timeline">@for (note of entry().notes; track note.id) {<li><time [attr.datetime]="note.createdAt | date:'yyyy-MM-ddTHH:mm:ss'">{{note.createdAt | date:'dd/MM/yyyy HH:mm'}}</time>@if (note.containsSpoilers) {<button class="button secondary small" type="button" (click)="toggleNote(note)" [attr.aria-expanded]="noteVisible(note)" [attr.aria-controls]="'journey-note-' + entry().id + '-' + note.id">{{noteVisible(note) ? 'Ocultar spoiler da nota' : 'Ler nota com spoiler'}}</button>}<div [id]="'journey-note-' + entry().id + '-' + note.id">@if (noteVisible(note)) {<p>{{note.text}}</p>}</div></li>}</ol></details>}
      </div>
      @if (editable()) {
        <div class="entry-actions">
          <a class="button ghost" [routerLink]="['/entry', entry().id, 'edit']">{{entry().status === 'in_progress' || entry().status === 'paused' ? 'Continuar jornada' : 'Editar'}}</a>
          @if (!entry().status || entry().status === 'completed' || entry().status === 'abandoned') {<a class="button ghost" routerLink="/entry/new" [queryParams]="{revisit: entry().id}">Viver novamente</a>}
          <button class="button ghost danger" type="button" (click)="requestRemove($event)" [disabled]="busy()">Excluir</button>
        </div>
      }
    </article>
  `,
})
export class EntryCard {
  entry = input.required<ConsumptionEntry>();
  editable = input(false);
  busy = input(false);
  private revealedText = signal('');
  private revealedNotes = signal<string[]>([]);
  private noteKey(note: JourneyNote) {return JSON.stringify([this.entry().id, note.id, note.text, note.containsSpoilers]);}
  noteVisible(note: JourneyNote) {return !note.containsSpoilers || this.revealedNotes().includes(this.noteKey(note));}
  toggleNote(note: JourneyNote) {
    const key = this.noteKey(note);
    this.revealedNotes.set(this.revealedNotes().includes(key) ? this.revealedNotes().filter(value => value !== key) : [...this.revealedNotes(), key]);
  }
  private textKey = computed(() => JSON.stringify([this.entry().id, this.entry().reflection, this.entry().quote, this.entry().containsSpoilers]));
  textVisible = computed(() => !this.entry().containsSpoilers || this.revealedText() === this.textKey());
  toggleSpoilers() {this.revealedText.set(this.textVisible() ? '' : this.textKey());}
  feelingLabel(value: string) {return FEELINGS.find(feeling => feeling.value === value)?.label ?? value;}
  remove = output<{entry: ConsumptionEntry; trigger: HTMLElement}>();
  requestRemove(event: MouseEvent) {this.remove.emit({entry: this.entry(), trigger: event.currentTarget as HTMLElement});}
  label = categoryLabel;
  statusLabel = journeyStatusLabel;
}
