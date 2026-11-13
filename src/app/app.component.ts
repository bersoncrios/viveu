import { Component, inject, signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AuthService } from './core/auth.service';

export function isPublicRoute(url: string): boolean {
  const path = url.split(/[?#]/)[0];
  return path === '/' || path === '' || path.replace(/\/$/, '') === '/login';
}

@Component({
  selector: 'app-root', standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  template: `
    <a class="skip-link" href="#main">Pular para o conteúdo</a>
    @if (!isPublicPage()) {
      <aside class="sidebar" aria-label="Menu principal">
        <a class="brand" routerLink="/feed" aria-label="Viveu, início"><img class="brand-lockup" src="/viveu-logo.svg" width="159" height="36" alt="Viveu"></a>
        <p class="sidebar-caption">SEU REPERTÓRIO VIVE AQUI</p>
        <nav class="main-nav" aria-label="Navegação principal">
          <a routerLink="/feed" routerLinkActive="active" ariaCurrentWhenActive="page"><span aria-hidden="true">◉</span> Feed</a>
          <a routerLink="/diary" routerLinkActive="active" ariaCurrentWhenActive="page"><span aria-hidden="true">▤</span> Meu diário</a>
          <a routerLink="/queue" routerLinkActive="active" ariaCurrentWhenActive="page"><span aria-hidden="true">≡</span> Minha fila</a>
          <a routerLink="/together" routerLinkActive="active" ariaCurrentWhenActive="page"><span aria-hidden="true">◷</span> Em companhia</a>
          @if (auth.user(); as user) {
            <a [routerLink]="['/u', user.uid]" routerLinkActive="active" ariaCurrentWhenActive="page"><span aria-hidden="true">◎</span> Meu perfil</a>
          }
        </nav>
        <a class="button primary sidebar-register" routerLink="/entry/new"><span aria-hidden="true">＋</span> Guardar experiência</a>
        <div class="sidebar-note"><img class="sidebar-logo" src="/viveu-symbol.svg" width="40" height="40" alt="" aria-hidden="true"><p>Algumas histórias merecem<br>ficar com você.</p></div>
        <div class="sidebar-user">
          @if (auth.user(); as user) {
            <a class="user-link" [routerLink]="['/u', user.uid]"><span class="avatar">{{ (auth.profile()?.displayName || user.displayName || 'V').slice(0, 1) }}</span><span><strong>{{ auth.profile()?.displayName || user.displayName || 'Meu perfil' }}</strong><small>Meu acervo pessoal</small></span></a>
            <button class="logout" (click)="logout()" [disabled]="loggingOut()">{{ loggingOut() ? 'Saindo…' : 'Sair da conta' }}</button>
            @if (sessionError()) { <p class="error" role="alert">{{ sessionError() }}</p> }
          } @else { <a class="button secondary" routerLink="/login">Entrar no Viveu</a> }
        </div>
      </aside>
      <header class="mobile-header"><a class="brand" routerLink="/feed" aria-label="Viveu, início"><img class="brand-lockup" src="/viveu-logo.svg" width="159" height="36" alt="Viveu"></a><div class="actions"><a class="button primary" routerLink="/entry/new">＋ Guardar</a>@if (auth.user()) {<button class="button ghost" (click)="logout()" [disabled]="loggingOut()">Sair</button>}</div></header>
    }
    <main id="main" tabindex="-1" [class.app-content]="!isPublicPage()" [class.public-content]="isPublicPage()">
      @if (!isPublicPage() && sessionError()) {<p class="error" role="alert">{{ sessionError() }}</p>}
      @if (!isPublicPage() && auth.user() && auth.error()) {
        <div class="error" role="alert"><p>Não foi possível carregar seu perfil. {{ auth.error() }}</p><button class="button secondary" (click)="retryProfile()" [disabled]="retryingProfile()">{{ retryingProfile() ? 'Carregando…' : 'Tentar carregar perfil novamente' }}</button></div>
      }
      <router-outlet />
    </main>
    @if (!isPublicPage()) {
      <nav class="mobile-nav" aria-label="Navegação do celular">
        <a routerLink="/feed" routerLinkActive="active" ariaCurrentWhenActive="page"><span aria-hidden="true">◉</span>Feed</a>
        <a routerLink="/diary" routerLinkActive="active" ariaCurrentWhenActive="page"><span aria-hidden="true">▤</span>Diário</a>
        <a routerLink="/queue" routerLinkActive="active" ariaCurrentWhenActive="page"><span aria-hidden="true">≡</span>Fila</a>
        <a routerLink="/together" routerLinkActive="active" ariaCurrentWhenActive="page"><span aria-hidden="true">◷</span>Juntos</a>
        @if (auth.user(); as user) {<a [routerLink]="['/u', user.uid]" routerLinkActive="active" ariaCurrentWhenActive="page"><span aria-hidden="true">◎</span>Perfil</a>}
        @else {<a routerLink="/login"><span aria-hidden="true">◎</span>Entrar</a>}
      </nav>
    }
  `
})
export class AppComponent {
  readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  readonly isPublicPage = signal(isPublicRoute(this.router.url));
  readonly loggingOut = signal(false);
  readonly sessionError = signal('');
  readonly retryingProfile = signal(false);
  constructor() {
    this.router.events.pipe(filter(e => e instanceof NavigationEnd), takeUntilDestroyed()).subscribe(e => {
      this.isPublicPage.set(isPublicRoute(e.urlAfterRedirects));
      document.querySelector<HTMLElement>('#main')?.focus({preventScroll: true});
    });
  }
  async logout() {
    this.loggingOut.set(true);
    this.sessionError.set('');
    try { await this.auth.logout(); await this.router.navigateByUrl('/login'); }
    catch { this.sessionError.set('Não foi possível sair. Tente novamente.'); }
    finally { this.loggingOut.set(false); }
  }
  async retryProfile() {
    if (this.retryingProfile()) return;
    this.retryingProfile.set(true);
    try { await this.auth.retryProfile(); }
    catch { /* The service exposes the error in the recovery panel. */ }
    finally { this.retryingProfile.set(false); }
  }
}
