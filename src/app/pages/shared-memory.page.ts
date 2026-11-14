import { Component, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { AuthService } from '../core/auth.service';
import { DataService } from '../core/data.service';
import { SharedMemory, SharedMemoryMessage } from '../core/models';
import { dataErrorMessage } from '../core/data-error';

@Component({selector:'app-shared-memory-page',standalone:true,imports:[FormsModule,RouterLink,DatePipe],template:`
<main class="memory-page"><a class="button ghost" routerLink="/feed">← Voltar ao feed</a>
@if(loading()){<p role="status">Carregando a memória…</p>}
@if(error()){<p class="error" role="alert">{{error()}}</p>}
@if(memory();as item){<header class="page-heading"><div><span class="eyebrow">MEMÓRIA COMPARTILHADA</span><h1>{{item.workTitle}}</h1><p class="subtitle">{{categoryLabel(item.workCategory)}} · Uma conversa privada entre vocês.</p></div></header>
<section class="memory-messages" aria-label="Mensagens compartilhadas" aria-live="polite">
@for(message of messages();track message.id){<article class="memory-message panel" [class.own]="message.uid===auth.user()?.uid"><p class="memory-author">{{message.uid===auth.user()?.uid?'Você':'Sua companhia'}} · <time>{{message.createdAt|date:'dd/MM/yyyy HH:mm'}}</time></p>
@if(message.hasSpoiler&&!revealed().includes(message.id)){<p>Esta mensagem contém spoiler.</p><button class="button secondary" type="button" (click)="reveal(message.id)">Mostrar mensagem</button>}@else{<p class="memory-text">{{message.text}}</p>}</article>}
@if(!messages().length){<p class="panel">A conversa começa com uma impressão de vocês.</p>}
</section>
<form class="panel memory-form" (ngSubmit)="send()"><label for="memory-text">Sua impressão</label><textarea id="memory-text" name="text" [(ngModel)]="draft" maxlength="500" required rows="3" [disabled]="sending()"></textarea><label class="memory-spoiler"><input type="checkbox" name="spoiler" [(ngModel)]="hasSpoiler" [disabled]="sending()"> Esta mensagem contém spoiler</label><div class="button-row"><span class="field-help">{{draft.length}} / 500</span><button class="button primary" type="submit" [disabled]="sending()||!draft.trim()">{{sending()?'Enviando…':'Enviar impressão'}}</button></div></form>}
</main>`,styles:[`:host{display:block;max-width:760px;margin:auto}.memory-page{padding-bottom:32px}.memory-messages{display:grid;gap:14px;margin:24px 0}.memory-message{padding:18px 22px;max-width:90%;overflow-wrap:anywhere}.memory-message.own{justify-self:end;background:var(--primary-soft)}.memory-author{font-size:12px;color:var(--muted);margin-bottom:8px}.memory-text{white-space:pre-wrap;margin:0}.memory-form{display:grid;gap:12px}.memory-form label{font-weight:600}.memory-form textarea{width:100%;padding:12px;border:1px solid var(--border);border-radius:9px;background:var(--canvas);color:var(--ink);resize:vertical}.memory-spoiler{display:flex;gap:10px;align-items:center;font-size:14px}.memory-form .button-row{display:flex;align-items:center;justify-content:space-between}@media(max-width:480px){.memory-message{max-width:100%}.memory-form .button-row{align-items:stretch;flex-direction:column}.memory-form .button{width:100%}}`]})
export class SharedMemoryPage {
 readonly auth=inject(AuthService);private readonly data=inject(DataService);private readonly route=inject(ActivatedRoute);
 readonly memory=signal<SharedMemory|null>(null);readonly messages=signal<SharedMemoryMessage[]>([]);readonly loading=signal(false);readonly sending=signal(false);readonly error=signal('');readonly revealed=signal<string[]>([]);
 draft='';hasSpoiler=false;private id='';
 constructor(){this.id=this.route.snapshot.paramMap.get('memoryId')??'';void this.load();}
 categoryLabel(value:string){return ({filme:'Filme',serie:'Série',livro:'Livro',jogo:'Jogo',podcast:'Podcast',musica:'Música',outros:'Outro'} as Record<string,string>)[value]??value;}
 reveal(id:string){this.revealed.update(items=>items.includes(id)?items:[...items,id]);}
 async load(){this.loading.set(true);this.error.set('');try{await this.auth.ready;const memory=await this.data.sharedMemory(this.id);if(!memory){this.error.set('Esta memória não existe ou você não participa dela.');return;}this.memory.set(memory);this.messages.set(await this.data.sharedMemoryMessages(this.id));}catch(error){this.error.set(dataErrorMessage(error,'Não foi possível carregar esta memória.'));}finally{this.loading.set(false);}}
 async send(){if(this.sending()||!this.draft.trim())return;this.sending.set(true);this.error.set('');const text=this.draft.trim(),spoiler=this.hasSpoiler;try{await this.data.sendSharedMemoryMessage(this.id,{text,hasSpoiler:spoiler});this.draft='';this.hasSpoiler=false;this.messages.set(await this.data.sharedMemoryMessages(this.id));}catch(error){this.error.set(dataErrorMessage(error,'Não foi possível enviar a mensagem.'));}finally{this.sending.set(false);}}
}
