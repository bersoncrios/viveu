import { dataErrorMessage } from '../core/data-error';
import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../core/auth.service';
import { DataService } from '../core/data.service';
import { ConsumptionEntry } from '../core/models';
import { EntryCard } from './entry-card';
import { ActiveJourneys } from './active-journeys';

@Component({
  selector: 'app-diary-page', standalone: true, imports: [RouterLink, EntryCard, ActiveJourneys],
  template: `
    <header class="page-heading"><div><span class="eyebrow">MEU DIÁRIO</span><h1 id="diary-heading" tabindex="-1">O que ficou com você</h1><p class="subtitle">Cada experiência, uma nova página da sua história.</p></div><a class="button primary" routerLink="/entry/new"><span aria-hidden="true">＋</span> Guardar experiência</a></header>
    <app-active-journeys />
    @if (error()) { <div class="error" role="alert">{{error()}} <button class="button ghost" type="button" (click)="load(true)" [disabled]="loading()">Tentar novamente</button></div> }
    @if (notice()) { <p class="notice" role="status">{{notice()}}</p> }
    @if (pendingDelete(); as entry) {
      <section class="panel confirm-panel" role="region" aria-labelledby="delete-title" aria-describedby="delete-description">
        <h2 id="delete-title">Excluir este registro?</h2><p id="delete-description">O registro de “{{entry.title}}” será removido.</p><div class="button-row"><button class="button secondary" type="button" id="diary-cancel-delete" (click)="cancelDelete()" [disabled]="deleting()">Manter registro</button><button class="button danger" type="button" (click)="confirmDelete()" [disabled]="deleting()">{{deleting() ? 'Excluindo…' : 'Excluir registro'}}</button></div>
      </section>
    }
    @if (loading() && !entries().length) { <p role="status" class="loading-state">Carregando seu diário…</p> }
    @if (!loading() && !entries().length && !error()) {
      <section class="panel empty"><span class="empty-symbol" aria-hidden="true">▤</span><h2>Sua história cultural começa aqui.</h2><p>Registre um filme, livro ou qualquer outra experiência que você queira lembrar.</p><a class="button primary" routerLink="/entry/new">Fazer meu primeiro registro</a></section>
    }
    <div class="entry-list">@for (entry of entries(); track entry.id) { <app-entry-card [entry]="entry" [editable]="true" [busy]="deleting()" (remove)="requestDelete($event)"/> }</div>
    @if (hasMore()) { <div class="load-more"><button class="button secondary" type="button" (click)="load()" [disabled]="loading()">{{loading() ? 'Carregando…' : 'Carregar mais'}}</button></div> }
  `,
})
export class DiaryPage {
  private auth = inject(AuthService);
  private data = inject(DataService);
  entries = signal<ConsumptionEntry[]>([]);
  error = signal(''); notice = signal(''); loading = signal(false); deleting = signal(false);
  pendingDelete = signal<ConsumptionEntry | null>(null);
  hasMore = signal(false);
  private cursor: Parameters<DataService['entriesPage']>[1];
  constructor() { void this.load(true); }
  async load(reset = false) {
    if (this.loading()) return;
    this.loading.set(true); this.error.set('');
    try {
      await this.auth.ready;
      const uid = this.auth.user()?.uid;
      if (!uid) return;
      const page = await this.data.entriesPage(uid, reset ? undefined : this.cursor);
      this.cursor = page.cursor;
      this.entries.update(items => reset ? page.items : [...items, ...page.items.filter(item => !items.some(existing => existing.id === item.id))]);
      this.hasMore.set(page.hasMore);
    } catch (error) { this.error.set(dataErrorMessage(error, 'Não foi possível carregar seu diário. Tente novamente.')); }
    finally { this.loading.set(false); }
  }
  private deleteTrigger: HTMLElement | null = null;
  requestDelete(event: {entry: ConsumptionEntry; trigger: HTMLElement}) {
    this.deleteTrigger = event.trigger; this.pendingDelete.set(event.entry);
    setTimeout(() => document.getElementById('diary-cancel-delete')?.focus());
  }
  cancelDelete() {this.pendingDelete.set(null); this.deleteTrigger?.focus();}
  async confirmDelete() {
    const entry = this.pendingDelete();
    if (!entry || this.deleting()) return;
    this.deleting.set(true); this.error.set('');
    try {
      await this.data.deleteEntry(entry.id);
      this.entries.update(items => items.filter(item => item.id !== entry.id));
      this.pendingDelete.set(null); this.notice.set('Registro excluído.'); document.getElementById('diary-heading')?.focus();
    } catch (error) { this.error.set(dataErrorMessage(error, 'Não foi possível excluir o registro. Tente novamente.')); }
    finally { this.deleting.set(false); }
  }
}
