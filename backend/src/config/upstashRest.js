import { Redis } from '@upstash/redis';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../../.env') });

const url = process.env.UPSTASH_REDIS_REST_URL?.trim();
const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();

/** @type {import('@upstash/redis').Redis | null} */
let client = null;

if (url && token) {
  client = new Redis({ url, token });
} else {
  console.warn(
    'UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN missing — webhook dedup + queue disabled.',
  );
}

export const upstashRest = client;

export const hasUpstashRest = () => Boolean(client);
