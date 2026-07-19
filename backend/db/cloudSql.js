/**
 * @module db/cloudSql
 * @description Cloud SQL PostgreSQL connection manager for production.
 * This module demonstrates the migration path from SQLite to Google Cloud SQL 
 * for the Stadium Context Graph in a production environment.
 */

import { Pool } from 'pg';

let pool;

export function getCloudSqlPool() {
  if (pool) return pool;

  const dbSocketPath = process.env.DB_SOCKET_PATH || '/cloudsql';

  const poolConfig = {
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    host: process.env.INSTANCE_CONNECTION_NAME ? `${dbSocketPath}/${process.env.INSTANCE_CONNECTION_NAME}` : process.env.DB_HOST,
    max: 20, // Connection pool size
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
  };

  pool = new Pool(poolConfig);

  pool.on('error', (err) => {
    console.error('Unexpected error on idle Cloud SQL client', err);
    process.exit(-1);
  });

  return pool;
}

export async function closeCloudSql() {
  if (pool) {
    await pool.end();
    pool = null;
  }
}
