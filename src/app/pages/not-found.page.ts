import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
@Component({standalone: true, imports: [RouterLink], template: `<section class="empty panel"><span class="eyebrow">PÁGINA NÃO ENCONTRADA</span><h1>Essa história ainda não existe.</h1><p>Confira o endereço ou volte ao seu diário.</p><a class="button primary" routerLink="/diary">Abrir meu diário</a></section>`})
export class NotFoundPage {}
