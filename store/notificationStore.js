import { create } from 'zustand';
import { mapNotificationRow } from '@/lib/notificationUiMap';

const sortItems = (items) =>
  [...items].sort((a, b) => {
    const ta = new Date(a.created_at || 0).getTime();
    const tb = new Date(b.created_at || 0).getTime();
    return tb - ta;
  });

const useNotificationStore = create((set) => ({
  items: [],
  loaded: false,

  setFromFetchRows: (rows) =>
    set({
      items: sortItems(rows.map(mapNotificationRow)),
      loaded: true,
    }),

  upsertFromServerRow: (row) =>
    set((s) => {
      const mapped = mapNotificationRow(row);
      const rest = s.items.filter((i) => i.id !== mapped.id);
      return { items: sortItems([...rest, mapped]), loaded: true };
    }),

  markRead: (id) =>
    set((s) => ({
      items: s.items.map((i) => (i.id === id ? { ...i, is_read: true } : i)),
    })),

  markAllReadLocal: () =>
    set((s) => ({
      items: s.items.map((i) => ({ ...i, is_read: true })),
    })),

  markThreadReadLocal: (threadKey) =>
    set((s) => {
      const k = String(threadKey || '');
      if (!k) return s;
      return {
        items: s.items.map((i) =>
          i.chatId === k ? { ...i, is_read: true } : i,
        ),
      };
    }),

  dismissFromPopupLocal: (id) =>
    set((s) => ({
      items: s.items.map((i) =>
        i.id === id ? { ...i, dismissedFromPopup: true } : i,
      ),
    })),

  dismissAllFromPopupLocal: () =>
    set((s) => ({
      items: s.items.map((i) => ({ ...i, dismissedFromPopup: true })),
    })),
}));

export { useNotificationStore };
export default useNotificationStore;
