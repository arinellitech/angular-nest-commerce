import { Module, type Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../config/env.js';
import { createMeilisearch, MeilisearchClient } from './meilisearch.client.js';
import { SearchClient } from './search-client.js';
import { SearchService } from './search.service.js';

const searchClientProvider: Provider = {
  provide: SearchClient,
  inject: [ConfigService],
  useFactory: (config: ConfigService<Env, true>) =>
    new MeilisearchClient(
      createMeilisearch({
        MEILISEARCH_HOST: config.get('MEILISEARCH_HOST', { infer: true }),
        MEILISEARCH_KEY: config.get('MEILISEARCH_KEY', { infer: true }),
      }),
    ),
};

@Module({
  providers: [searchClientProvider, SearchService],
  exports: [SearchService],
})
export class SearchModule {}
