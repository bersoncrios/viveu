import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../core/auth.service';
import { JourneyPreview } from './journey-preview';

@Component({
  selector: 'app-home-page', standalone: true, imports: [RouterLink, JourneyPreview],
  template: `
    <div class="public-site">
      <header class="public-header">
        <a class="brand" routerLink="/" aria-label="Viveu, início"><img class="brand-lockup" src="/viveu-logo.svg" width="159" height="36" alt="Viveu"></a>
        <nav aria-label="Navegação da apresentação"><a href="#como-funciona">Como funciona</a><a href="#seu-repertorio">Seu repertório</a></nav>
        <a class="button secondary" [routerLink]="auth.user() ? '/feed' : '/login'">{{auth.user() ? 'Abrir meu Viveu' : 'Entrar'}} <span aria-hidden="true">↗</span></a>
      </header>
      <section class="home-hero" aria-labelledby="home-title">
        <div class="home-hero-copy"><span class="public-kicker"><span></span> UM LUGAR PARA SUAS HISTÓRIAS</span><h1 id="home-title">Você vive<br>as histórias.<br><em>A gente ajuda<br>a guardar.</em></h1><p>Os filmes que ficaram na cabeça. Os livros que mudaram alguma coisa. A música que virou memória. Seu repertório tem muito de você.</p><div class="hero-actions"><a class="button primary" [routerLink]="auth.user() ? '/diary' : '/login'">{{auth.user() ? 'Ir para meu diário' : 'Começar minha história'}} <span aria-hidden="true">→</span></a><a class="home-text-link" href="#como-funciona">Conhecer o Viveu <span aria-hidden="true">↓</span></a></div><p class="hero-footnote">Seu diário cultural. No seu ritmo.</p></div>
        <div class="home-hero-art"><app-journey-preview /></div>
      </section>
      <section class="repertoire-strip" id="seu-repertorio" aria-label="Tudo o que faz parte do seu repertório"><span>PARA TUDO QUE<br>FICA COM VOCÊ</span><ul><li>Filmes</li><li>Séries</li><li>Livros</li><li>Jogos</li><li>Podcasts</li><li>Músicas</li></ul></section>
      <section class="home-journey" id="como-funciona" aria-labelledby="journey-title"><div class="journey-intro"><span class="public-kicker">DA VONTADE À LEMBRANÇA</span><h2 id="journey-title">Uma obra termina.<br><em>Sua história com ela, não.</em></h2><p>Guarde mais do que uma lista de títulos. Acompanhe o que você vive antes, durante e depois de cada experiência.</p></div>
        <ol class="home-steps"><li><span class="step-number">01</span><div><h3>Deu vontade? Guarda.</h3><p>Organize sua fila e anote por que aquela obra chamou sua atenção. A próxima boa história começa aqui.</p></div></li><li><span class="step-number">02</span><div><h3>Viva. Pause. Continue.</h3><p>Comece sua jornada, registre impressões e lembre onde parou. Tudo bem deixar para depois.</p></div></li><li><span class="step-number">03</span><div><h3>Fique com o que importa.</h3><p>Conte como se sentiu, guarde uma frase e revisite a obra quando quiser. Cada passagem pode ser diferente.</p></div></li></ol>
      </section>
      <section class="home-social" aria-labelledby="social-title"><div class="social-visual" aria-hidden="true"><div class="social-circle"><span>Histórias<br>se encontram.</span></div><span class="social-token token-book">▤</span><span class="social-token token-music">♫</span><span class="social-token token-cinema">▶</span></div><div><span class="public-kicker">SEU REPERTÓRIO GANHA COMPANHIA</span><h2 id="social-title">O mesmo filme.<br><em>Um outro olhar.</em></h2><p>Encontre amigos pelo nome e acompanhe o que eles estão vivendo. Conheça outras impressões, descubra interesses em comum e abra espaço para boas conversas.</p><p class="social-detail">Reflexões e notas podem ter aviso de spoiler, para cada pessoa escolher quando ler.</p><a class="home-text-link" [routerLink]="auth.user() ? '/feed' : '/login'">Encontrar minhas próximas histórias <span aria-hidden="true">→</span></a></div></section>
      <section class="home-invitation" aria-labelledby="invitation-title"><img src="/viveu-symbol.svg" width="48" height="48" alt=""><span class="public-kicker">SEU ACERVO COMEÇA COM UMA HISTÓRIA</span><h2 id="invitation-title">O que ficou<br><em>com você hoje?</em></h2><a class="button primary" [routerLink]="auth.user() ? '/entry/new' : '/login'">{{auth.user() ? 'Guardar uma experiência' : 'Criar meu diário com Google'}} <span aria-hidden="true">↗</span></a><p>Seu perfil e suas experiências são públicos.<br>A fila fica fora do perfil.</p></section>
      <footer class="public-footer"><a class="brand" routerLink="/" aria-label="Viveu, início"><img class="brand-lockup" src="/viveu-logo.svg" width="159" height="36" alt="Viveu"></a><span>Sua vida tem boas histórias. Lembre delas.</span><a [routerLink]="auth.user() ? '/feed' : '/login'">{{auth.user() ? 'Voltar ao app' : 'Entrar no Viveu'}} <span aria-hidden="true">↗</span></a></footer>
    </div>
  `,
  styleUrl: './home.page.css',
})
export class HomePage {readonly auth = inject(AuthService);}
