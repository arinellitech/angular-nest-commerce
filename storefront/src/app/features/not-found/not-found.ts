import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';

@Component({
  selector: 'app-not-found',
  imports: [RouterLink, MatButtonModule],
  template: `
    <div class="mx-auto max-w-3xl px-4 py-24 text-center">
      <p class="text-6xl font-bold text-emerald-600">404</p>
      <h1 class="mt-4 text-2xl font-semibold">Página não encontrada</h1>
      <a mat-flat-button routerLink="/" class="mt-8">Voltar para a loja</a>
    </div>
  `,
})
export class NotFound {}
