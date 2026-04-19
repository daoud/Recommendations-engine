'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import api from '@/lib/api';

type Section = 'photo' | 'personal' | 'password' | 'notice' | 'verification' | 'account' | '';

const NOTICE_OPTIONS_CANDIDATE = [
  { value: 'immediate', label: 'Immediately Available' },
  { value: '15_days',   label: '15 Days Notice' },
  { value: '30_days',   label: '30 Days Notice' },
];
const NOTICE_OPTIONS_RECRUITER = [
  { value: 'immediate', label: 'Immediate Joiners Only' },
  { value: '15_days',   label: 'Up to 15 Days Notice' },
  { value: '30_days',   label: 'Up to 30 Days Notice' },
];

function SectionCard({ id, active, title, icon, onClick, children }: {
  id: Section; active: Section; title: string; icon: React.ReactNode;
  onClick: (s: Section) => void; children: React.ReactNode;
}) {
  const open = active === id;
  return (
    <div className={`bg-white rounded-xl shadow-sm border transition-all ${open ? 'border-blue-200' : 'border-gray-100'}`}>
      <button
        onClick={() => onClick(open ? '' : id)}
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

function PwdField({ label, value, onChange, show, onToggle }: {
  label: string; value: string; onChange: (v: string) => void;
  show: boolean; onToggle: () => void;
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5">{label}</label>
      <div className="relative">
        <input
          type={show ? 'text' : 'password'}
          value={value}
          onChange={e => onChange(e.target.value)}
          className="w-full px-3.5 py-2.5 pr-11 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-400 bg-gray-50 focus:bg-white transition"
          placeholder="••••••••"
        />
        <button
          type="button"
          onMouseDown={e => e.preventDefault()}
          onClick={onToggle}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700 focus:outline-none"
        >
          {show
            ? <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" /></svg>
            : <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
          }
        </button>
      </div>
    </div>
  );
}

function Toast({ msg, type, onClose }: { msg: string; type: 'ok' | 'err'; onClose: () => void }) {
  useEffect(() => { const t = setTimeout(onClose, 4000); return () => clearTimeout(t); }, [onClose]);
  return (
    <div className={`fixed top-5 right-5 z-50 flex items-center gap-3 px-5 py-3 rounded-xl shadow-lg text-sm font-medium ${type === 'ok' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'}`}>
      <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        {type === 'ok'
          ? <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          : <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126z" />}
      </svg>
      {msg}
      <button onClick={onClose} className="ml-2 opacity-70 hover:opacity-100">✕</button>
    </div>
  );
}

/* ── Delete Account Modal ── */
function DeleteModal({ userName, onClose, onDeleted }: {
  userName: string; onClose: () => void; onDeleted: () => void;
}) {
  const [step, setStep] = useState<'send' | 'confirm'>('send');
  const [otp, setOtp] = useState('');
  const [confirmName, setConfirmName] = useState('');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  const handleSendOTP = async () => {
    setLoading(true); setErr('');
    try {
      await api.sendOTP();
      setStep('confirm');
    } catch (e: any) { setErr(e.message || 'Failed to send code'); }
    finally { setLoading(false); }
  };

  const handleDelete = async () => {
    if (otp.length !== 6) { setErr('Enter the 6-digit code'); return; }
    if (!confirmName.trim()) { setErr('Type your full name to confirm'); return; }
    setLoading(true); setErr('');
    try {
      await api.deleteAccount(otp, confirmName);
      api.clearToken();
      onDeleted();
    } catch (e: any) { setErr(e.message || 'Deletion failed'); }
    finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
            <svg className="w-5 h-5 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126z" />
            </svg>
          </div>
          <div>
            <h3 className="font-bold text-gray-900 text-lg">Delete Account</h3>
            <p className="text-sm text-gray-500">This action is permanent and cannot be undone.</p>
          </div>
        </div>

        {err && <div className="mb-4 px-4 py-2.5 bg-red-50 border border-red-200 text-red-600 text-sm rounded-lg">{err}</div>}

        {step === 'send' ? (
          <div className="space-y-4">
            <p className="text-sm text-gray-600 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
              We will send a one-time verification code to your registered email address. You must also type your full name to confirm.
            </p>
            <div className="flex gap-3">
              <button onClick={onClose} className="flex-1 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50">
                Cancel
              </button>
              <button onClick={handleSendOTP} disabled={loading}
                className="flex-1 py-2.5 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50">
                {loading ? 'Sending...' : 'Send Verification Code'}
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Step 1: OTP */}
            <div>
              <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5">Verification Code (sent to your email)</label>
              <input
                type="text" inputMode="numeric" maxLength={6}
                value={otp} onChange={e => setOtp(e.target.value.replace(/\D/g, ''))}
                placeholder="6-digit code"
                className="w-full px-3.5 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-red-400 focus:border-red-400 bg-gray-50 focus:bg-white transition"
              />
            </div>
            {/* Step 2: Type name */}
            <div>
              <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5">
                Type your full name to confirm: <span className="text-red-600 font-semibold">{userName}</span>
              </label>
              <input
                type="text"
                value={confirmName} onChange={e => setConfirmName(e.target.value)}
                placeholder={userName}
                className="w-full px-3.5 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-red-400 focus:border-red-400 bg-gray-50 focus:bg-white transition"
              />
            </div>
            <div className="flex gap-3">
              <button onClick={onClose} className="flex-1 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50">
                Cancel
              </button>
              <button onClick={handleDelete} disabled={loading || otp.length !== 6 || !confirmName.trim()}
                className="flex-1 py-2.5 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50">
                {loading ? 'Deleting...' : 'Permanently Delete'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function SettingsPage() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);

  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeSection, setActiveSection] = useState<Section>('');
  const [toast, setToast] = useState<{ msg: string; type: 'ok' | 'err' } | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  // Photo
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [savingPhoto, setSavingPhoto] = useState(false);

  // Personal info
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName]   = useState('');
  const [savingInfo, setSavingInfo] = useState(false);

  // Password — explicit state per field to fix eye button
  const [curPwd,     setCurPwd]     = useState('');
  const [newPwd,     setNewPwd]     = useState('');
  const [confirmPwd, setConfirmPwd] = useState('');
  const [showCur,    setShowCur]    = useState(false);
  const [showNew,    setShowNew]    = useState(false);
  const [showConf,   setShowConf]   = useState(false);
  const [savingPwd,  setSavingPwd]  = useState(false);

  // Notice period
  const [noticePeriod, setNoticePeriod] = useState('');
  const [savingNotice, setSavingNotice] = useState(false);

  // OTP (verification)
  const [sendingOtp, setSendingOtp] = useState(false);

  const notify = (msg: string, type: 'ok' | 'err' = 'ok') => setToast({ msg, type });

  useEffect(() => {
    const token = api.getToken();
    if (!token) { router.push('/login'); return; }
    Promise.all([api.getMe(), api.getProfile().catch(() => null)])
      .then(([u, p]) => {
        setUser(u);
        setFirstName(u.first_name || '');
        setLastName(u.last_name || '');
        setAvatarPreview(u.avatar_url || null);
        setNoticePeriod(
          u.role === 'candidate' ? (p?.notice_period || '') : (u.preferred_notice_period || '')
        );
        setProfile(p);
      })
      .catch(() => router.push('/login'))
      .finally(() => setLoading(false));
  }, [router]);

  /* ── Photo ── */
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
    try { const u = await api.updateAvatar(avatarPreview || ''); setUser(u); notify('Profile photo updated!'); }
    catch (e: any) { notify(e.message || 'Failed to save photo', 'err'); }
    finally { setSavingPhoto(false); }
  };

  const handleRemovePhoto = async () => {
    setAvatarPreview(null); setSavingPhoto(true);
    try { const u = await api.updateAvatar(''); setUser(u); notify('Profile photo removed'); }
    catch (e: any) { notify(e.message || 'Failed to remove photo', 'err'); }
    finally { setSavingPhoto(false); }
  };

  /* ── Personal Info ── */
  const handleSaveInfo = async () => {
    if (!firstName.trim()) { notify('First name cannot be empty', 'err'); return; }
    setSavingInfo(true);
    try { const u = await api.updateMe({ first_name: firstName.trim(), last_name: lastName.trim() }); setUser(u); notify('Name updated!'); }
    catch (e: any) { notify(e.message || 'Failed to update name', 'err'); }
    finally { setSavingInfo(false); }
  };

  /* ── Password ── */
  const handleChangePassword = async () => {
    if (!curPwd) { notify('Enter your current password', 'err'); return; }
    if (newPwd.length < 8) { notify('New password must be at least 8 characters', 'err'); return; }
    if (newPwd !== confirmPwd) { notify('Passwords do not match', 'err'); return; }
    setSavingPwd(true);
    try {
      await api.changePassword(curPwd, newPwd);
      setCurPwd(''); setNewPwd(''); setConfirmPwd('');
      setShowCur(false); setShowNew(false); setShowConf(false);
      notify('Password changed successfully!');
    }
    catch (e: any) { notify(e.message || 'Failed to change password', 'err'); }
    finally { setSavingPwd(false); }
  };

  /* ── Notice Period ── */
  const handleSaveNotice = async () => {
    if (!noticePeriod) { notify('Please select a notice period', 'err'); return; }
    setSavingNotice(true);
    try {
      const payload = user?.role === 'candidate'
        ? { notice_period: noticePeriod }
        : { preferred_notice_period: noticePeriod };
      const u = await api.updateMe(payload);
      setUser(u);
      notify('Notice period saved!');
    }
    catch (e: any) { notify(e.message || 'Failed to save', 'err'); }
    finally { setSavingNotice(false); }
  };

  /* ── Email OTP ── */
  const handleSendOtp = async () => {
    setSendingOtp(true);
    try {
      await api.sendOTP();
      notify('Verification code sent! Check your email.');
      setTimeout(() => router.push('/verify-email'), 1500);
    }
    catch (e: any) {
      if (e.message === 'Email is already verified.') notify('Email already verified ✓');
      else notify(e.message || 'Failed to send OTP', 'err');
    }
    finally { setSendingOtp(false); }
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" /></div>;
  }

  const initials = ((user?.first_name?.[0] || '') + (user?.last_name?.[0] || '') || user?.email?.[0] || '?').toUpperCase();
  const userName = `${user?.first_name || ''} ${user?.last_name || ''}`.trim() || user?.email || '';
  const noticeOptions = user?.role === 'recruiter' ? NOTICE_OPTIONS_RECRUITER : NOTICE_OPTIONS_CANDIDATE;
  const noticeLabel  = user?.role === 'recruiter' ? 'Notice Period Expected from Candidates' : 'My Availability / Notice Period';
  const noticeHint   = user?.role === 'recruiter'
    ? 'Set what notice period you expect from candidates when hiring.'
    : 'Let recruiters know when you can start a new role.';

  const pwdStrength = newPwd.length === 0 ? null : newPwd.length < 8 ? 0 : newPwd.length < 10 ? 1 : newPwd.length < 14 ? 2 : 3;

  return (
    <div className="min-h-screen bg-gray-50">
      {toast && <Toast msg={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
      {showDeleteModal && (
        <DeleteModal
          userName={userName}
          onClose={() => setShowDeleteModal(false)}
          onDeleted={() => router.push('/login')}
        />
      )}

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

        {/* Profile Photo */}
        <SectionCard id="photo" active={activeSection} title="Profile Photo" onClick={setActiveSection}
          icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" /></svg>}
        >
          <div className="flex items-center gap-6">
            <div className="w-24 h-24 rounded-full overflow-hidden bg-gradient-to-br from-blue-400 to-indigo-500 flex-shrink-0 border-4 border-white shadow-md">
              {avatarPreview
                ? <img src={avatarPreview} alt="avatar" className="w-full h-full object-cover" />
                : <span className="w-full h-full flex items-center justify-center text-3xl font-bold text-white">{initials}</span>}
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
                    className="px-4 py-2 border border-red-300 text-red-600 text-sm rounded-lg hover:bg-red-50 disabled:opacity-50">Remove</button>
                )}
                {avatarPreview && avatarPreview !== (user?.avatar_url || null) && (
                  <button onClick={handleSavePhoto} disabled={savingPhoto}
                    className="px-4 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 disabled:opacity-50">
                    {savingPhoto ? 'Saving...' : 'Save Photo'}
                  </button>
                )}
              </div>
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
            </div>
          </div>
        </SectionCard>

        {/* Personal Information */}
        <SectionCard id="personal" active={activeSection} title="Personal Information" onClick={setActiveSection}
          icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" /></svg>}
        >
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5">First Name</label>
                <input value={firstName} onChange={e => setFirstName(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 bg-gray-50 focus:bg-white transition"
                  placeholder="First name" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5">Last Name</label>
                <input value={lastName} onChange={e => setLastName(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 bg-gray-50 focus:bg-white transition"
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

        {/* Change Password */}
        <SectionCard id="password" active={activeSection} title="Change Password" onClick={setActiveSection}
          icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" /></svg>}
        >
          <div className="space-y-4">
            <PwdField label="Current Password"          value={curPwd}     onChange={setCurPwd}     show={showCur}  onToggle={() => setShowCur(v => !v)} />
            <PwdField label="New Password (min 8 chars)" value={newPwd}     onChange={setNewPwd}     show={showNew}  onToggle={() => setShowNew(v => !v)} />
            <PwdField label="Confirm New Password"       value={confirmPwd} onChange={setConfirmPwd} show={showConf} onToggle={() => setShowConf(v => !v)} />

            {/* Strength bar */}
            {newPwd && (
              <div className="space-y-1">
                <div className="flex gap-1">
                  {[0,1,2].map(i => (
                    <div key={i} className={`h-1.5 flex-1 rounded-full transition-colors ${
                      (pwdStrength ?? -1) > i
                        ? i === 0 ? 'bg-red-400' : i === 1 ? 'bg-yellow-400' : 'bg-green-500'
                        : 'bg-gray-200'
                    }`} />
                  ))}
                </div>
                <p className="text-xs text-gray-400">
                  {pwdStrength === 0 ? 'Too short' : pwdStrength === 1 ? 'Weak' : pwdStrength === 2 ? 'Good' : 'Strong'}
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

        {/* Notice Period */}
        <SectionCard id="notice" active={activeSection} title={noticeLabel} onClick={setActiveSection}
          icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
        >
          <div className="space-y-4">
            <p className="text-sm text-gray-500">{noticeHint}</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {noticeOptions.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => setNoticePeriod(opt.value)}
                  className={`px-4 py-3 rounded-xl border-2 text-sm font-medium transition-all text-left ${
                    noticePeriod === opt.value
                      ? 'border-blue-500 bg-blue-50 text-blue-700'
                      : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <div className={`w-4 h-4 rounded-full border-2 flex-shrink-0 flex items-center justify-center ${noticePeriod === opt.value ? 'border-blue-500' : 'border-gray-300'}`}>
                      {noticePeriod === opt.value && <div className="w-2 h-2 rounded-full bg-blue-500" />}
                    </div>
                    {opt.label}
                  </div>
                </button>
              ))}
            </div>
            <button onClick={handleSaveNotice} disabled={savingNotice || !noticePeriod}
              className="px-6 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition">
              {savingNotice ? 'Saving...' : 'Save Preference'}
            </button>
          </div>
        </SectionCard>

        {/* Email Verification */}
        <SectionCard id="verification" active={activeSection} title="Email Verification" onClick={setActiveSection}
          icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" /></svg>}
        >
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-4 rounded-xl border bg-gray-50">
              <svg className="w-5 h-5 text-gray-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" /></svg>
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
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                Your email is verified. No action needed.
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-gray-500">Your email is not yet verified. Verify to unlock all features.</p>
                <button onClick={handleSendOtp} disabled={sendingOtp}
                  className="px-6 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition">
                  {sendingOtp ? 'Sending...' : 'Send Verification Code'}
                </button>
              </div>
            )}
          </div>
        </SectionCard>

        {/* Account Information */}
        <SectionCard id="account" active={activeSection} title="Account Information" onClick={setActiveSection}
          icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" /></svg>}
        >
          <div className="space-y-2">
            {[
              { label: 'Account ID',     value: user?.id },
              { label: 'Email',          value: user?.email },
              { label: 'Role',           value: user?.role?.charAt(0).toUpperCase() + user?.role?.slice(1) },
              { label: 'Member Since',   value: user?.created_at ? new Date(user.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : '—' },
              { label: 'Last Login',     value: user?.last_login_at ? new Date(user.last_login_at).toLocaleString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—' },
              { label: 'Account Status', value: user?.is_active ? 'Active' : 'Inactive' },
            ].map(({ label, value }) => (
              <div key={label} className="flex justify-between items-center py-2 border-b border-gray-100 last:border-0">
                <span className="text-sm text-gray-500">{label}</span>
                <span className={`text-sm font-medium max-w-xs truncate text-right ${label === 'Account Status' ? (user?.is_active ? 'text-green-600' : 'text-red-500') : 'text-gray-800'}`}>
                  {value || '—'}
                </span>
              </div>
            ))}
          </div>
        </SectionCard>

        {/* Danger Zone */}
        <div className="bg-white rounded-xl shadow-sm border border-red-100 p-6">
          <h3 className="font-semibold text-red-600 mb-1">Danger Zone</h3>
          <p className="text-sm text-gray-500 mb-4">
            Permanently delete your account and all associated data. You will need to verify your identity before deletion.
          </p>
          <button
            onClick={() => setShowDeleteModal(true)}
            className="px-5 py-2 border border-red-300 text-red-600 text-sm rounded-lg hover:bg-red-50 font-medium transition"
          >
            Delete Account
          </button>
        </div>

      </main>
    </div>
  );
}
