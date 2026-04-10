import { ingestDialpadWebhook } from '../services/dialpadWebhookIngress.js';
import { processDialpadWebhookJob } from '../workers/dialpadQueueWorker.js';

/**
 * POST /api/webhooks/dialpad
 * Body: JWT string (HS256) when Dialpad webhook secret is set, else JSON.
 */
export const handleDialpadWebhook = async (req, res) => {
  try {
    const buf = Buffer.isBuffer(req.body)
      ? req.body
      : Buffer.from(req.body ?? '', 'utf8');

    if (!buf.length) {
      return res.status(400).json({ success: false, error: 'Empty webhook body' });
    }

    const result = await ingestDialpadWebhook(buf);

    if (result.status === 'duplicate') {
      return res.status(200).json({ success: true, status: 'duplicate' });
    }

    if (result.status === 'accepted_no_queue') {
      setImmediate(() => {
        processDialpadWebhookJob({
          webhookRowId: result.webhookRowId,
          payload: result.payload,
        }).catch((e) => console.error('Inline dialpad process:', e));
      });
      if (process.env.NODE_ENV === 'development') {
        const ev =
          result.payload?.event ??
          result.payload?.type ??
          result.payload?.name ??
          'unknown';
        const id =
          result.payload?.id ??
          result.payload?.event_id ??
          result.payload?.message_id ??
          '';
        console.log(
          `[Dialpad webhook] accepted (inline) event=${String(ev)} id=${String(id)}`,
        );
      }
      return res.status(200).json({ success: true, status: 'processing' });
    }

    if (process.env.NODE_ENV === 'development') {
      const p = result.payload;
      const ev = p?.event ?? p?.type ?? p?.name ?? 'unknown';
      const id = p?.id ?? p?.event_id ?? p?.message_id ?? '';
      console.log(
        `[Dialpad webhook] queued event=${String(ev)} id=${String(id)}`,
      );
    }

    return res.status(200).json({ success: true, status: 'queued' });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Webhook error';
    const status = msg.includes('not configured')
      ? 503
      : msg.includes('Invalid webhook') || msg.includes('missing event id')
        ? 401
        : 400;
    return res.status(status).json({ success: false, error: msg });
  }
};
