/**
 * Normalize phone strings to E.164-style +digits (matches frontend dialpadSmsRecipient).
 */
export const normalizeToE164 = (input) => {
  if (input == null || input === '') return null;
  const s = String(input).trim();
  const digits = s.replace(/\D/g, '');
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
  if (digits.length >= 10 && digits.length <= 15) return `+${digits}`;
  return null;
};
