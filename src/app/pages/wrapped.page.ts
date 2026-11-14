import { SkeletonCard } from '../shared/skeleton-card';
import { DecimalPipe } from '@angular/common';
import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { AuthService } from '../core/auth.service';
import { DataService } from '../core/data.service';
import { CATEGORIES } from '../core/models';
import { monthlySummary, validWrappedMonth } from '../core/monthly-summary';
import { dataErrorMessage } from '../core/data-error';

@Component({selector: 'app-wrapped-page', standalone: true, imports: [RouterLink, DecimalPipe, SkeletonCard], template: `
  <header class="page-heading"><div><span class="eyebrow">SEU MÊS EM HISTÓRIAS</span><h1>Wrapped do Viveu</h1><p class="subtitle">Um retrato do que ficou com você em {{label()}}.</p></div></header>
  @if (loading()) {<div role="status" aria-label="Reunindo suas histórias" class="skeleton-list"><app-skeleton-card/></div>}
  @if (error()) {<p class="error" role="alert">{{error()}} <button type="button" class="button ghost" (click)="retry()">Tentar novamente</button><a class="button ghost" routerLink="/feed">Voltar ao feed</a></p>}
  @if (summary(); as month) {
    <article class="wrapped-card" aria-label="Resumo cultural do mês"><span class="eyebrow">VIVEU · {{label()}}</span><h2>Seu mês teve<br>{{month.total}} {{month.total === 1 ? 'história' : 'histórias'}}.</h2>
      <div class="stats"><div><strong>{{month.average === null ? '—' : (month.average | number:'1.1-1')}}</strong><span>nota média de 5</span></div><div><strong>{{month.maximum}}</strong><span>dias seguidos no mês</span></div></div>
      <div class="categories">@for (item of month.categories; track item.category) {<span class="category-pill" [attr.data-category]="item.category">{{category(item.category)?.icon}} {{category(item.category)?.label}} · {{item.count}}</span>}</div>
      @if (month.top; as top) {<p class="eyebrow">A OBRA MAIS BEM AVALIADA</p><h3>{{top.title}}</h3><p>{{top.rating}} de 5 · {{category(top.category)?.singular}}</p>}
      @if (month.quote; as quote) {<blockquote>“{{quote.quote}}”<cite>{{quote.title}}</cite></blockquote>}
      @if (!month.total) {<p>Um mês em branco também faz parte da história. Seu próximo capítulo está por vir.</p>}
      <footer>{{auth.profile()?.displayName || 'Meu repertório'}} · Guarde o que ficou com você.</footer>
    </article>
    <div class="button-row"><button class="button primary" type="button" [disabled]="sharing()" (click)="share()">{{sharing() ? 'Preparando imagem…' : 'Compartilhar'}}</button><button class="button secondary" type="button" [disabled]="sharing()" (click)="share(true)">Baixar PNG</button><a class="button ghost" routerLink="/feed">Voltar ao feed</a></div>
    <p role="status">{{notice()}}</p>
  }
`, styles:[`:host{display:block;max-width:820px;margin:auto}.wrapped-card{padding:40px;background:#234c3b;color:#fffefa;border-radius:24px;margin:24px 0;overflow-wrap:anywhere}.wrapped-card h2{font:48px/1.15 Georgia,serif;margin:20px 0 32px}.wrapped-card h3{font:28px Georgia,serif}.wrapped-card .eyebrow{color:#e6ece3}.stats{display:flex;gap:32px;margin-bottom:24px}.stats div{display:grid}.stats strong{font:40px Georgia,serif}.stats span{font-size:14px}.categories{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:32px}.category-pill{color:#213c33;background:#e6ece3}.wrapped-card blockquote{margin:32px 0;font:24px/1.5 Georgia,serif}.wrapped-card cite{display:block;font:14px system-ui;margin-top:8px}.wrapped-card footer{border-top:1px solid #ffffff40;padding-top:24px;font-size:14px}@media(max-width:600px){.wrapped-card{padding:24px}.wrapped-card h2{font-size:36px}.stats{gap:20px}.stats strong{font-size:32px}}`]
})
export class WrappedPage {
  readonly auth = inject(AuthService); private readonly data = inject(DataService); private readonly route = inject(ActivatedRoute);
  readonly summary = signal<ReturnType<typeof monthlySummary> | null>(null); readonly label = signal(''); readonly loading = signal(false); readonly error = signal(''); readonly sharing = signal(false); readonly notice = signal('');
  private year = 0; private month = 0; private revision = 0;
  constructor() {this.route.paramMap.pipe(takeUntilDestroyed(inject(DestroyRef))).subscribe(params => {void this.load(Number(params.get('ano')), Number(params.get('mes')));});}
  category(value: string) {return CATEGORIES.find(item => item.value === value);}
  async load(year: number, month: number): Promise<void> {
    const revision = ++this.revision; this.year = year; this.month = month; this.summary.set(null); this.error.set(''); this.notice.set('');
    if (!validWrappedMonth(year, month)) {this.loading.set(false); this.error.set('Escolha um mês que já terminou para ver seu Wrapped.'); return;}
    this.year = year; this.month = month; this.label.set(new Date(year, month - 1, 1).toLocaleDateString('pt-BR', {month:'long',year:'numeric'})); this.loading.set(true);
    try {await this.auth.ready; const [entries, activity] = await Promise.all([this.data.allEntries(), this.data.activityTimestamps()]); if (revision !== this.revision) return; this.summary.set(monthlySummary(entries, year, month, activity));}
    catch (error) {if (revision === this.revision) this.error.set(dataErrorMessage(error, 'Não foi possível reunir seu mês. Tente novamente.'));}
    finally {if (revision === this.revision) this.loading.set(false);}
  }
  retry(): void {void this.load(this.year, this.month);}
  async share(download = false): Promise<void> {
    const summary = this.summary(); if (!summary || this.sharing()) return;
    this.sharing.set(true); this.notice.set('');
    try {
      const canvas = document.createElement('canvas'); canvas.width = 1080; canvas.height = 2600;
      const ctx = canvas.getContext('2d'); if (!ctx) throw new Error('Seu navegador não conseguiu criar a imagem.');
      ctx.fillStyle = '#234c3b'; ctx.fillRect(0,0,canvas.width,canvas.height); ctx.fillStyle = '#fffefa';
      let y = 100;
      const line = (value: string, size: number, serif = false): void => {
        ctx.font = `${size}px ${serif ? 'Georgia' : 'system-ui'}`;
        let row = '';
        for (const character of value) {
          if (ctx.measureText(row + character).width > 900 && row) {ctx.fillText(row,90,y); y += size * 1.35; row = '';}
          row += character;
        }
        if (row) {ctx.fillText(row,90,y); y += size * 1.35;}
      };
      line('VIVEU · ' + this.label(), 30); y += 35; line(`Seu mês teve ${summary.total} histórias.`,72,true); y += 30;
      line(`Nota média: ${summary.average === null ? '—' : summary.average.toFixed(1)} de 5`,34); line(`${summary.maximum} dias seguidos no mês`,34); y += 30;
      for (const category of summary.categories) {ctx.fillStyle = this.category(category.category)?.color ?? '#A0AEC0'; ctx.fillRect(68,y - 24,8,30); ctx.fillStyle = '#fffefa'; line(`${this.category(category.category)?.label ?? category.category}: ${category.count}`,30);}
      if (summary.top) {y += 35; line('A OBRA MAIS BEM AVALIADA',24); line(summary.top.title,44,true);}
      if (summary.quote) {y += 30; line('“' + summary.quote.quote + '”',32,true);}
      ctx.fillStyle = '#e6ece3'; ctx.font = '24px system-ui'; ctx.fillText('Viveu · Guarde o que ficou com você.',90,y + 90);
      const output = document.createElement('canvas'); output.width = canvas.width; output.height = Math.ceil(y + 150);
      const outputContext = output.getContext('2d'); if (!outputContext) throw new Error('Não foi possível criar a imagem.'); outputContext.fillStyle = '#234c3b'; outputContext.fillRect(0,0,output.width,output.height); outputContext.drawImage(canvas,0,0);
      const blob = await new Promise<Blob>((resolve,reject) => output.toBlob(value => value ? resolve(value) : reject(new Error('Não foi possível gerar a imagem.')), 'image/png'));
      const file = new File([blob], `viveu-${this.year}-${String(this.month).padStart(2,'0')}.png`, {type:'image/png'});
      if (!download && navigator.canShare?.({files:[file]})) {await navigator.share({files:[file],title:'Meu mês no Viveu'}); this.notice.set('Seu mês ganhou companhia.');}
      else {const url = URL.createObjectURL(blob); const anchor = document.createElement('a'); anchor.href = url; anchor.download = file.name; anchor.click(); setTimeout(() => URL.revokeObjectURL(url),1000); this.notice.set('Imagem pronta para guardar e compartilhar.');}
    } catch (error) {if ((error as {name?:string})?.name !== 'AbortError') this.notice.set(dataErrorMessage(error,'Não foi possível gerar a imagem. Tente novamente.'));}
    finally {this.sharing.set(false);}
  }
}
