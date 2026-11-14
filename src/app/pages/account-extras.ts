import { Component, Input, OnChanges, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../core/auth.service';
import { DataService } from '../core/data.service';
import { CATEGORIES, Category, NowWatching, UserProfile } from '../core/models';
import { buildDiaryHtml, downloadDiaryHtml } from '../core/diary-export';

@Component({selector:'app-account-extras',standalone:true,imports:[FormsModule,DatePipe],template:`
  @if (watching(); as item) {<p class="now-watching" role="status"><span aria-hidden="true">▶</span> {{item.category ? categoryIcon(item.category) : ''}} {{item.title}} <small>desde {{item.since | date:'dd/MM'}}</small></p>}
  @if (isOwner()) {
    <section class="account-extra-panel panel"><h3>Estou consumindo agora</h3>
      @if (!editing()) {@if (!watching()) {<p>Conte aos seus amigos qual história está vivendo.</p>}<div class="button-row"><button class="button secondary" type="button" (click)="startEdit()">{{watching() ? 'Atualizar' : 'Adicionar status'}}</button>@if(watching()){<button class="button ghost" type="button" (click)="clearWatching()" [disabled]="busy()">Remover</button>}</div>}
      @if(editing()){<form (ngSubmit)="saveWatching()"><label>Título<input name="nowTitle" [(ngModel)]="title" maxlength="160" required></label><label>Categoria<select name="nowCategory" [(ngModel)]="category" required><option value="">Escolha</option>@for(item of categories;track item.value){<option [value]="item.value">{{item.icon}} {{item.singular}}</option>}</select></label><p class="field-help">O status expira após sete dias.</p>@if(error()){<p class="error" role="alert">{{error()}}</p>}<div class="button-row"><button class="button primary" type="submit" [disabled]="busy()">Salvar</button><button class="button secondary" type="button" (click)="editing.set(false)">Cancelar</button></div></form>}
    </section>
    <section class="account-extra-panel panel"><h3>Seu diário, para guardar</h3><p>Baixe uma cópia HTML do seu acervo, com jornadas e notas em ordem cronológica.</p><button class="button secondary" type="button" (click)="exportDiary()" [disabled]="exporting()">{{exporting() ? 'Preparando seu diário…' : 'Exportar meu diário (.html)'}}</button>@if(exportError()){<p class="error" role="alert">{{exportError()}}</p>}</section>
    <details class="account-extra-panel panel"><summary>Preferências de notificações</summary><p class="field-help">No momento, estas preferências são salvas; alertas push ainda não são enviados.</p><label class="preference"><input type="checkbox" [(ngModel)]="prefs.enabled" name="notifEnabled"> Ativar notificações disponíveis</label><label class="preference"><input type="checkbox" [(ngModel)]="prefs.matchInQueue" name="notifQueue"> Quando amigos registrarem obras da minha fila</label><label class="preference"><input type="checkbox" [(ngModel)]="prefs.reactions" name="notifReactions"> Quando alguém reagir aos meus registros</label><label class="preference"><input type="checkbox" [(ngModel)]="prefs.streakReminder" name="notifStreak"> Lembrete de sequência</label><button class="button secondary" type="button" (click)="savePreferences()" [disabled]="busy()">Salvar preferências</button>@if(saved()){<p role="status">Preferências salvas.</p>}
    </details>
  }
`,styles:[`:host{display:block}.account-extra-panel{margin:18px 0}.account-extra-panel h3{font-size:22px}.account-extra-panel label:not(.preference){display:grid;gap:7px;margin:12px 0}.account-extra-panel input:not([type=checkbox]),.account-extra-panel select{width:100%;min-height:44px;padding:10px;border:1px solid var(--border);border-radius:8px;background:var(--surface);color:var(--ink)}.preference{display:flex;align-items:center;gap:10px;min-height:44px}.now-watching{padding:10px 14px;background:var(--primary-soft);border-radius:12px;color:var(--ink);overflow-wrap:anywhere}.now-watching small{color:var(--muted);margin-left:6px}`]})
export class AccountExtras implements OnChanges {
  @Input({required:true}) uid='';
  private readonly auth=inject(AuthService);private readonly data=inject(DataService);
  readonly profile=signal<UserProfile|null>(null);readonly watching=signal<NowWatching|null>(null);readonly isOwner=signal(false);readonly editing=signal(false);readonly busy=signal(false);readonly error=signal('');readonly saved=signal(false);readonly exporting=signal(false);readonly exportError=signal('');
  categories=CATEGORIES;title='';category:Category|''='';prefs={enabled:false,matchInQueue:false,reactions:false,streakReminder:false};
  ngOnChanges():void{void this.load();}
  categoryIcon(category:Category){return CATEGORIES.find(item=>item.value===category)?.icon??'';}
  async load(){if(!this.uid)return;this.isOwner.set(this.auth.user()?.uid===this.uid);try{const profile=await this.data.getProfile(this.uid);this.profile.set(profile);const now=profile?.nowWatching;if(now&&now.expiresAt>Date.now())this.watching.set(now);else this.watching.set(null);if(this.isOwner())this.prefs=await this.data.getNotificationPreferences();}catch{this.error.set('Não foi possível carregar estas preferências.');}}
  async exportDiary(){if(!this.isOwner()||this.exporting())return;this.exporting.set(true);this.exportError.set('');try{const entries=await this.data.allEntries(this.uid);const html=buildDiaryHtml(entries,this.profile()?.displayName??'Meu diário');downloadDiaryHtml(html,`viveu-diario-${new Date().toISOString().slice(0,10)}.html`);}catch{this.exportError.set('Não foi possível preparar seu diário agora. Tente novamente.');}finally{this.exporting.set(false);}}
  startEdit(){const item=this.watching();this.title=item?.title??'';this.category=item?.category??'';this.error.set('');this.editing.set(true);}
  async saveWatching(){if(!this.title.trim()||!this.category){this.error.set('Informe o título e a categoria.');return;}this.busy.set(true);this.error.set('');try{const value={title:this.title.trim(),category:this.category,since:Date.now(),expiresAt:Date.now()+7*86400000};await this.data.setNowWatching(value);this.watching.set(value);this.editing.set(false);}catch{this.error.set('Não foi possível atualizar seu status. Tente novamente.');}finally{this.busy.set(false);}}
  async clearWatching(){this.busy.set(true);try{await this.data.setNowWatching(null);this.watching.set(null);}catch{this.error.set('Não foi possível remover seu status.');}finally{this.busy.set(false);}}
  async savePreferences(){this.busy.set(true);this.saved.set(false);try{await this.data.setNotificationPreferences({...this.prefs});this.saved.set(true);}catch{this.error.set('Não foi possível salvar suas preferências.');}finally{this.busy.set(false);}}
}
