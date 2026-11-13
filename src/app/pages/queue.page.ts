import { dataErrorMessage } from '../core/data-error';
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthService } from '../core/auth.service';
import { DataService } from '../core/data.service';
import { CATEGORIES, Category, QueueItem, categoryLabel } from '../core/models';

@Component({selector: 'app-queue-page', standalone: true, imports: [FormsModule, RouterLink], template: `
  <header class="page-heading"><div><span class="eyebrow">MINHA FILA</span><h1 id="queue-heading" tabindex="-1">Seu próximo capítulo</h1><p class="subtitle">Organize o que você quer consumir. O primeiro item é sua próxima prioridade.</p></div></header>
  <form class="panel queue-form" #queueForm="ngForm" (ngSubmit)="add()">
    <div class="field"><label for="queue-title">Título</label><input id="queue-title" name="title" [(ngModel)]="title" required maxlength="160" placeholder="O que está na sua lista?" [disabled]="busy()"></div>
    <div class="field"><label for="queue-category">Categoria</label><select id="queue-category" name="category" [(ngModel)]="category" required [disabled]="busy()"><option value="" disabled>Escolha uma categoria</option>@for (item of categories; track item.value) {<option [value]="item.value">{{item.singular}}</option>}</select></div>
    <div class="field queue-reason"><label for="queue-reason">Por que quero começar? (opcional)</label><textarea id="queue-reason" name="reason" [(ngModel)]="reason" maxlength="500" rows="2" [disabled]="busy()" placeholder="Indicação da Júlia, conhecer esse autor…"></textarea><p class="field-help">Seu motivo acompanha a obra ao começar uma jornada pública.</p></div>
    <button class="button primary" type="submit" [disabled]="busy() || loading() || loadFailed()">{{busy() ? 'Atualizando…' : 'Adicionar à fila'}}</button>
  </form>
  @if (error()) {<div class="error" role="alert">{{error()}} @if (loadFailed()) {<button class="button ghost" type="button" (click)="load()">Tentar novamente</button>}</div>}
  <p class="notice" role="status">{{notice()}}</p>
  @if (loading()) {<p class="loading-state" role="status">Carregando sua fila…</p>}
  @if (!loading() && !items().length && !loadFailed()) {<section class="panel empty"><span class="empty-symbol" aria-hidden="true">≡</span><h2>O próximo favorito pode começar aqui.</h2><p>Adicione um título e escolha o que vem primeiro.</p></section>}
  @if (pendingRemove(); as item) {<section class="panel confirm-panel" role="region" aria-labelledby="queue-remove-title"><h2 id="queue-remove-title">Remover “{{item.title}}” da fila?</h2><div class="button-row"><button class="button secondary" type="button" id="queue-cancel-remove" (click)="cancelRemove()" [disabled]="busy()">Manter na fila</button><button class="button danger" type="button" (click)="remove()" [disabled]="busy()">Remover da fila</button></div></section>}
  <ol class="queue-list">@for (item of items(); track item.id; let index = $index; let last = $last) {
    <li class="panel queue-item"><span class="queue-position" aria-hidden="true">{{(index + 1).toString().padStart(2, '0')}}</span><div class="queue-detail"><span class="category-pill" [attr.data-category]="item.category">{{label(item.category)}}</span><h2>{{item.title}}</h2>@if (item.reason) {<p class="queue-reason-text">{{item.reason}}</p>}@if (index === 0) {<span class="eyebrow">SUA PRÓXIMA PRIORIDADE</span>}</div><div class="queue-actions"><div class="button-row"><button class="button secondary icon-button" type="button" [attr.aria-label]="'Subir ' + item.title" [disabled]="index === 0 || busy() || loadFailed()" (click)="move(index, -1)">↑</button><button class="button secondary icon-button" type="button" [attr.aria-label]="'Descer ' + item.title" [disabled]="last || busy() || loadFailed()" (click)="move(index, 1)">↓</button></div><a class="button ghost" routerLink="/entry/new" [queryParams]="{queue: item.id, start: '1'}" [attr.aria-disabled]="busy()" (click)="busy() && $event.preventDefault()">Começar jornada</a><a class="button ghost" routerLink="/together" [queryParams]="{queue: item.id}" [attr.aria-disabled]="busy()" (click)="busy() && $event.preventDefault()">Convidar amigos</a><button class="button ghost danger" type="button" [disabled]="busy()" (click)="requestRemove(item, $event)">Remover</button></div></li>
  }</ol>
`})
export class QueuePage {
  private auth = inject(AuthService); private data = inject(DataService);
  categories = CATEGORIES; label = categoryLabel;
  title = ''; category: Category | '' = ''; reason = '';
  items = signal<QueueItem[]>([]); loading = signal(false); busy = signal(false); error = signal(''); notice = signal(''); loadFailed = signal(false); pendingRemove = signal<QueueItem | null>(null);
  constructor() { void this.load(); }
  async load() {if (this.loading()) return; this.loading.set(true); this.error.set(''); this.loadFailed.set(false); try {await this.auth.ready; this.items.set(await this.data.queue());} catch (error) {this.error.set(dataErrorMessage(error, 'Não foi possível carregar sua fila.')); this.loadFailed.set(true);} finally {this.loading.set(false);}}
  private removeTrigger: HTMLElement | null = null;
  requestRemove(item: QueueItem, event: MouseEvent) {this.removeTrigger = event.currentTarget as HTMLElement; this.pendingRemove.set(item); setTimeout(() => document.getElementById('queue-cancel-remove')?.focus());}
  cancelRemove() {this.pendingRemove.set(null); this.removeTrigger?.focus();}
  async refreshAfterWrite() {try {this.items.set(await this.data.queue()); this.loadFailed.set(false);} catch (error) {this.loadFailed.set(true); this.error.set(dataErrorMessage(error, 'A alteração foi salva. Não foi possível atualizar a lista; recarregue sua fila antes de continuar.'));}}
  async add() {
    if (this.busy()) return; this.error.set(''); this.notice.set('');
    if (!this.title.trim() || this.title.trim().length > 160 || !this.category) {this.error.set('Informe um título com até 160 caracteres e escolha uma categoria.'); document.getElementById(!this.title.trim() ? 'queue-title' : 'queue-category')?.focus(); return;}
    if (this.reason.trim().length > 500) {this.error.set('Use até 500 caracteres para o motivo.'); return;}
    this.busy.set(true); try {await this.data.addQueue(this.title.trim(), this.category, this.reason.trim()); this.reason = ''; this.title = ''; this.category = ''; this.notice.set('Título adicionado à fila.'); await this.refreshAfterWrite();} catch (error) {this.error.set(dataErrorMessage(error, 'Não foi possível adicionar à fila. Tente novamente.'));} finally {this.busy.set(false);}
  }
  async move(index: number, delta: -1 | 1) {if (this.busy()) return; this.busy.set(true); this.error.set(''); this.notice.set(''); try {await this.data.moveQueue(this.items(), index, delta); this.notice.set('Ordem da fila atualizada.'); await this.refreshAfterWrite();} catch (error) {this.error.set(dataErrorMessage(error, 'Não foi possível alterar a ordem. Tente novamente.'));} finally {this.busy.set(false);}}
  async remove() {const item = this.pendingRemove(); if (!item || this.busy()) return; this.busy.set(true); this.error.set(''); try {await this.data.removeQueue(item.id); this.items.update(items => items.filter(existing => existing.id !== item.id)); this.pendingRemove.set(null); this.notice.set('Título removido da fila.'); document.getElementById('queue-heading')?.focus();} catch (error) {this.error.set(dataErrorMessage(error, 'Não foi possível remover o título. Tente novamente.'));} finally {this.busy.set(false);}}
}
