import { Component, HostListener, computed, inject, input, signal } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../core/auth.service';
import { DataService } from '../core/data.service';
import { Category, ConsumptionEntry } from '../core/models';
import { normalizeTitle } from '../core/discovery';
import { dataErrorMessage } from '../core/data-error';

interface Suggestion {friendUid:string;friendName:string;title:string;category:Category;}
@Component({selector:'app-shared-memory-suggestions',standalone:true,template:`
@if(suggestion();as item){<section class="panel memory-suggestion"><span class="eyebrow">UMA OBRA EM COMUM</span><h2>{{item.friendName}} também registrou “{{item.title}}”</h2><p>Quer abrir uma memória privada para trocar impressões?</p>@if(error()){<p class="error" role="alert">{{error()}}</p>}<div class="button-row"><button class="button secondary" type="button" [disabled]="busy()" (click)="dismiss(item)">Agora não</button><button class="button primary" type="button" [disabled]="busy()" (click)="create(item)">{{busy()?'Criando…':'Criar memória'}}</button></div></section>}
`,styles:[`:host{display:block}.memory-suggestion{margin:16px 0}.memory-suggestion h2{font-size:24px}.memory-suggestion p{margin-bottom:14px}@media(max-width:480px){.memory-suggestion .button-row{flex-direction:column}.memory-suggestion .button{width:100%}}`]})
export class SharedMemorySuggestions {
  readonly friendEntries=input<ConsumptionEntry[]>([]);private readonly auth=inject(AuthService);private readonly data=inject(DataService);private readonly router=inject(Router);
  readonly ownEntries=signal<ConsumptionEntry[]>([]);readonly busy=signal(false);readonly error=signal('');readonly ignored=signal<string[]>([]);
  readonly suggestion=computed(()=>{for(const friend of this.friendEntries()){if(friend.authorId===this.auth.user()?.uid)continue;const own=this.ownEntries().find(entry=>entry.category===friend.category&&normalizeTitle(entry.title)===normalizeTitle(friend.title));if(!own)continue;const key=this.key(friend);if(!this.ignored().includes(key))return {friendUid:friend.authorId,friendName:friend.author.displayName,title:friend.title,category:friend.category};}return null;});
  constructor(){void this.load();}
  @HostListener('window:viveu-entry-saved') refreshOwnEntries(){void this.load();}
  private key(friend:ConsumptionEntry){return `${friend.authorId}:${friend.category}:${normalizeTitle(friend.title)}`;}
  async load(){try{await this.auth.ready;this.ownEntries.set(await this.data.allEntries());}catch{/* Discovery stays quiet when local history is unavailable. */}}
  dismiss(item:Suggestion){this.ignored.update(keys=>[...keys,this.key({authorId:item.friendUid,category:item.category,title:item.title} as ConsumptionEntry)]);}
  async create(item:Suggestion){if(this.busy())return;this.busy.set(true);this.error.set('');try{const id=await this.data.createSharedMemory({participantUid:item.friendUid,workTitle:item.title,workCategory:item.category});await this.router.navigate(['/memory',id]);}catch(error){this.error.set(dataErrorMessage(error,'Não foi possível criar a memória. Tente novamente.'));}finally{this.busy.set(false);}}
}
