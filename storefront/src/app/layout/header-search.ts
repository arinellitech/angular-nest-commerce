import { NgOptimizedImage } from '@angular/common';
import { Component, computed, debounced, inject, signal, viewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router } from '@angular/router';
import {
  MatAutocompleteModule,
  MatAutocompleteTrigger,
  type MatAutocompleteSelectedEvent,
} from '@angular/material/autocomplete';
import { filter } from 'rxjs';
import { productSuggestionsResource } from '../core/api/catalog.api';
import type { Product } from '../core/api/types';

const SEE_ALL = 'see-all';
const MIN_TERM_LENGTH = 2;

/**
 * Header search: debounced (300ms) suggestions with MatAutocomplete; Enter or
 * "ver todos" opens /products?search=…. Deferred by the header so the
 * autocomplete code stays out of the initial bundle.
 */
@Component({
  selector: 'app-header-search',
  imports: [NgOptimizedImage, MatAutocompleteModule],
  templateUrl: './header-search.html',
})
export class HeaderSearch {
  private readonly router = inject(Router);
  private readonly trigger = viewChild(MatAutocompleteTrigger);

  readonly seeAll = SEE_ALL;

  /** What is in the input right now. */
  readonly term = signal('');
  /** Suggestions only follow typing, not URL syncs (no request on navigation or SSR). */
  private readonly typing = signal(false);
  private readonly settled = debounced(() => this.term().trim(), 300);

  readonly query = computed(() => {
    const value = this.settled.hasValue() ? this.settled.value() : '';
    return this.typing() && value.length >= MIN_TERM_LENGTH ? value : undefined;
  });

  readonly suggestions = productSuggestionsResource(() => this.query());
  readonly items = computed(() =>
    this.suggestions.hasValue() ? this.suggestions.value().data : [],
  );
  readonly total = computed(() =>
    this.suggestions.hasValue() ? this.suggestions.value().meta.total : 0,
  );
  readonly searching = computed(
    () =>
      this.typing() &&
      this.term().trim().length >= MIN_TERM_LENGTH &&
      (this.settled.isLoading() || this.suggestions.isLoading()),
  );

  constructor() {
    // Keep the box in sync with /products?search=… The component is deferred,
    // so it may be created after the first navigation: start from the current URL.
    this.term.set(this.searchIn(this.router.url));
    this.router.events
      .pipe(
        filter((e): e is NavigationEnd => e instanceof NavigationEnd),
        takeUntilDestroyed(),
      )
      .subscribe((e) => {
        this.typing.set(false);
        this.term.set(this.searchIn(e.urlAfterRedirects));
      });
  }

  /** The `search` query param when the URL is the product listing, else ''. */
  private searchIn(url: string): string {
    const tree = this.router.parseUrl(url);
    const path = tree.root.children['primary']?.segments.map((s) => s.path).join('/');
    const search: unknown = tree.queryParams['search'];
    return path === 'products' && typeof search === 'string' ? search : '';
  }

  /** Text left in the input after picking an option. */
  readonly displayWith = (value: Product | typeof SEE_ALL | null): string =>
    value === SEE_ALL ? this.term() : '';

  onInput(value: string): void {
    this.typing.set(true);
    this.term.set(value);
  }

  onSelect(event: MatAutocompleteSelectedEvent): void {
    const value = event.option.value as Product | typeof SEE_ALL;
    if (value === SEE_ALL) {
      this.goToResults();
    } else {
      void this.router.navigate(['/products', value.slug]);
    }
  }

  submitSearch(event: Event): void {
    event.preventDefault();
    this.goToResults();
  }

  private goToResults(): void {
    const term = this.term().trim();
    this.trigger()?.closePanel();
    if (term) void this.router.navigate(['/products'], { queryParams: { search: term } });
  }
}
