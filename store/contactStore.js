import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { fetchContacts, updateContactApi, syncContactsApi, deleteContactApi } from '@/lib/api';

const useContactStore = create(
  persist(
    (set, get) => ({
      contacts: [], // Centralized contact objects {id, phone_number, name, email}
      customNames: {}, // Still kept for legacy/migration purposes
      deletedChatIds: [],
      loading: false,
      lastFetched: 0,
      hasSynced: false,

      lastLineUsed: null,
      fetchContacts: async (search = '', force = false, linePhoneNumber = null) => {
        const now = Date.now();
        const lineChanged = get().lastLineUsed !== linePhoneNumber;

        // Prevent over-fetching (cache for 30s unless forced, searching, or line changed)
        if (!force && !search && !lineChanged && get().contacts.length > 0 && (now - get().lastFetched < 30000)) {
          return;
        }

        set({ loading: true, lastLineUsed: linePhoneNumber });
        try {
          const data = await fetchContacts(search, linePhoneNumber);
          set({ contacts: data, lastFetched: now, loading: false });
        } catch (err) {
          console.error('Failed to fetch contacts:', err);
          set({ loading: false });
        }
      },

      updateContact: async (id, payload) => {
        try {
          const updated = await updateContactApi(id, payload);
          set((state) => ({
            contacts: state.contacts.map((c) => (c.id === updated.id ? updated : c))
          }));
          return updated;
        } catch (err) {
          console.error('Failed to update contact:', err);
          throw err;
        }
      },

      deleteContact: async (id) => {
        try {
          await deleteContactApi(id);
          set((state) => ({
            contacts: state.contacts.filter((c) => c.id !== id)
          }));
        } catch (err) {
          console.error('Failed to delete contact:', err);
          throw err;
        }
      },

      /**
       * Backwards compatibility for the chat page.
       * Finds the contact by its identifier string and updates its name.
       */
      setCustomName: async (identifier, name) => {
        const { contacts, updateContact } = get();
        const found = contacts.find(c => 
          c.phone_number === identifier || 
          c.dialpad_contact_id === identifier ||
          `c:${c.dialpad_contact_id}` === identifier ||
          `phone:${c.phone_number}` === identifier
        );
        
        if (found) {
          try {
            return await updateContact(found.id, { name });
          } catch (err) {
            console.error('Failed to update custom name:', err);
          }
        } else {
          // If not in store yet, we let the backend handle it via sync
          set({ loading: true });
          try {
            await syncContactsApi({ [identifier]: name });
            await get().fetchContacts('', true);
          } catch (err) {
            console.error('Failed to sync custom name:', err);
          } finally {
            set({ loading: false });
          }
        }
      },

      /**
       * Sync legacy local names to backend. Run once.
       */
      syncWithBackend: async () => {
        if (get().hasSynced) return;
        const legacyNames = get().customNames;
        if (Object.keys(legacyNames).length === 0) {
          set({ hasSynced: true });
          return;
        }

        try {
          await syncContactsApi(legacyNames);
          set({ hasSynced: true, customNames: {} }); // Clear local once synced
          await get().fetchContacts('', true);
        } catch (err) {
          console.error('Failed to sync contacts:', err);
        }
      },

      // Helper to get name from store (replaces simple customNames[id])
      getContactName: (identifier) => {
        const { contacts } = get();
        // identifier could be phone or dialpad_contact_id
        const found = contacts.find(c => 
          c.phone_number === identifier || 
          c.dialpad_contact_id === identifier ||
          `c:${c.dialpad_contact_id}` === identifier ||
          `phone:${c.phone_number}` === identifier
        );
        return found?.name || null;
      },

      deleteConversation: (id) =>
        set((state) => ({
          deletedChatIds: [...new Set([...state.deletedChatIds, id])]
        })),

      clearDeletions: () => set({ deletedChatIds: [] }),
    }),
    {
      name: 'agent-contact-store-v2',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ 
        deletedChatIds: state.deletedChatIds,
        hasSynced: state.hasSynced,
        customNames: state.customNames 
      }),
    }
  )
);

export default useContactStore;
