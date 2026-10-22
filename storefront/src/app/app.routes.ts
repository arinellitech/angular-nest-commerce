import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./features/home/home').then((m) => m.Home),
    title: 'Loja Demo',
  },
  {
    path: 'products',
    loadComponent: () => import('./features/catalog/product-list').then((m) => m.ProductList),
    title: 'Produtos · Loja Demo',
  },
  {
    path: 'products/:slug',
    loadComponent: () => import('./features/catalog/product-page').then((m) => m.ProductPage),
  },
  // Client-only flows (no SSR, see app.routes.server.ts). Implemented by PROMPTS 02–05.
  {
    path: 'cart',
    loadComponent: () => import('./features/cart/cart-page').then((m) => m.CartPage),
    title: 'Carrinho · Loja Demo',
  },
  {
    path: '**',
    loadComponent: () => import('./features/not-found/not-found').then((m) => m.NotFound),
    title: 'Página não encontrada',
  },
];
