import { Redis } from 'ioredis';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../../.env') });

const redisUrl = process.env.REDIS_URL;

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
  console.warn('REDIS_URL missing in .env. Redis features will be disabled.');
}

export { redisSubscriber };
export default redis;
