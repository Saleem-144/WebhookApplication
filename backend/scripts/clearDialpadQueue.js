/**
 * Removes all items from the Upstash list used by the Dialpad webhook worker.
 * Run after fixing queue consumers if bad entries were stored.
 */
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { Redis } from '@upstash/redis';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env') });

const QUEUE_KEY = 'dialpad:event:queue';

const url = process.env.UPSTASH_REDIS_REST_URL?.trim();
const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();

if (!url || !token) {
  console.error('Missing UPSTASH_REDIS_REST_URL or UPSTASH_REDIS_REST_TOKEN in backend/.env');
  process.exit(1);
}

const redis = new Redis({ url, token });
const deleted = await redis.del(QUEUE_KEY);
console.log(`Cleared ${QUEUE_KEY} (DEL returned ${deleted}).`);
