import { Controller, Get, Inject, Res } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { sql } from 'drizzle-orm';
import type { Response } from 'express';
import { DRIZZLE, type Database } from '../database/database.module.js';

@ApiTags('ops')
@Controller('health')
export class HealthController {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  @Get()
  async check(@Res() res: Response) {
    let database = 'ok';
    try {
      await this.db.execute(sql`select 1`);
    } catch {
      database = 'unavailable';
    }

    const ok = database === 'ok';
    res.status(ok ? 200 : 503).json({
      status: ok ? 'ok' : 'degraded',
      checks: { database },
      version: process.env['npm_package_version'] ?? 'dev',
      time: new Date().toISOString(),
    });
  }
}
