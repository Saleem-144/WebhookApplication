'use client';

import { useState, useEffect } from 'react';
import { Search, User, Edit2, Check, X, Mail, Phone as PhoneIcon, Loader2, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import useContactStore from '@/store/contactStore';
import { useSelectedDialpadLineUser } from '@/lib/useDialpadLineSelection';

export default function ContactsPage() {
  const { contacts, loading, fetchContacts, updateContact, deleteContact } = useContactStore();
  const lineUser = useSelectedDialpadLineUser();
  const [search, setSearch] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({ name: '', email: '' });
  const [updateLoading, setUpdateLoading] = useState(false);

  useEffect(() => {
    fetchContacts(search, false, lineUser?.phone_number);
  }, [search, fetchContacts, lineUser?.phone_number, lineUser?.id]);

  const handleEdit = (c) => {
    setEditingId(c.id);
    setEditForm({ name: c.name || '', email: c.email || '' });
  };

  const handleCancel = () => {
    setEditingId(null);
    setEditForm({ name: '', email: '' });
  };

  const handleSave = async (id) => {
    setUpdateLoading(true);
    try {
      await updateContact(id, editForm);
      setEditingId(null);
    } catch (err) {
      alert('Failed to update contact');
    } finally {
      setUpdateLoading(false);
    }
  };

  const handleDelete = async (c) => {
    if (!window.confirm(`Are you sure you want to delete contact "${c.name || c.phone_number}"? This will permanently remove their identity from the database.`)) {
      return;
    }
    try {
      await deleteContact(c.id);
    } catch (err) {
      alert('Failed to delete contact');
    }
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-[#fbfcfd]">
      <div className="flex-none px-8 py-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-[24px] font-bold text-[#1e293b]">Contacts</h1>
            <p className="text-[14px] text-[#64748b] mt-1">
              Manage your customer contact details and identity.
            </p>
          </div>
        </div>

        <div className="mt-8 flex items-center justify-between gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search by name, phone or email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-white border border-gray-200 rounded-xl py-2.5 pl-10 pr-4 text-sm focus:ring-2 focus:ring-[#2563eb]/10 focus:border-[#2563eb] outline-none transition-all shadow-sm"
            />
          </div>
        </div>
      </div>

      <div className="flex-1 px-8 pb-8 min-h-0">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden flex flex-col h-full">
          <div className="overflow-x-auto flex-1 custom-scrollbar">
            <table className="w-full text-left border-collapse min-w-[800px]">
              <thead>
                <tr className="bg-gray-50/50 border-b border-gray-100">
                  <th className="px-6 py-4 text-[12px] font-bold text-gray-400 uppercase tracking-widest w-[30%]">Name</th>
                  <th className="px-6 py-4 text-[12px] font-bold text-gray-400 uppercase tracking-widest w-[30%]">Phone Number</th>
                  <th className="px-6 py-4 text-[12px] font-bold text-gray-400 uppercase tracking-widest w-[30%]">Email Address</th>
                  <th className="px-6 py-4 text-[12px] font-bold text-gray-400 uppercase tracking-widest w-[10%] text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {contacts.length === 0 && !loading && (
                  <tr>
                    <td colSpan={4} className="px-6 py-20 text-center">
                      <div className="flex flex-col items-center gap-3">
                        <div className="w-12 h-12 rounded-full bg-gray-50 flex items-center justify-center">
                          <User className="w-6 h-6 text-gray-300" />
                        </div>
                        <p className="text-[14px] text-gray-400 font-medium">No contacts found.</p>
                      </div>
                    </td>
                  </tr>
                )}
                
                {contacts.map((c) => {
                  const isEditing = editingId === c.id;
                  
                  return (
                    <tr key={c.id} className="group hover:bg-gray-50/50 transition-colors">
                      <td className="px-6 py-4">
                        {isEditing ? (
                          <input
                            type="text"
                            value={editForm.name}
                            onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                            className="w-full bg-white border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:ring-1 focus:ring-[#2563eb]/20 outline-none"
                            autoFocus
                          />
                        ) : (
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-[#f1f5f9] flex items-center justify-center text-[#3b5998] font-bold text-[12px] shrink-0">
                              {(c.name || '?').charAt(0).toUpperCase()}
                            </div>
                            <span className={cn("text-[14px] font-bold", c.name ? "text-[#1e293b]" : "text-gray-400 italic")}>
                              {c.name || 'Set Name'}
                            </span>
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2 text-[14px] font-medium text-[#475569]">
                          <PhoneIcon className="w-3.5 h-3.5 text-gray-300" />
                          {c.phone_number}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        {isEditing ? (
                          <input
                            type="email"
                            value={editForm.email}
                            onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                            className="w-full bg-white border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:ring-1 focus:ring-[#2563eb]/20 outline-none"
                            placeholder="Email address..."
                          />
                        ) : (
                          <div className={cn("flex items-center gap-2 text-[14px] font-medium", c.email ? "text-[#475569]" : "text-gray-400 italic")}>
                            <Mail className="w-3.5 h-3.5 text-gray-300" />
                            {c.email || 'None'}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 text-center">
                        {isEditing ? (
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={() => handleSave(c.id)}
                              disabled={updateLoading}
                              className="p-1.5 bg-emerald-50 text-emerald-600 rounded-lg hover:bg-emerald-100 transition-colors disabled:opacity-50"
                              title="Save changes"
                            >
                              <Check className="w-4 h-4" />
                            </button>
                            <button
                              onClick={handleCancel}
                              className="p-1.5 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors"
                              title="Cancel"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center justify-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={() => handleEdit(c)}
                              className="p-2 text-gray-400 hover:text-[#2563eb] hover:bg-[#eff6ff] rounded-lg transition-all"
                              title="Edit contact"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDelete(c)}
                              className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                              title="Delete contact"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          
          {loading && (
            <div className="flex-none h-1 bg-gray-50 relative overflow-hidden">
              <div className="absolute inset-y-0 bg-[#2563eb]/40 animate-progress w-1/3" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
