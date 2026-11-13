import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService, errorMessage } from '../core/auth.service';
import { JourneyPreview } from './journey-preview';

@Component({
  selector: 'app-login-page', standalone: true, imports: [RouterLink, JourneyPreview],
  template: `
    <div class="signin-layout">
      <aside class="signin-story" aria-labelledby="signin-story-title">
        <a class="brand signin-dark-brand" routerLink="/" aria-label="Viveu, início"><img class="brand-logo" src="/viveu-symbol.svg" width="36" height="36" alt="" aria-hidden="true"><span>Viveu</span></a>
        <div class="signin-story-copy"><span class="signin-kicker">UM ACERVO COM A SUA CARA</span><h2 id="signin-story-title">Algumas histórias<br>merecem <em>ficar.</em></h2><p>Guarde o que você vive.<br>Descubra o que fica com você.</p></div>
        <div class="signin-art"><app-journey-preview class="compact on-dark" /></div>
        <p class="signin-story-footer">Filmes. Livros. Jogos. Músicas.<br>E tudo o que faz parte de você.</p>
      </aside>
      <section class="signin-main" aria-labelledby="signin-title">
        <header class="signin-header"><a class="signin-back" routerLink="/"><span aria-hidden="true">←</span> Conhecer o Viveu</a><a class="brand signin-mobile-brand" routerLink="/" aria-label="Viveu, início"><img class="brand-lockup" src="/viveu-logo.svg" width="159" height="36" alt="Viveu"></a></header>
        <div class="signin-card">
          <div class="signin-symbol" aria-hidden="true"><img src="/viveu-symbol.svg" width="57" height="57" alt=""></div>
          <span class="signin-kicker">SEU PRÓXIMO CAPÍTULO COMEÇA AQUI</span>
          <h1 id="signin-title">Entre. Sinta-se<br><em>em casa.</em></h1>
          <p class="signin-description">Um lugar para suas descobertas, suas impressões e as histórias que você quer levar com você.</p>
          @if (error()) {<p class="error" role="alert">{{error()}}</p>}
          @if (auth.user() && !busy()) {
            <p class="signin-session" role="status">Sua conta já está conectada.</p><a class="button primary signin-submit" [routerLink]="destination()">Continuar minha jornada <span aria-hidden="true">→</span></a>
          } @else {
            <button class="button signin-google" type="button" [disabled]="busy()" [attr.aria-busy]="busy()" (click)="login()"><svg aria-hidden="true" viewBox="0 0 48 48" width="21" height="21"><path fill="#4285F4" d="M43.6 24.5c0-1.4-.1-2.8-.4-4.1H24v7.9h11c-.5 2.6-2 4.8-4.2 6.3v5.2h6.8c4-3.7 6-9.1 6-15.3Z"/><path fill="#34A853" d="M24 44c5.5 0 10.1-1.8 13.5-4.9l-6.8-5.2c-1.8 1.2-4.1 1.9-6.7 1.9-5.3 0-9.8-3.6-11.4-8.4h-7v5.4A20.4 20.4 0 0 0 24 44Z"/><path fill="#FBBC05" d="M12.6 27.4a12.3 12.3 0 0 1 0-7.8v-5.4h-7a20.1 20.1 0 0 0 0 18.6l7-5.4Z"/><path fill="#EA4335" d="M24 11.8c3 0 5.6 1 7.7 3l5.8-5.8A19.5 19.5 0 0 0 24 4 20.4 20.4 0 0 0 5.6 15.2l7 5.4c1.6-5.2 6.1-8.8 11.4-8.8Z"/></svg>{{busy() ? 'Conectando sua história…' : 'Continuar com Google'}}<span aria-hidden="true">↗</span></button>
            <p class="signin-account-hint">Primeira vez por aqui? Sua conta é criada ao entrar.</p>
          }
          <div class="signin-benefits"><span><span aria-hidden="true">↳</span> Continue de onde parou</span><span><span aria-hidden="true">◎</span> Acompanhe outras histórias</span></div>
          <div class="signin-privacy"><span aria-hidden="true">◉</span><p>Seu nome, sua bio e suas experiências ficam no perfil público. Sua fila fica fora do perfil.</p></div>
        </div>
        <footer class="signin-footer"><span>No seu tempo. Do seu jeito.</span><a routerLink="/">Voltar ao início <span aria-hidden="true">↗</span></a></footer>
      </section>
    </div>
  `,
  styleUrl: './login.page.css',
})
export class LoginPage {
  auth = inject(AuthService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  busy = signal(false);
  error = signal('');
  destination(): string {
    const requested = this.route.snapshot.queryParamMap.get('returnUrl');
    return requested?.startsWith('/') && !requested.startsWith('//') && !requested.startsWith('/login') ? requested : '/feed';
  }
  async login() {
    if (this.busy()) return;
    this.busy.set(true); this.error.set('');
    try {
      await this.auth.login();
      await this.router.navigateByUrl(this.destination());
    } catch (error: unknown) {
      this.error.set(errorMessage(error));
    } finally { this.busy.set(false); }
  }
}
