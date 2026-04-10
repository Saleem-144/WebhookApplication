import { Redis } from 'ioredis';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../../.env') });

// ioredis needs a TCP/TLS URL (rediss://...), not the Upstash REST URL.
// In Upstash Console: your database → Connect → copy "Redis" / Node.js URL.
const redisUrl =
  process.env.REDIS_URL?.trim() ||
  process.env.UPSTASH_REDIS_URL?.trim() ||
  null;

let redis;
let redisSubscriber;

if (redisUrl) {
  try {
    redis = new Redis(redisUrl);
    redis.on('connect', () => console.log('Redis Primary connected'));
    
    redisSubscriber = new Redis(redisUrl);
    redisSubscriber.on('connect', () => console.log('Redis Subscriber connected'));
    
    redis.on('error', (err) => console.error('Redis Primary error:', err));
    redisSubscriber.on('error', (err) => console.error('Redis Subscriber error:', err));
  } catch (err) {
    console.error('Failed to initialize Redis:', err);
  }
} else {
  console.warn(
    'REDIS_URL (or UPSTASH_REDIS_URL) missing in .env. Redis pub/sub is disabled.'
  );
}

export { redisSubscriber };
export default redis;
