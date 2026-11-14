import {Component, effect, inject, input, signal} from '@angular/core';
import {AuthService} from '../core/auth.service';
import {DataService} from '../core/data.service';
import {EntryReaction} from '../core/models';

@Component({selector:'app-reaction-bar',standalone:true,template:`
@if(auth.user()){<div class="reaction-bar" aria-label="Reações">@for(item of options;track item.emoji){@if(counts()[item.emoji]||canReact()){<button type="button" class="reaction" [class.selected]="mine()===item.emoji" [attr.aria-pressed]="mine()===item.emoji" [attr.aria-label]="item.label + ', ' + (counts()[item.emoji]||0)" [disabled]="busy()||!canReact()" (click)="toggle(item.emoji)">{{item.emoji}} <span>{{counts()[item.emoji]||0}}</span></button>}}</div>}
@if(error()){<p class="field-help" role="alert">{{error()}}</p>}`,styles:[`:host{display:block}.reaction-bar{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px}.reaction{min-height:36px;padding:5px 10px;border:1px solid var(--border);border-radius:20px;background:var(--surface);color:var(--ink)}.reaction.selected{background:var(--primary-soft);border-color:var(--primary)}.reaction:disabled{opacity:.8}`]})
export class ReactionBar {
 readonly entryId=input.required<string>(); readonly authorId=input.required<string>();
 readonly auth=inject(AuthService);private readonly data=inject(DataService);
 readonly counts=signal<Record<string,number>>({});readonly mine=signal<string|null>(null);readonly busy=signal(false);readonly error=signal('');
 readonly options=[{emoji:'🔥' as const,label:'Quero ver, ler ou jogar isso'},{emoji:'😮' as const,label:'Que surpresa'},{emoji:'❤️' as const,label:'Adorei essa escolha'},{emoji:'🎯' as const,label:'Boa recomendação'}];
 constructor(){effect(()=>{const id=this.entryId(),user=this.auth.user()?.uid;if(id&&user)void this.load(id,user);});}
 canReact(){return !!this.auth.user()&&this.auth.user()?.uid!==this.authorId();}
 private async load(id:string,uid:string){try{const rows=await this.data.getEntryReactions(id);const counts:Record<string,number>={};for(const row of rows)counts[row.emoji]=(counts[row.emoji]??0)+1;this.counts.set(counts);this.mine.set(rows.find(row=>row.uid===uid)?.emoji??null);}catch{this.error.set('Não foi possível carregar as reações.');}}
 async toggle(emoji:EntryReaction['emoji']){if(!this.canReact()||this.busy())return;this.busy.set(true);this.error.set('');try{await this.data.toggleReaction(this.entryId(),emoji);const uid=this.auth.user()?.uid;if(uid)await this.load(this.entryId(),uid);}catch{this.error.set('Não foi possível salvar sua reação. Tente novamente.');}finally{this.busy.set(false);}}
}
