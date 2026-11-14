import { SkeletonCard } from '../shared/skeleton-card';
import { DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../core/auth.service';
import { DataService } from '../core/data.service';
import { CATEGORIES, ConsumptionEntry, QueueItem } from '../core/models';
import { BADGES } from '../core/engagement';
import { suggestQueue } from '../core/monthly-summary';
import { dataErrorMessage } from '../core/data-error';

@Component({selector: 'app-engagement-panel', standalone: true, imports: [RouterLink, DatePipe, SkeletonCard], template: `
  @if (loading()) {<div role="status" aria-label="Preparando suas próximas histórias" class="skeleton-list"><app-skeleton-card/><app-skeleton-card/></div>}
  @if (error()) {<p class="error" role="alert">{{error()}} <button class="button ghost" (click)="load()">Tentar novamente</button></p>}
  @if (!loading() && !error()) {
    <div class="engagement-grid">
      <section class="panel streak"><span class="eyebrow">UM DIA DE CADA VEZ</span><h2><span aria-hidden="true">✦</span> {{streak()}} {{streak() === 1 ? 'dia' : 'dias'}} de histórias</h2><p>Uma experiência, uma nota ou algo novo na fila: tudo conta.</p></section>
      <section class="panel"><span class="eyebrow">O QUE FAZER AGORA?</span>@if (suggestion(); as item) {<p class="category-pill" [attr.data-category]="item.category">{{category(item.category)?.icon}} {{category(item.category)?.label}}</p><h2>{{item.title}}</h2><a class="button primary" routerLink="/entry/new" [queryParams]="{queue: item.id, start: '1'}">Começar agora</a>} @else {<h2>Sua fila está livre — o que vai entrar primeiro?</h2><a class="button secondary" routerLink="/queue">Adicionar à fila</a>}</section>
    </div>
    @if (history().length) {<section aria-labelledby="history-title"><h2 id="history-title">Neste dia…</h2><div class="history-grid">@for (entry of history(); track entry.id) {<a class="panel history-card" [routerLink]="['/entry', entry.id, 'edit']"><span class="category-pill" [attr.data-category]="entry.category">{{category(entry.category)?.icon}} {{category(entry.category)?.label}}</span><h3>{{entry.title}}</h3><p>{{entry.rating ? entry.rating + ' de 5' : 'Uma jornada para lembrar'}}</p>@if (entry.quote && !entry.containsSpoilers) {<blockquote>“{{entry.quote}}”</blockquote>}<time>{{entry.createdAt | date:'dd/MM/yyyy'}}</time></a>}</div></section>}
  }
  <dialog #celebration class="celebration" (close)="dismiss()" aria-labelledby="celebration-title"><span class="celebration-icon" aria-hidden="true">✦</span><h2 id="celebration-title">{{celebrationTitle()}}</h2><p>{{celebrationText()}}</p><button class="button primary" type="button" (click)="celebration.close()">Continuar minha história</button></dialog>
`, styles: [`:host{display:block;margin-bottom:24px}.engagement-grid,.history-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px}.streak{background:#e6ece3}.streak h2{font-size:30px}.history-card{color:inherit;text-decoration:none;overflow-wrap:anywhere}.history-card h3{font:24px Georgia,serif}.history-card blockquote{margin:12px 0}.celebration{background:#fffefa;color:#213c33;border:1px solid #d9ded3;border-radius:16px;padding:32px;max-width:min(460px,calc(100vw - 32px));text-align:center}.celebration::backdrop{background:#213c3380}.celebration-icon{font-size:48px;color:#a94732}h2{overflow-wrap:anywhere}@media(max-width:600px){.engagement-grid,.history-grid{grid-template-columns:1fr}.celebration{padding:24px}}`]
})
export class EngagementPanel {
  private readonly auth = inject(AuthService); private readonly data = inject(DataService);
  readonly loading = signal(false); readonly error = signal(''); readonly entries = signal<ConsumptionEntry[]>([]); readonly queue = signal<QueueItem[]>([]); readonly history = signal<ConsumptionEntry[]>([]); readonly streak = signal(0);
  readonly suggestion = computed(() => suggestQueue(this.entries(), this.queue()));
  readonly celebrationTitle = signal(''); readonly celebrationText = signal('');
  private pending: {title: string; text: string}[] = [];
  constructor() {void this.load();}
  category(value: string) {return CATEGORIES.find(item => item.value === value);}
  async load(): Promise<void> {
    if (this.loading()) return;
    this.loading.set(true); this.error.set('');
    try {
      await this.auth.ready;
      const [entries, queue, history] = await Promise.all([this.data.allEntries(), this.data.queue(), this.data.historyEntries()]);
      this.entries.set(entries); this.queue.set(queue); this.history.set(history);
      const result = await this.data.syncEngagement(entries, queue); this.streak.set(result.streakCount);
      const uid = this.auth.user()?.uid ?? '';
      if (result.broken && !this.stored('session', 'viveu-return-' + uid)) {this.pending.push({title:'Sua estante sentiu sua falta',text:'Tudo bem dar uma pausa. A próxima história pode começar hoje.'}); this.remember('session', 'viveu-return-' + uid);}
      if ([7,30,100].includes(result.streakCount) && !this.stored('local', `viveu-streak-${uid}-${result.streakCount}`)) {this.pending.push({title:`${result.streakCount} dias de boas histórias!`,text:'Seu repertório ganhou um capítulo por dia. Que bom ter você por aqui.'}); this.remember('local', `viveu-streak-${uid}-${result.streakCount}`);}
      for (const badge of result.newBadges) this.pending.push({title:'Uma nova conquista para sua história',text:this.badgeName(badge)});
      setTimeout(() => this.showNext());
    } catch (error) {this.error.set(dataErrorMessage(error, 'Não foi possível preparar suas histórias. Tente novamente.'));}
    finally {this.loading.set(false);}
  }
  private stored(kind: 'local' | 'session', key: string): boolean {try {return !!(kind === 'local' ? localStorage : sessionStorage).getItem(key);} catch {return false;}}
  private remember(kind: 'local' | 'session', key: string): void {try {(kind === 'local' ? localStorage : sessionStorage).setItem(key, '1');} catch { /* A blocked browser store must not prevent the diary from loading. */ }}
  private badgeName(id: string): string {const badge = BADGES.find(item => item.id === id); return badge ? `${badge.icon} ${badge.name} — ${badge.description}` : id;}
  dismiss(): void {if (!this.pending.length) this.data.acknowledgeBadges(); this.showNext();}
  private showNext(): void {const next = this.pending.shift(); if (!next) return; this.celebrationTitle.set(next.title); this.celebrationText.set(next.text); document.querySelector<HTMLDialogElement>('app-engagement-panel dialog')?.showModal();}
}
