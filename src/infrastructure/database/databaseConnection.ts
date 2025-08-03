import { Pool, PoolClient } from 'pg';
import dotenv from 'dotenv';
import { Carelogs } from '../../carelogs/models/carelogs';
import { Caregiver } from '../../caregiver/models/caregiver';

dotenv.config();

export class DatabaseConnection {
  private pool: Pool;

  constructor() {
    this.pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });
  }

  async query<T>(text: string, params?: Caregiver[] | Carelogs[]): Promise<T[]> {
    const client = await this.pool.connect();
    try {
      const result = await client.query(text, params);
      return result.rows as T[];
    } finally {
      client.release();
    }
  }

  async getClient(): Promise<PoolClient> {
    return this.pool.connect();
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
}