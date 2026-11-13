import { Routes } from '@angular/router';
import { authGuard } from './core/auth.guard';

export const routes: Routes = [
  {path: '', pathMatch: 'full', title: 'Viveu — Guarde o que ficou com você', loadComponent: () => import('./pages/home.page').then(m => m.HomePage)},
  {path: 'login', title: 'Entrar — Viveu', loadComponent: () => import('./pages/login.page').then(m => m.LoginPage)},
  {path: 'feed', title: 'Seu círculo — Viveu', canActivate: [authGuard], loadComponent: () => import('./pages/feed.page').then(m => m.FeedPage)},
  {path: 'diary', title: 'Meu diário — Viveu', canActivate: [authGuard], loadComponent: () => import('./pages/diary.page').then(m => m.DiaryPage)},
  {path: 'entry/new', title: 'Guardar experiência — Viveu', canActivate: [authGuard], loadComponent: () => import('./pages/entry.page').then(m => m.EntryPage)},
  {path: 'entry/:id/edit', title: 'Minha jornada — Viveu', canActivate: [authGuard], loadComponent: () => import('./pages/entry.page').then(m => m.EntryPage)},
  {path: 'queue', title: 'Minha fila — Viveu', canActivate: [authGuard], loadComponent: () => import('./pages/queue.page').then(m => m.QueuePage)},
  {path: 'together', title: 'Jornadas em companhia — Viveu', canActivate: [authGuard], loadComponent: () => import('./pages/together.page').then(m => m.TogetherPage)},
  {path: 'together/:id', title: 'Nossa jornada — Viveu', canActivate: [authGuard], loadComponent: () => import('./pages/together-detail.page').then(m => m.TogetherDetailPage)},
  {path: 'u/:uid', title: 'Perfil — Viveu', loadComponent: () => import('./pages/profile.page').then(m => m.ProfilePage)},
  {path: 'entrar', redirectTo: 'login'},
  {path: 'diario', redirectTo: 'diary'},
  {path: 'fila', redirectTo: 'queue'},
  {path: 'juntos', redirectTo: 'together'},
  {path: 'registrar', redirectTo: 'entry/new'},
  {path: 'perfil/:uid', redirectTo: 'u/:uid'},
  {path: '**', title: 'Página não encontrada — Viveu', loadComponent: () => import('./pages/not-found.page').then(m => m.NotFoundPage)}
];
