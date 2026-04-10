/**
 * Re-run processDialpadWebhookJob for webhook_events rows that have a decoded JWT
 * payload but are still unprocessed (e.g. queue failed earlier).
 */
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env') });

const { query } = await import('../src/db/index.js');
const { processDialpadWebhookJob } = await import('../src/workers/dialpadQueueWorker.js');

const { rows } = await query(
  `
  SELECT id, raw_payload
  FROM webhook_events
  WHERE processed = false
    AND raw_payload ? 'decoded'
    AND (error_message IS NULL OR error_message NOT IN ('duplicate_event_id'))
  ORDER BY received_at ASC
  LIMIT 200
  `,
);

let ok = 0;
for (const row of rows) {
  const decoded = row.raw_payload?.decoded;
  if (!decoded || typeof decoded !== 'object') {
    console.warn('Skip id=%s (no decoded payload)', row.id);
    continue;
  }
  console.log('Replaying webhook_events.id=%s', row.id);
  await processDialpadWebhookJob({ webhookRowId: row.id, payload: decoded });
  ok += 1;
}

console.log('Replay finished. Attempted %s row(s).', ok);
