'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { User, Plus, Pencil, Trash2, ShieldAlert } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { cn } from '@/lib/utils';
import { getAvatarSrc } from '@/lib/avatarUrl';
import useAuthStore from '@/store/authStore';
import {
  patchProfile,
  changePasswordRequest,
  fetchUsers,
  createUserRequest,
  deleteUserRequest,
  uploadAvatarRequest,
} from '@/lib/api';

const AVATAR_COLORS = [
  'bg-[#eef4ff] text-[#3b5998]',
  'bg-[#eef2fa] text-[#4f46e5]',
  'bg-[#f0fdf4] text-[#15803d]',
  'bg-[#fef3c7] text-[#b45309]',
  'bg-[#fce7f3] text-[#be185d]',
];

function initialsFromName(name) {
  if (!name || typeof name !== 'string') return '?';
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }
  return name.trim().slice(0, 2).toUpperCase() || '?';
}

function roleBadgeClass(role) {
  if (role === 'superadmin') return 'bg-violet-100 text-violet-800';
  if (role === 'admin') return 'bg-blue-100 text-blue-800';
  if (role === 'agent') return 'bg-emerald-100 text-emerald-800';
  return 'bg-gray-100 text-gray-700';
}

function formatRole(role) {
  if (role === 'superadmin') return 'Superadmin';
  if (role === 'admin') return 'Admin';
  if (role === 'agent') return 'Agent';
  return role;
}

const apiErr = (err) =>
  err.response?.data?.error || err.message || 'Something went wrong';

export default function SettingsPage() {
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);

  const canManageUsers =
    user?.role === 'superadmin' || user?.role === 'admin';

  const [name, setName] = useState('');
  const [profileMsg, setProfileMsg] = useState({ type: '', text: '' });
  const [profileSaving, setProfileSaving] = useState(false);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pwMsg, setPwMsg] = useState({ type: '', text: '' });
  const [pwSaving, setPwSaving] = useState(false);

  const [users, setUsers] = useState([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [usersError, setUsersError] = useState('');

  const [showAdd, setShowAdd] = useState(false);
  const [addEmail, setAddEmail] = useState('');
  const [addName, setAddName] = useState('');
  const [addRole, setAddRole] = useState('admin');
  const [addSaving, setAddSaving] = useState(false);
  const [addMsg, setAddMsg] = useState({ type: '', text: '' });

  const avatarInputRef = useRef(null);
  const pwSectionRef = useRef(null);
  const searchParams = useSearchParams();
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarMsg, setAvatarMsg] = useState({ type: '', text: '' });

  useEffect(() => {
    if (searchParams.get('mode') === 'change-password') {
      pwSectionRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [searchParams]);

  useEffect(() => {
    if (user?.name != null) {
      setName(user.name || '');
    }
  }, [user?.name, user?.id]);

  const loadUsers = useCallback(async () => {
    if (!canManageUsers) return;
    setUsersLoading(true);
    setUsersError('');
    try {
      const res = await fetchUsers();
      setUsers(res.data || []);
    } catch (err) {
      setUsersError(apiErr(err));
    } finally {
      setUsersLoading(false);
    }
  }, [canManageUsers]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setProfileMsg({ type: '', text: '' });
    if (!name.trim()) {
      setProfileMsg({ type: 'err', text: 'Name is required' });
      return;
    }
    setProfileSaving(true);
    try {
      const res = await patchProfile(name.trim());
      if (res.success && res.data?.user) {
        setUser(res.data.user);
        setProfileMsg({ type: 'ok', text: 'Name updated' });
      }
    } catch (err) {
      setProfileMsg({ type: 'err', text: apiErr(err) });
    } finally {
      setProfileSaving(false);
    }
  };

  const handleAvatarFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setAvatarMsg({ type: '', text: '' });
    setAvatarUploading(true);
    try {
      const res = await uploadAvatarRequest(file);
      if (res.success && res.data?.user) {
        setUser(res.data.user);
        setAvatarMsg({ type: 'ok', text: 'Photo updated' });
      }
    } catch (err) {
      setAvatarMsg({ type: 'err', text: apiErr(err) });
    } finally {
      setAvatarUploading(false);
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setPwMsg({ type: '', text: '' });
    if (newPassword.length < 8) {
      setPwMsg({ type: 'err', text: 'New password must be at least 8 characters' });
      return;
    }
    if (newPassword !== confirmPassword) {
      setPwMsg({ type: 'err', text: 'New passwords do not match' });
      return;
    }
    setPwSaving(true);
    try {
      await changePasswordRequest(currentPassword, newPassword);
      setPwMsg({ type: 'ok', text: 'Password changed' });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      setPwMsg({ type: 'err', text: apiErr(err) });
    } finally {
      setPwSaving(false);
    }
  };

  const handleAddUser = async (e) => {
    e.preventDefault();
    setAddMsg({ type: '', text: '' });
    if (!addEmail.trim() || !addName.trim()) {
      setAddMsg({ type: 'err', text: 'Email and name are required' });
      return;
    }
    setAddSaving(true);
    try {
      const res = await createUserRequest({
        email: addEmail.trim(),
        name: addName.trim(),
        role: addRole,
      });
      const emailed = res.emailSent === true;
      setAddMsg({
        type: emailed ? 'ok' : 'warn',
        text:
          res.message ||
          (emailed ? 'User created' : 'User created but email was not sent'),
      });
      await loadUsers();
      if (emailed) {
        setAddEmail('');
        setAddName('');
        setAddRole('admin');
        setTimeout(() => setShowAdd(false), 1000);
      }
    } catch (err) {
      setAddMsg({ type: 'err', text: apiErr(err) });
    } finally {
      setAddSaving(false);
    }
  };

  const handleDeleteUser = async (row) => {
    if (
      !window.confirm(
        `Remove ${row.name || row.email}? They will no longer be able to sign in.`
      )
    ) {
      return;
    }
    try {
      await deleteUserRequest(row.id);
      await loadUsers();
    } catch (err) {
      window.alert(apiErr(err));
    }
  };

  return (
    <div className="h-[calc(100vh-80px)] flex-1 overflow-y-auto bg-[#fbfbfd]">
      <div className="max-w-[1000px] w-full mx-auto px-10 py-16">
        <h1 className="text-[28px] font-bold text-[#1e293b] mb-2">Settings</h1>
        <p className="text-sm text-[#64748b] mb-12">
          {canManageUsers
            ? 'Update your profile and manage dashboard accounts.'
            : 'Update your profile and password.'}
        </p>

        {user?.must_change_password && (
          <div className="mb-8 p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-3 shadow-sm">
            <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-bold text-amber-900">Password Change Required</p>
              <p className="text-sm text-amber-800">
                An administrator has requested that you change your password. Please complete this before continuing.
              </p>
            </div>
          </div>
        )}

        {/* Profile + password */}
        <div className="flex justify-between items-start gap-12 mb-16 px-4">
          <div className="flex-1 w-full mt-2 space-y-10">
            <form onSubmit={handleSaveProfile} className="space-y-6">
              <h2 className="text-lg font-bold text-[#1e293b]">Profile</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-6">
                <div className="flex flex-col gap-3 sm:col-span-2">
                  <label
                    htmlFor="settings-name"
                    className="text-[13px] font-bold text-gray-500"
                  >
                    Name
                  </label>
                  <input
                    id="settings-name"
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="bg-[#f4f7fa] border border-transparent focus:border-[#2563eb] rounded-xl px-5 py-3.5 text-[15px] text-[#1e293b] font-medium outline-none transition-colors max-w-xl"
                  />
                </div>
              </div>
              {profileMsg.text && (
                <p
                  className={cn(
                    'text-sm',
                    profileMsg.type === 'ok' ? 'text-green-600' : 'text-red-600'
                  )}
                >
                  {profileMsg.text}
                </p>
              )}
              <button
                type="submit"
                disabled={profileSaving}
                className="bg-[#3b5998] hover:bg-[#2a437a] disabled:opacity-60 text-white px-6 py-2.5 rounded-lg font-bold text-[14px] transition-colors"
              >
                {profileSaving ? 'Saving…' : 'Save name'}
              </button>
            </form>

            <form 
              ref={pwSectionRef}
              onSubmit={handleChangePassword} 
              className={cn("space-y-6 pt-6 border-t border-gray-200", user?.must_change_password && "ring-2 ring-amber-500/20 bg-amber-50/10 p-6 rounded-2xl")}
            >
              <h2 className="text-lg font-bold text-[#1e293b]">Password</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-6">
                <div className="flex flex-col gap-3">
                  <label className="text-[13px] font-bold text-gray-500">
                    Current password
                  </label>
                  <input
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    autoComplete="current-password"
                    className="bg-[#f4f7fa] border border-transparent focus:border-[#2563eb] rounded-xl px-5 py-3.5 text-[15px] text-[#1e293b] font-medium outline-none transition-colors"
                  />
                </div>
                <div className="flex flex-col gap-3">
                  <label className="text-[13px] font-bold text-gray-500">
                    New password
                  </label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    autoComplete="new-password"
                    className="bg-[#f4f7fa] border border-transparent focus:border-[#2563eb] rounded-xl px-5 py-3.5 text-[15px] text-[#1e293b] font-medium outline-none transition-colors"
                  />
                </div>
                <div className="flex flex-col gap-3 sm:col-span-2 max-w-xl">
                  <label className="text-[13px] font-bold text-gray-500">
                    Confirm new password
                  </label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    autoComplete="new-password"
                    className="bg-[#f4f7fa] border border-transparent focus:border-[#2563eb] rounded-xl px-5 py-3.5 text-[15px] text-[#1e293b] font-medium outline-none transition-colors w-full"
                  />
                </div>
              </div>
              {pwMsg.text && (
                <p
                  className={cn(
                    'text-sm',
                    pwMsg.type === 'ok' ? 'text-green-600' : 'text-red-600'
                  )}
                >
                  {pwMsg.text}
                </p>
              )}
              <button
                type="submit"
                disabled={pwSaving}
                className="bg-white border-2 border-[#3b5998] text-[#3b5998] hover:bg-[#eff6ff] disabled:opacity-60 px-6 py-2.5 rounded-lg font-bold text-[14px] transition-colors"
              >
                {pwSaving ? 'Updating…' : 'Change password'}
              </button>
            </form>
          </div>

          <div className="w-[240px] bg-[#f4f7fa] rounded-[20px] p-8 flex flex-col items-center shrink-0 shadow-sm border border-gray-100">
            <input
              ref={avatarInputRef}
              type="file"
              accept="image/jpeg,image/png,image/gif,image/webp"
              className="hidden"
              onChange={handleAvatarFile}
            />
            <div className="w-[120px] h-[120px] bg-white rounded-2xl shadow-sm relative flex items-center justify-center mb-6 overflow-hidden">
              {getAvatarSrc(user) ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={getAvatarSrc(user)}
                  alt=""
                  className="w-full h-full object-cover"
                />
              ) : (
                <User className="w-14 h-14 text-gray-400 mt-4" />
              )}
              <button
                type="button"
                disabled={avatarUploading}
                onClick={() => avatarInputRef.current?.click()}
                className="absolute -bottom-2 -right-2 bg-[#3b5998] hover:bg-[#2a437a] disabled:opacity-60 text-white p-2 rounded-full shadow-md cursor-pointer transition-colors border-2 border-[#f4f7fa]"
                title="Change profile picture (max 2 MB, JPG/PNG/GIF/WebP)"
              >
                <Pencil className="w-[14px] h-[14px]" />
              </button>
            </div>
            <p className="text-[11px] font-bold text-[#3b5998] tracking-widest uppercase">
              Profile picture
            </p>
            {avatarUploading && (
              <p className="text-xs text-[#64748b] mt-2">Uploading…</p>
            )}
            {avatarMsg.text && (
              <p
                className={cn(
                  'text-xs mt-2 text-center',
                  avatarMsg.type === 'ok' ? 'text-green-600' : 'text-red-600'
                )}
              >
                {avatarMsg.text}
              </p>
            )}
          </div>
        </div>

        {/* User management — superadmin & admin only */}
        {canManageUsers && (
          <>
            <div className="flex justify-between items-center mb-6 px-4">
              <div className="inline-block border-b-[3px] border-[#3b5998] pb-1.5">
                <h2 className="text-[22px] font-bold text-[#1e293b] pr-2">
                  Total users: {usersLoading ? '…' : users.length}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowAdd(true);
                  setAddMsg({ type: '', text: '' });
                }}
                className="bg-[#3b5998] hover:bg-[#2a437a] text-white px-8 py-2.5 rounded-lg flex items-center gap-2 font-bold text-[14px] transition-colors shadow-sm"
              >
                <Plus className="w-[18px] h-[18px]" strokeWidth={2.5} />
                Add user
              </button>
            </div>

            {usersError && (
              <p className="text-sm text-red-600 mb-4 px-4">{usersError}</p>
            )}

            <div className="bg-white rounded-2xl overflow-hidden shadow-[0_2px_12px_rgba(0,0,0,0.03)] border border-gray-100/50 mb-12">
              <div className="bg-[#f8f9fc] px-6 sm:px-10 py-4 grid grid-cols-[1fr_auto_auto] gap-4 items-center border-b border-gray-100 text-[12px] font-bold text-[#64748b] tracking-wider uppercase">
                <span>User</span>
                <span className="hidden sm:block text-center">Role</span>
                <span className="text-right">Actions</span>
              </div>
              <div className="divide-y divide-gray-100">
                {usersLoading ? (
                  <div className="px-10 py-10 text-center text-gray-500 text-sm">
                    Loading users…
                  </div>
                ) : (
                  users.map((row, i) => (
                    <div
                      key={row.id}
                      className="px-6 sm:px-10 py-5 grid grid-cols-[1fr_auto_auto] gap-4 items-center hover:bg-gray-50/50 transition-colors"
                    >
                      <div className="flex items-center gap-5 min-w-0">
                        <div
                          className={cn(
                            'w-12 h-12 rounded-[14px] flex items-center justify-center font-bold text-[15px] shrink-0 overflow-hidden',
                            !getAvatarSrc(row) && AVATAR_COLORS[i % AVATAR_COLORS.length]
                          )}
                        >
                          {getAvatarSrc(row) ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={getAvatarSrc(row)}
                              alt=""
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            initialsFromName(row.name || row.email)
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="text-[16px] font-bold text-[#1e293b] truncate">
                            {row.name || '—'}
                          </p>
                          <p className="text-[13px] font-medium text-gray-500 truncate">
                            {row.email}
                          </p>
                        </div>
                      </div>
                      <span
                        className={cn(
                          'hidden sm:inline-flex justify-center px-2.5 py-1 rounded-md text-[11px] font-bold uppercase tracking-wide',
                          roleBadgeClass(row.role)
                        )}
                      >
                        {formatRole(row.role)}
                      </span>
                      <div className="flex justify-end">
                        {row.id === user?.id ? (
                          <span className="text-xs text-gray-400">You</span>
                        ) : row.role === 'superadmin' && user?.role === 'admin' ? (
                          <span className="text-xs text-gray-400 max-w-[100px] text-right">
                            Protected
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleDeleteUser(row)}
                            className="p-2 rounded-lg text-red-600 hover:bg-red-50 transition-colors"
                            title="Remove user"
                          >
                            <Trash2 className="w-5 h-5" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </>
        )}

        {user?.role === 'agent' && (
          <p className="text-sm text-[#64748b] px-4">
            Agent workspace uses a different layout elsewhere; this page is for your account only.
          </p>
        )}
      </div>

      {/* Add user modal */}
      {showAdd && canManageUsers && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40">
          <div
            className="bg-white rounded-2xl shadow-xl max-w-md w-full p-8 border border-gray-100"
            role="dialog"
            aria-modal="true"
            aria-labelledby="add-user-title"
          >
            <h3 id="add-user-title" className="text-lg font-bold text-[#1e293b] mb-6">
              New user
            </h3>
            <form onSubmit={handleAddUser} className="space-y-4">
              <div>
                <label className="block text-[13px] font-bold text-gray-500 mb-1.5">
                  Email
                </label>
                <input
                  type="email"
                  required
                  value={addEmail}
                  onChange={(e) => setAddEmail(e.target.value)}
                  className="w-full bg-[#f4f7fa] border border-transparent focus:border-[#2563eb] rounded-xl px-4 py-3 text-sm outline-none"
                />
              </div>
              <div>
                <label className="block text-[13px] font-bold text-gray-500 mb-1.5">
                  Name
                </label>
                <input
                  type="text"
                  required
                  value={addName}
                  onChange={(e) => setAddName(e.target.value)}
                  className="w-full bg-[#f4f7fa] border border-transparent focus:border-[#2563eb] rounded-xl px-4 py-3 text-sm outline-none"
                />
              </div>
              <div>
                <label className="block text-[13px] font-bold text-gray-500 mb-1.5">
                  Role
                </label>
                <select
                  value={addRole}
                  onChange={(e) => setAddRole(e.target.value)}
                  className="w-full bg-[#f4f7fa] border border-transparent focus:border-[#2563eb] rounded-xl px-4 py-3 text-sm outline-none"
                >
                  {user?.role === 'superadmin' && (
                    <option value="superadmin">Superadmin</option>
                  )}
                  <option value="admin">Admin</option>
                  <option value="agent">Agent</option>
                </select>
              </div>
              {addMsg.text && (
                <p
                  className={cn(
                    'text-sm',
                    addMsg.type === 'ok' && 'text-green-600',
                    addMsg.type === 'warn' && 'text-amber-800',
                    addMsg.type === 'err' && 'text-red-600'
                  )}
                >
                  {addMsg.text}
                </p>
              )}
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowAdd(false)}
                  className="flex-1 py-2.5 rounded-lg border border-gray-200 font-semibold text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={addSaving}
                  className="flex-1 py-2.5 rounded-lg bg-[#3b5998] text-white font-semibold hover:bg-[#2a437a] disabled:opacity-60"
                >
                  {addSaving ? 'Creating…' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
