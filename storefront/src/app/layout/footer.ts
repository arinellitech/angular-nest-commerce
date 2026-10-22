import { Component } from '@angular/core';

@Component({
  selector: 'app-footer',
  template: `
    <footer class="border-t border-zinc-200 py-8 text-sm text-zinc-500">
      <div
        class="mx-auto flex max-w-7xl flex-col gap-2 px-4 sm:flex-row sm:items-center sm:justify-between"
      >
        <p>© {{ year }} Loja Demo — projeto de portfólio (Angular 22 + NestJS 12).</p>
        <p>Pagamentos em ambiente de teste. Nenhuma cobrança real é feita.</p>
      </div>
    </footer>
  `,
})
export class Footer {
  // Computed once per render on each platform; stable enough for a footer.
  readonly year = new Date().getFullYear();
}
