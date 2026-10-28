import 'dotenv/config';
import mysql from 'mysql2/promise';

function requiredEnv(name: string): string {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

const port = Number(process.env.DB_PORT ?? '3306');
const connectionLimit = Number(
  process.env.DB_CONNECTION_LIMIT ?? '5'
);

if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error('DB_PORT must be a valid port number');
}

if (!Number.isInteger(connectionLimit) || connectionLimit < 1) {
  throw new Error('DB_CONNECTION_LIMIT must be a positive integer');
}

const database = requiredEnv('DB_NAME');
const isDisposableTestDb = /^sauda_test_[a-z0-9_]+$/i.test(database);
const host = isDisposableTestDb && process.env.TEST_DB_HOST ? process.env.TEST_DB_HOST : requiredEnv('DB_HOST');
const user = isDisposableTestDb && process.env.TEST_DB_USER ? process.env.TEST_DB_USER : requiredEnv('DB_USER');
const password = isDisposableTestDb && process.env.TEST_DB_PASSWORD !== undefined ? process.env.TEST_DB_PASSWORD : requiredEnv('DB_PASSWORD');

export const dbPool = mysql.createPool({
  host,
  port,
  user,
  password,
  database,
  waitForConnections: true,
  connectionLimit,
  queueLimit: 0
});
