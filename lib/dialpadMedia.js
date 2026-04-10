/** Dialpad SMS `media` field: max 500 KiB raw before base64 (per API). */
export const DIALPAD_MMS_MAX_BYTES = 500 * 1024;

/**
 * @param {File} file
 * @returns {Promise<string>} raw base64 (no data: prefix)
 */
export const fileToBase64 = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const s = String(reader.result || '');
      const i = s.indexOf(',');
      resolve(i >= 0 ? s.slice(i + 1) : s);
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
