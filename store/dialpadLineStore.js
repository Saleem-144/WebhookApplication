import { create } from 'zustand';

const STORAGE_KEY = 'dialpad_line_user_id';

/**
 * Global Dialpad company user (line) for filtering threads, inbox, notifications, recents.
 */
const useDialpadLineStore = create((set) => ({
  users: [],
  offices: [],
  usersLoading: true,
  usersError: '',

  setUsersLoading: (v) => set({ usersLoading: Boolean(v) }),

  setUsersBundle: ({ users, error }) =>
    set({
      users: Array.isArray(users) ? users : [],
      usersError: error || '',
    }),

  setOffices: (offices) => set({ offices: Array.isArray(offices) ? offices : [] }),

  /**
   * @param {string} id
   * @param {{ syncUrl?: boolean }} [opts] default syncUrl true — updates agentId on /messages routes
   */
  setSelectedUserId: (id, opts = {}) => {
    const syncUrl = opts.syncUrl !== false;
    const s = String(id || '');
    console.log(`[DialpadLineStore] setSelectedUserId: id=${s}, syncUrl=${syncUrl}`);
    set({ selectedUserId: s });
    if (typeof window === 'undefined') return;
    if (s) {
      localStorage.setItem(STORAGE_KEY, s);
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
    if (syncUrl && s) {
      const isMessagesPage = window.location.pathname.includes('messages');
      if (isMessagesPage) {
        const u = new URL(window.location.href);
        u.searchParams.set('agentId', s);
        console.log(`[DialpadLineStore] Updating URL with agentId: ${s}`);
        window.history.replaceState({}, '', u.toString());
      }
    }
  },
}));

export { STORAGE_KEY, useDialpadLineStore };
export default useDialpadLineStore;
