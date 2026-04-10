import util from 'util';

/**
 * Print decoded Dialpad call webhooks to the server terminal.
 * - development: on unless DIALPAD_LOG_CALL_WEBHOOKS=false
 * - production: off unless DIALPAD_LOG_CALL_WEBHOOKS=true
 */
export const shouldLogDialpadCallWebhooks = () => {
  const v = String(process.env.DIALPAD_LOG_CALL_WEBHOOKS || '').toLowerCase();
  if (v === 'true' || v === '1' || v === 'yes') return true;
  if (v === 'false' || v === '0' || v === 'no') return false;
  return process.env.NODE_ENV === 'development';
};

/**
 * @param {object} payload Decoded JWT / JSON body Dialpad sent to POST /api/webhooks/dialpad
 */
export const logDialpadCallWebhookPayload = (payload) => {
  if (!shouldLogDialpadCallWebhooks()) return;

  const stamp = new Date().toISOString();
  const bar = '='.repeat(72);
  console.log(`\n${bar}`);
  console.log(`[Dialpad CALL webhook] ${stamp}`);
  console.log(
    util.inspect(payload, {
      depth: 8,
      colors: true,
      maxArrayLength: 100,
      maxStringLength: 2000,
    }),
  );
  console.log(`${bar}\n`);
};
