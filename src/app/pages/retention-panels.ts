import { Component, Input, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DataService } from '../core/data.service';
import { ConsumptionEntry, Following, QueueItem } from '../core/models';
import { daysSinceActivity, monthlyFriendRanking, oldestQueueItem } from '../core/retention-ranking';

@Component({selector: 'app-retention-panels', standalone: true, imports: [RouterLink], template: `
  @if (returnCardVisible()) {
    <section class="panel return-card" aria-labelledby="return-title">
      <span class="eyebrow">QUE BOM TER VOCÊ DE VOLTA</span>
      @if (returnItem(); as item) {
        <h2 id="return-title">Faz {{inactiveDays()}} {{inactiveDays() === 1 ? 'dia' : 'dias'}} que {{item.title}} está esperando por você.</h2>
        <p>Uma história pode recomeçar no seu tempo.</p>
        <a class="button primary" [routerLink]="['/entry/new']" [queryParams]="{queue: item.id, start: '1'}">Começar agora</a>
      } @else if (queueLoaded() && !queueError()) {
        <h2 id="return-title">Bem-vindo de volta! Que tal adicionar algo novo à sua fila?</h2>
        <a class="button primary" routerLink="/queue">Adicionar à fila</a>
      } @else if (queueError()) {
        <h2 id="return-title">Bem-vindo de volta!</h2><p role="status">Não foi possível carregar sua fila agora.</p>
      } @else {
        <h2 id="return-title">Bem-vindo de volta! Estamos preparando sua próxima história…</h2>
      }
      <button class="button ghost" type="button" (click)="dismiss()">Depois</button>
    </section>
  }
  <section class="panel ranking" aria-labelledby="ranking-title">
    <span class="eyebrow">UM OLHAR AMIGO</span><h2 id="ranking-title">Ranking cultural · {{monthLabel}}</h2>
    @if (!followed.length) {<p>Siga amigos para ver o ranking.</p>} @else {
      <div class="ranking-grid">
        <section aria-label="Mais registros"><h3>🏆 Mais obras</h3><ol>@for (row of ranking.registrations; track row.uid) {<li [class.you]="row.isCurrentUser"><span>{{row.name}}{{row.isCurrentUser ? ' (você)' : ''}}</span><strong>{{row.value}}</strong></li>}</ol></section>
        <section aria-label="Maior sequência"><h3>🔥 Maior sequência</h3><ol>@for (row of ranking.streak; track row.uid) {<li [class.you]="row.isCurrentUser"><span>{{row.name}}{{row.isCurrentUser ? ' (você)' : ''}}</span><strong>{{row.value}} {{row.value === 1 ? 'dia' : 'dias'}}</strong></li>}</ol></section>
        <section aria-label="Categorias exploradas"><h3>🗺️ Mais categorias</h3><ol>@for (row of ranking.categories; track row.uid) {<li [class.you]="row.isCurrentUser"><span>{{row.name}}{{row.isCurrentUser ? ' (você)' : ''}}</span><strong>{{row.value}}</strong></li>}</ol></section>
      </div>
      <p class="field-help">Calculado com os registros deste mês já carregados no feed.</p>
    }
  </section>
`, styles: [`:host{display:grid;gap:16px;margin:0 0 24px}.return-card{background:var(--surface-raised,#e6ece3)}.return-card h2{max-width:38ch}.return-card .button+.button{margin-left:8px}.ranking h2{margin-top:6px}.ranking-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px}.ranking-grid section{min-width:0}.ranking-grid h3{font-size:16px}.ranking ol{margin:0;padding-left:24px}.ranking li{padding:6px 0;display:flex;justify-content:space-between;gap:8px;overflow-wrap:anywhere}.ranking li.you{font-weight:700;color:var(--accent-strong,#315f4b)}.ranking li strong{white-space:nowrap}.field-help{font-size:13px;color:var(--text-muted,#64736b)}@media(max-width:720px){.ranking-grid{grid-template-columns:1fr}.return-card .button{margin:6px 8px 0 0}}`]})
export class RetentionPanels implements OnInit {
  private readonly data = inject(DataService);
  @Input() entries: ConsumptionEntry[] = [];
  @Input() followed: Following[] = [];
  @Input() currentUid = '';
  @Input() currentName = 'Você';
  @Input() lastActivityDate: string | number | null = null;
  readonly returnCardVisible = signal(false);
  readonly returnItem = signal<QueueItem | null>(null);
  readonly queueLoaded = signal(false);
  readonly queueError = signal(false);
  readonly inactiveDays = signal(0);
  readonly now = new Date();
  readonly monthLabel = new Intl.DateTimeFormat('pt-BR', {month: 'long', year: 'numeric'}).format(this.now);
  get people(): {uid: string; name: string}[] {
    const names = new Map(this.followed.map(item => [item.uid, this.entries.find(entry => entry.authorId === item.uid)?.author.displayName || 'Pessoa seguida']));
    if (this.currentUid) names.set(this.currentUid, this.currentName || 'Você');
    return [...names].map(([uid, name]) => ({uid, name}));
  }
  get ranking() {return monthlyFriendRanking(this.entries, this.people, this.currentUid, this.now.getFullYear(), this.now.getMonth() + 1);}

  ngOnInit(): void {
    const days = daysSinceActivity(this.lastActivityDate);
    if (days === null || days < 3 || !this.currentUid) return;
    const key = `viveu-return-card-${this.currentUid}`;
    try {if (sessionStorage.getItem(key)) return; sessionStorage.setItem(key, '1');} catch { /* Keep the card usable when session storage is blocked. */ }
    this.inactiveDays.set(days);
    this.returnCardVisible.set(true);
    void this.loadOldestQueueItem();
  }
  dismiss(): void {this.returnCardVisible.set(false);}
  private async loadOldestQueueItem(): Promise<void> {
    try {this.returnItem.set(oldestQueueItem(await this.data.queue()));}
    catch {this.queueError.set(true);}
    finally {this.queueLoaded.set(true);}
  }
}
