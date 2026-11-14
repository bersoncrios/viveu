import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../core/auth.service';
import { DataService } from '../core/data.service';
import { dataErrorMessage } from '../core/data-error';
import { CATEGORIES, ConsumptionEntry, journeyStatusLabel } from '../core/models';

@Component({
  selector: 'app-active-journeys', standalone: true, imports: [RouterLink],
  template: `
    <section class="active-journeys" aria-labelledby="active-journeys-title">
      <div class="section-heading"><h2 id="active-journeys-title">Continuar minha jornada</h2><a class="button secondary small" routerLink="/entry/new" [queryParams]="{start: '1'}">Começar uma obra</a></div>
      @if (loading()) {<p class="field-help" role="status">Buscando suas jornadas…</p>}
      @if (error()) {<p class="error" role="alert">{{error()}} <button class="button ghost" type="button" [disabled]="loading()" (click)="load()">Tentar novamente</button></p>}
      @if (!loading() && !error() && !items().length) {<div class="panel journey-empty"><p>Tem uma história acontecendo agora?</p><p class="field-help">Comece uma obra aqui ou escolha algo da sua fila para acompanhar o caminho.</p><a class="button ghost small" routerLink="/queue">Escolher da minha fila →</a></div>}
      <ul class="active-journey-list">@for (item of items(); track item.id) {<li><a class="panel active-journey" [routerLink]="['/entry', item.id, 'edit']"><span class="category-pill" [attr.data-category]="item.category">{{category(item.category)?.icon}} {{category(item.category)?.singular}}</span><span class="journey-status">{{statusLabel(item.status)}}</span><strong>{{item.title}}</strong>@if (item.resumePoint) {<span class="journey-resume">De onde parei: {{item.resumePoint}}</span>}<span class="friend-profile-link">{{item.status === 'paused' ? 'Retomar e anotar' : 'Continuar e anotar'}} →</span></a></li>}</ul>
      @if (items().length === 20) {<p class="field-help">Mostrando as 20 jornadas atualizadas mais recentemente. <a routerLink="/diary">Ver todo o diário</a></p>}
    </section>
  `,
})
export class ActiveJourneys {
  private auth = inject(AuthService); private data = inject(DataService);
  items = signal<ConsumptionEntry[]>([]); loading = signal(false); error = signal(''); statusLabel = journeyStatusLabel;
  category(value: string) {return CATEGORIES.find(item => item.value === value);}
  constructor() {void this.load();}
  async load() {
    if (this.loading()) return;
    this.loading.set(true); this.error.set('');
    try {await this.auth.ready; this.items.set(await this.data.activeJourneys());}
    catch (error) {this.error.set(dataErrorMessage(error, 'Não foi possível carregar suas jornadas.'));}
    finally {this.loading.set(false);}
  }
}
