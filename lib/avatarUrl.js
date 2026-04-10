const apiBase = () => {
  const raw =
    process.env.NEXT_PUBLIC_BACKEND_URL ||
    process.env.NEXT_PUBLIC_API_URL ||
    process.env.NEXT_PUBLIC_SOCKET_URL;
  return raw ? raw.replace(/\/$/, '') : '';
};

/**
 * Avatar paths are stored relative to the API (e.g. /uploads/avatars/...).
 * In the browser, same-origin + Next rewrite serves /uploads from Express.
 * @param {{ avatar_url?: string | null } | null | undefined} user
 */
export const getAvatarSrc = (user) => {
  const url = user?.avatar_url;
  if (!url) return null;
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  if (typeof window !== 'undefined' && url.startsWith('/')) {
    return url;
  }
  const base = apiBase();
  if (url.startsWith('/')) {
    return base ? `${base}${url}` : url;
  }
  return base ? `${base}/${url}` : url;
};
