'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import api from '@/lib/api';

type Section = 'photo' | 'personal' | 'password' | 'verification' | 'account';

function SectionCard({ id, active, title, icon, onClick, children }: {
  id: Section; active: Section; title: string; icon: React.ReactNode;
  onClick: (s: Section) => void; children: React.ReactNode;
}) {
  const open = active === id;
  return (
    <div className={`bg-white rounded-xl shadow-sm border transition-all ${open ? 'border-blue-200' : 'border-gray-100'}`}>
      <button
        onClick={() => onClick(open ? ('' as Section) : id)}
        className="w-full flex items-center justify-between px-6 py-4 text-left"
      >
        <div className="flex items-center gap-3">
          <span className={`p-2 rounded-lg ${open ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-500'}`}>{icon}</span>
          <span className="font-semibold text-gray-800">{title}</span>
        </div>
        <svg className={`w-5 h-5 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && <div className="px-6 pb-6 border-t border-gray-100 pt-4">{children}</div>}
    </div>
  );
}

function Toast({ msg, type, onClose }: { msg: string; type: 'ok' | 'err'; onClose: () => void }) {
  useEffect(() => { const t = setTimeout(onClose, 3500); return () => clearTimeout(t); }, [onClose]);
  return (
    <div className={`fixed top-5 right-5 z-50 flex items-center gap-3 px-5 py-3 rounded-xl shadow-lg text-sm font-medium transition-all ${type === 'ok' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'}`}>
      <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        {type === 'ok'
          ? <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          : <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126z" />
        }
      </svg>
      {msg}
      <button onClick={onClose} className="ml-2 opacity-70 hover:opacity-100">✕</button>
    </div>
  );
}

export default function SettingsPage() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);

  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeSection, setActiveSection] = useState<Section>('photo');
  const [toast, setToast] = useState<{ msg: string; type: 'ok' | 'err' } | null>(null);

  // Photo state
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [savingPhoto, setSavingPhoto] = useState(false);

  // Personal info state
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [savingInfo, setSavingInfo] = useState(false);

  // Password state
  const [currentPwd, setCurrentPwd] = useState('');
  const [newPwd, setNewPwd] = useState('');
  const [confirmPwd, setConfirmPwd] = useState('');
  const [showPwds, setShowPwds] = useState({ cur: false, new: false, confirm: false });
  const [savingPwd, setSavingPwd] = useState(false);

  // Resend OTP
  const [sendingOtp, setSendingOtp] = useState(false);

  const notify = (msg: string, type: 'ok' | 'err' = 'ok') => setToast({ msg, type });

  useEffect(() => {
    const token = api.getToken();
    if (!token) { router.push('/login'); return; }
    api.getMe()
      .then(u => {
        setUser(u);
        setFirstName(u.first_name || '');
        setLastName(u.last_name || '');
        setAvatarPreview(u.avatar_url || null);
      })
      .catch(() => router.push('/login'))
      .finally(() => setLoading(false));
  }, [router]);

  /* ── Profile Photo ── */
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { notify('Image must be under 2 MB', 'err'); return; }
    const reader = new FileReader();
    reader.onload = ev => setAvatarPreview(ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  const handleSavePhoto = async () => {
    setSavingPhoto(true);
    try {
      const updated = await api.updateAvatar(avatarPreview || '');
      setUser(updated);
      notify('Profile photo updated!');
    } catch (err: any) {
      notify(err.message || 'Failed to save photo', 'err');
    } finally {
      setSavingPhoto(false);
    }
  };

  const handleRemovePhoto = async () => {
    setAvatarPreview(null);
    setSavingPhoto(true);
    try {
      const updated = await api.updateAvatar('');
      setUser(updated);
      notify('Profile photo removed');
    } catch (err: any) {
      notify(err.message || 'Failed to remove photo', 'err');
    } finally {
      setSavingPhoto(false);
    }
  };

  /* ── Personal Info ── */
  const handleSaveInfo = async () => {
    if (!firstName.trim()) { notify('First name cannot be empty', 'err'); return; }
    setSavingInfo(true);
    try {
      const updated = await api.updateMe({ first_name: firstName.trim(), last_name: lastName.trim() });
      setUser(updated);
      notify('Name updated successfully!');
    } catch (err: any) {
      notify(err.message || 'Failed to update name', 'err');
    } finally {
      setSavingInfo(false);
    }
  };

  /* ── Password Change ── */
  const handleChangePassword = async () => {
    if (!currentPwd) { notify('Enter your current password', 'err'); return; }
    if (newPwd.length < 8) { notify('New password must be at least 8 characters', 'err'); return; }
    if (newPwd !== confirmPwd) { notify('Passwords do not match', 'err'); return; }
    setSavingPwd(true);
    try {
      await api.changePassword(currentPwd, newPwd);
      setCurrentPwd(''); setNewPwd(''); setConfirmPwd('');
      notify('Password changed successfully!');
    } catch (err: any) {
      notify(err.message || 'Failed to change password', 'err');
    } finally {
      setSavingPwd(false);
    }
  };

  /* ── Email Verification ── */
  const handleSendOtp = async () => {
    setSendingOtp(true);
    try {
      await api.sendOTP();
      notify('Verification code sent! Check your email.');
      setTimeout(() => router.push('/verify-email'), 1500);
    } catch (err: any) {
      if (err.message === 'Email is already verified.') notify('Email already verified ✓');
      else notify(err.message || 'Failed to send OTP', 'err');
    } finally {
      setSendingOtp(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
      </div>
    );
  }

  const initials = ((user?.first_name?.[0] || '') + (user?.last_name?.[0] || '') || user?.email?.[0] || '?').toUpperCase();

  return (
    <div className="min-h-screen bg-gray-50">
      {toast && <Toast msg={toast.msg} type={toast.type} onClose={() => setToast(null)} />}

      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center gap-3">
          <Link href="/dashboard" className="text-gray-400 hover:text-gray-700 transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
            </svg>
          </Link>
          <h1 className="text-xl font-bold text-gray-900">Settings</h1>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8 space-y-4">

        {/* ── Profile Photo ── */}
        <SectionCard id="photo" active={activeSection} title="Profile Photo" onClick={setActiveSection}
          icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" /></svg>}
        >
          <div className="flex items-center gap-6">
            {/* Avatar preview */}
            <div className="w-24 h-24 rounded-full overflow-hidden bg-gradient-to-br from-blue-400 to-indigo-500 flex-shrink-0 border-4 border-white shadow-md">
              {avatarPreview
                ? <img src={avatarPreview} alt="avatar" className="w-full h-full object-cover" />
                : <span className="w-full h-full flex items-center justify-center text-3xl font-bold text-white">{initials}</span>
              }
            </div>
            <div className="flex-1 space-y-3">
              <p className="text-sm text-gray-500">Upload a profile picture (JPG, PNG, WebP · max 2 MB)</p>
              <div className="flex flex-wrap gap-2">
                <button onClick={() => fileRef.current?.click()}
                  className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition font-medium">
                  {avatarPreview ? 'Change Photo' : 'Upload Photo'}
                </button>
                {avatarPreview && (
                  <button onClick={handleRemovePhoto} disabled={savingPhoto}
                    className="px-4 py-2 border border-red-300 text-red-600 text-sm rounded-lg hover:bg-red-50 transition font-medium disabled:opacity-50">
                    Remove
                  </button>
                )}
                {avatarPreview && avatarPreview !== (user?.avatar_url || null) && (
                  <button onClick={handleSavePhoto} disabled={savingPhoto}
                    className="px-4 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 transition font-medium disabled:opacity-50">
                    {savingPhoto ? 'Saving...' : 'Save Photo'}
                  </button>
                )}
              </div>
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
            </div>
          </div>
        </SectionCard>

        {/* ── Personal Info ── */}
        <SectionCard id="personal" active={activeSection} title="Personal Information" onClick={setActiveSection}
          icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" /></svg>}
        >
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5">First Name</label>
                <input value={firstName} onChange={e => setFirstName(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-400 bg-gray-50 focus:bg-white transition"
                  placeholder="First name" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5">Last Name</label>
                <input value={lastName} onChange={e => setLastName(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-400 bg-gray-50 focus:bg-white transition"
                  placeholder="Last name" />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5">Email Address</label>
              <input value={user?.email || ''} disabled
                className="w-full px-3.5 py-2.5 border border-gray-200 rounded-lg text-sm bg-gray-100 text-gray-400 cursor-not-allowed" />
              <p className="text-xs text-gray-400 mt-1">Email cannot be changed.</p>
            </div>
            <button onClick={handleSaveInfo} disabled={savingInfo}
              className="px-6 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition">
              {savingInfo ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </SectionCard>

        {/* ── Password ── */}
        <SectionCard id="password" active={activeSection} title="Change Password" onClick={setActiveSection}
          icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" /></svg>}
        >
          <div className="space-y-4">
            {(['cur', 'new', 'confirm'] as const).map((key) => {
              const labels = { cur: 'Current Password', new: 'New Password (min 8 chars)', confirm: 'Confirm New Password' };
              const values = { cur: currentPwd, new: newPwd, confirm: confirmPwd };
              const setters = { cur: setCurrentPwd, new: setNewPwd, confirm: setConfirmPwd };
              return (
                <div key={key}>
                  <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5">{labels[key]}</label>
                  <div className="relative">
                    <input
                      type={showPwds[key] ? 'text' : 'password'}
                      value={values[key]}
                      onChange={e => setters[key](e.target.value)}
                      className="w-full px-3.5 py-2.5 pr-10 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-400 bg-gray-50 focus:bg-white transition"
                      placeholder="••••••••"
                    />
                    <button type="button" onClick={() => setShowPwds(p => ({ ...p, [key]: !p[key] }))}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                      {showPwds[key]
                        ? <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" /></svg>
                        : <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                      }
                    </button>
                  </div>
                </div>
              );
            })}
            {/* Password strength indicator */}
            {newPwd && (
              <div className="space-y-1">
                <div className="flex gap-1">
                  {[8, 10, 14].map((len, i) => (
                    <div key={i} className={`h-1.5 flex-1 rounded-full transition-colors ${
                      newPwd.length >= len
                        ? i === 0 ? 'bg-red-400' : i === 1 ? 'bg-yellow-400' : 'bg-green-500'
                        : 'bg-gray-200'
                    }`} />
                  ))}
                </div>
                <p className="text-xs text-gray-400">
                  {newPwd.length < 8 ? 'Too short' : newPwd.length < 10 ? 'Weak' : newPwd.length < 14 ? 'Good' : 'Strong'}
                </p>
              </div>
            )}
            {newPwd && confirmPwd && newPwd !== confirmPwd && (
              <p className="text-xs text-red-500">Passwords do not match</p>
            )}
            <button onClick={handleChangePassword} disabled={savingPwd}
              className="px-6 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition">
              {savingPwd ? 'Changing...' : 'Change Password'}
            </button>
            <p className="text-xs text-gray-400">
              Forgot password?{' '}
              <Link href="/forgot-password" className="text-blue-600 hover:underline">Reset via email</Link>
            </p>
          </div>
        </SectionCard>

        {/* ── Email Verification ── */}
        <SectionCard id="verification" active={activeSection} title="Email Verification" onClick={setActiveSection}
          icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" /></svg>}
        >
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-4 rounded-xl border bg-gray-50">
              <svg className="w-5 h-5 text-gray-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
              </svg>
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-700">{user?.email}</p>
                <p className="text-xs text-gray-400 mt-0.5">Your registered email address</p>
              </div>
              <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${user?.email_verified ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                {user?.email_verified ? '✓ Verified' : '⏳ Pending'}
              </span>
            </div>
            {user?.email_verified ? (
              <div className="flex items-center gap-2 text-sm text-green-600">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Your email is verified. No action needed.
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-gray-500">Your email is not yet verified. Verify to unlock all features.</p>
                <button onClick={handleSendOtp} disabled={sendingOtp}
                  className="px-6 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition">
                  {sendingOtp ? 'Sending...' : 'Send Verification Code'}
                </button>
                <p className="text-xs text-gray-400">A 6-digit code will be sent to your email.</p>
              </div>
            )}
          </div>
        </SectionCard>

        {/* ── Account Info ── */}
        <SectionCard id="account" active={activeSection} title="Account Information" onClick={setActiveSection}
          icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" /></svg>}
        >
          <div className="space-y-3">
            {[
              { label: 'Account ID', value: user?.id },
              { label: 'Email', value: user?.email },
              { label: 'Role', value: user?.role?.charAt(0).toUpperCase() + user?.role?.slice(1) },
              { label: 'Member Since', value: user?.created_at ? new Date(user.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : '—' },
              { label: 'Last Login', value: user?.last_login_at ? new Date(user.last_login_at).toLocaleString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—' },
              { label: 'Account Status', value: user?.is_active ? 'Active' : 'Inactive' },
            ].map(({ label, value }) => (
              <div key={label} className="flex justify-between items-center py-2 border-b border-gray-100 last:border-0">
                <span className="text-sm text-gray-500">{label}</span>
                <span className={`text-sm font-medium ${label === 'Account Status' ? (user?.is_active ? 'text-green-600' : 'text-red-500') : 'text-gray-800'} max-w-xs truncate text-right`}>
                  {value || '—'}
                </span>
              </div>
            ))}
          </div>
        </SectionCard>

        {/* Danger Zone */}
        <div className="bg-white rounded-xl shadow-sm border border-red-100 p-6">
          <h3 className="font-semibold text-red-600 mb-1">Danger Zone</h3>
          <p className="text-sm text-gray-500 mb-4">Permanently delete your account and all data. This cannot be undone.</p>
          <button
            onClick={() => notify('To delete your account, please contact support.', 'err')}
            className="px-5 py-2 border border-red-300 text-red-600 text-sm rounded-lg hover:bg-red-50 font-medium transition"
          >
            Delete Account
          </button>
        </div>

      </main>
    </div>
  );
}
