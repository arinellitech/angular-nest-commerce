import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp } from './helpers/app.js';

describe('GET /api/v1/health', () => {
  let app: INestApplication;

  beforeAll(async () => {
    ({ app } = await createTestApp());
  });

  afterAll(() => app.close());

  it('reports the api as healthy', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/health')
      .expect(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.checks.database).toBe('ok');
  });
});
