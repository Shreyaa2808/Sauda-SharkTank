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

export const dbPool = mysql.createPool({
  host: requiredEnv('DB_HOST'),
  port,
  user: requiredEnv('DB_USER'),
  password: requiredEnv('DB_PASSWORD'),
  database: requiredEnv('DB_NAME'),
  waitForConnections: true,
  connectionLimit,
  queueLimit: 0
});
