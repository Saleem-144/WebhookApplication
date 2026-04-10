'use client';

import { useRef, useState, useEffect } from 'react';
import {
  Paperclip,
  Send,
  Smile,
  Image as ImageIcon,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { sendDialpadSms } from '@/lib/api';
import { recipientNumbersFromThreadRows, normalizeToE164 } from '@/lib/dialpadSmsRecipient';
import {
  DIALPAD_MMS_MAX_BYTES,
  fileToBase64,
} from '@/lib/dialpadMedia';
import { DIALPAD_QUICK_EMOJIS } from '@/lib/dialpadEmojiPicker';

const FILE_ACCEPT =
  'image/*,video/*,.pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document';

/**
 * Bottom bar: text, emoji, one MMS attachment (Dialpad `media` max 500 KiB), send via POST /api/dialpad/sms.
 */
export default function DialpadSmsComposer({
  threadRows = [],
  selectedChatId,
  onSent,
  className,
  /** When set (including empty string), send only if non-empty; omits payload key if undefined. */
  fromNumber,
  onOptimisticEnqueue,
  onSendFinished,
  agentPhones = new Set(),
}) {
  const [messageText, setMessageText] = useState('');
  const [attachment, setAttachment] = useState(null);
  const [showEmoji, setShowEmoji] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState('');
  const fileInputRef = useRef(null);
  const emojiRef = useRef(null);
  const inFlightRef = useRef(false);

  useEffect(() => {
    const close = (e) => {
      if (emojiRef.current && !emojiRef.current.contains(e.target)) {
        setShowEmoji(false);
      }
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  const openFilePicker = () => {
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
      fileInputRef.current.click();
    }
  };

  const onFileChange = (e) => {
    const f = e.target.files?.[0];
    setSendError('');
    if (!f) return;
    if (f.size > DIALPAD_MMS_MAX_BYTES) {
      setSendError(
        `File too large (max ${Math.round(DIALPAD_MMS_MAX_BYTES / 1024)} KB for Dialpad MMS).`,
      );
      return;
    }
    setAttachment(f);
  };

  const fromRequired = fromNumber !== undefined;
  const resolvedFrom = String(fromNumber || '').trim();
  const normalizedFrom = normalizeToE164(resolvedFrom);

  const toNumbers = recipientNumbersFromThreadRows(threadRows, agentPhones);
  const isSelfSend =
    normalizedFrom &&
    Array.isArray(toNumbers) &&
    toNumbers.some((num) => normalizeToE164(num) === normalizedFrom);

  const canSend =
    Boolean(selectedChatId) &&
    !sending &&
    (messageText.trim().length > 0 || attachment != null) &&
    (!fromRequired || resolvedFrom.length > 0) &&
    !isSelfSend;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!canSend || inFlightRef.current) return;

    if (!toNumbers?.length) {
      setSendError('Could not find a customer phone number in this thread.');
      return;
    }

    if (isSelfSend) {
      setSendError('The SMS sender and recipient must not be identical.');
      return;
    }

    const fileSnap = attachment;
    const trimmed = messageText.trim();
    const textForApi = trimmed;
    const localId =
      typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `opt-${Date.now()}`;
    const createdAt = Date.now();

    inFlightRef.current = true;
    setSending(true);
    setSendError('');
    setMessageText('');
    setAttachment(null);
    setShowEmoji(false);
    onOptimisticEnqueue?.({
      localId,
      body: textForApi,
      createdAt,
    });

    try {
      const payload = {
        infer_country_code: false,
        to_numbers: toNumbers,
        text: textForApi,
      };

      const cid = threadRows.find((r) => r.contact_id)?.contact_id;
      if (cid) {
        payload.contact_id = String(cid);
      }

      if (fileSnap) {
        const b64 = await fileToBase64(fileSnap);
        payload.media = b64;
      }

      if (resolvedFrom) {
        payload.from_number = resolvedFrom;
      }

      const res = await sendDialpadSms(payload);
      if (!res?.success) {
        const msg =
          res?.error ||
          res?.message ||
          (typeof res === 'object' ? JSON.stringify(res) : 'Send failed');
        setSendError(msg);
        onSendFinished?.({ localId, success: false, errorMessage: msg });
        setMessageText(trimmed);
        setAttachment(fileSnap);
        return;
      }

      onSendFinished?.({ localId, success: true });
      onSent?.();
    } catch (err) {
      const msg =
        err.response?.data?.error ||
        err.response?.data?.message ||
        err.message ||
        'Send failed';
      setSendError(msg);
      onSendFinished?.({ localId, success: false, errorMessage: msg });
      setMessageText(trimmed);
      setAttachment(fileSnap);
    } finally {
      inFlightRef.current = false;
      setSending(false);
    }
  };

  return (
    <div className={cn('bg-white border-t border-gray-100 z-10 min-w-0', className)}>
      <form
        onSubmit={handleSubmit}
        className="mx-auto flex w-full min-w-0 max-w-full flex-col gap-2 p-4"
      >
        {attachment && (
          <div className="flex items-center gap-2 rounded-xl border border-gray-200 bg-[#f8f9fc] px-3 py-2 text-[13px]">
            <span className="truncate font-medium text-[#334155] flex-1">
              {attachment.name}
            </span>
            <button
              type="button"
              onClick={() => setAttachment(null)}
              className="p-1 rounded-lg hover:bg-gray-200 text-gray-500"
              aria-label="Remove attachment"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {sendError && (
          <p className="text-[12px] text-red-600 font-medium px-1">{sendError}</p>
        )}
        {isSelfSend && !sendError && (
          <p className="text-[12px] text-amber-600 font-medium px-1">
            Cannot send SMS: Sender and recipient numbers are identical.
          </p>
        )}

        <div className="flex min-w-0 items-end gap-2 bg-[#f8f9fc] border border-gray-200 rounded-[24px] p-2 pr-3 pl-3 focus-within:border-[#2563eb]/30 focus-within:ring-4 focus-within:ring-[#2563eb]/5 transition-all">
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            accept={FILE_ACCEPT}
            onChange={onFileChange}
          />

          <div className="flex items-center gap-0.5 shrink-0 mb-1">
            <button
              type="button"
              onClick={openFilePicker}
              disabled={!selectedChatId || sending}
              className="p-2 hover:bg-gray-200/60 rounded-full text-gray-500 disabled:opacity-40"
              title="Attach file"
            >
              <Paperclip className="w-5 h-5" />
            </button>
            <button
              type="button"
              onClick={openFilePicker}
              disabled={!selectedChatId || sending}
              className="p-2 hover:bg-gray-200/60 rounded-full text-gray-500 disabled:opacity-40"
              title="Attach image"
            >
              <ImageIcon className="w-5 h-5" />
            </button>
            <div className="relative" ref={emojiRef}>
              <button
                type="button"
                onClick={() => setShowEmoji((v) => !v)}
                disabled={!selectedChatId || sending}
                className={cn(
                  'p-2 rounded-full text-gray-500 disabled:opacity-40',
                  showEmoji ? 'bg-gray-200/80' : 'hover:bg-gray-200/60',
                )}
                title="Emoji"
              >
                <Smile className="w-5 h-5" />
              </button>
              {showEmoji && selectedChatId && (
                <div className="absolute bottom-full left-0 mb-2 w-[280px] max-h-[220px] overflow-y-auto rounded-2xl border border-gray-200 bg-white shadow-lg p-2 grid grid-cols-8 gap-1 z-50">
                  {DIALPAD_QUICK_EMOJIS.map((em) => (
                    <button
                      key={em}
                      type="button"
                      className="text-xl p-1.5 rounded-lg hover:bg-gray-100 leading-none"
                      onClick={() => {
                        setMessageText((t) => t + em);
                        setShowEmoji(false);
                      }}
                    >
                      {em}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <textarea
            value={messageText}
            onChange={(e) => setMessageText(e.target.value)}
            placeholder={
              selectedChatId
                ? 'Type a message…'
                : 'Select a thread'
            }
            rows={1}
            disabled={!selectedChatId}
            className="min-w-0 flex-1 bg-transparent border-none outline-none py-2 text-[15px] text-gray-700 placeholder:text-gray-400 resize-none max-h-32 min-h-[44px] disabled:opacity-50 break-words [overflow-wrap:anywhere]"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                if (canSend) handleSubmit(e);
              }
            }}
          />

          <button
            type="submit"
            disabled={!canSend}
            className={cn(
              'mb-1 p-2.5 rounded-full shadow-sm shrink-0 transition-opacity',
              canSend
                ? 'bg-[#2563eb] text-white hover:bg-[#1d4ed8]'
                : 'bg-gray-200 text-gray-400',
              sending && canSend && 'opacity-80',
            )}
            aria-label="Send"
          >
            <Send className="w-5 h-5" />
          </button>
        </div>
        <p className="min-w-0 break-words px-2 text-[10px] text-gray-400 [overflow-wrap:anywhere]">
          Sends via Dialpad API (SMS / one MMS, max 500 KB).{' '}
          {fromRequired && !resolvedFrom ? (
            'Pick a Dialpad line that has a phone number to enable send.'
          ) : (
            <>
              Requires <code className="rounded bg-gray-100 px-1">DIALPAD_API_KEY</code>.
              {fromRequired && resolvedFrom
                ? ` From: ${resolvedFrom}.`
                : (
                  <>
                    {' '}
                    If <code className="rounded bg-gray-100 px-1">from_number</code> is omitted, backend uses{' '}
                    <code className="rounded bg-gray-100 px-1">DIALPAD_SMS_FROM_NUMBER</code>.
                  </>
                )}
            </>
          )}
        </p>
      </form>
    </div>
  );
}
