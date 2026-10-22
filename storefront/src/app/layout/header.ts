import { Component, computed } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { categoriesResource } from '../core/api/catalog.api';
import { HeaderSearch } from './header-search';

@Component({
  selector: 'app-header',
  imports: [RouterLink, RouterLinkActive, MatButtonModule, MatIconModule, HeaderSearch],
  templateUrl: './header.html',
})
export class Header {
  private readonly categoriesRes = categoriesResource();

  readonly categories = computed(() => this.categoriesRes.value().data);
}
