import { Component } from '@angular/core';
import { CATEGORIES } from '../core/models';

/** Editorial illustration only. Never reads or writes a user's journal. */
@Component({
  selector: 'app-journey-preview', standalone: true,
  template: `
    <div class="preview-composition" aria-label="Exemplo ilustrativo de uma jornada no Viveu">
      <div class="preview-orbit" aria-hidden="true"></div>
      <div class="preview-book" aria-hidden="true"><span>HISTÓRIAS<br>QUE FICAM</span><strong>Entre<br>páginas<span>.</span></strong><small>um novo olhar</small></div>
      <div class="preview-ticket" aria-hidden="true"><span>PLAY. PAUSE. REMEMBER.</span><strong>Sua próxima história</strong><span>FILMES · LIVROS · MÚSICAS · E MAIS</span></div>
      <article class="preview-journal">
        <div class="preview-journal-top"><span class="preview-indicator"></span> MINHA JORNADA <span class="preview-example">EXEMPLO</span></div>
        <div class="preview-journal-heading"><span class="preview-category" [style.background-color]="book.bgColor" [style.color]="book.textColor">{{book.icon}} {{book.singular}}</span><span class="preview-status">Em andamento</span></div>
        <h3>Entre páginas</h3>
        <p class="preview-question">O que ficou com você?</p>
        <p class="preview-reflection">“Talvez algumas histórias cheguem na hora em que a gente mais precisa delas.”</p>
        <div class="preview-feelings"><span>Inspirado</span><span>Curioso</span></div>
        <div class="preview-progress"><span aria-hidden="true">↳</span><div><small>DE ONDE PAREI</small><strong>Capítulo 8. Sem pressa de acabar.</strong></div></div>
      </article>
      <div class="preview-note"><span aria-hidden="true">↗</span> O que você vive<br>merece ficar.</div>
    </div>
  `,
  styleUrl: './journey-preview.css',
})
export class JourneyPreview {readonly book = CATEGORIES.find(item => item.value === 'livro')!;}
