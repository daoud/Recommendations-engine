// frontend/src/components/Navbar.tsx
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useEffect, useState } from 'react';
import api from '@/lib/api';

/* ── Role-based nav links ── */
const candidateLinks = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/jobs', label: 'Jobs' },
  { href: '/applications', label: 'My Applications' },
  { href: '/profile', label: 'Profile' },
];

const recruiterLinks = [
  { href: '/recruiter', label: 'Dashboard' },
  { href: '/recruiter/post-job', label: 'Post Job' },
  { href: '/recruiter/my-jobs', label: 'My Postings' },
  { href: '/recruiter/candidates', label: 'Candidates' },
  { href: '/recruiter/talents', label: 'Talents' },
  
];

const adminLinks = [
  { href: '/admin/dashboard', label: 'Dashboard' },
  { href: '/admin/users', label: 'Users' },
  { href: '/admin/jobs', label: 'Jobs' },
  { href: '/admin/skills', label: 'Skills Taxonomy' },
];

function getNavLinks(role: string | undefined) {
  switch (role) {
    case 'recruiter': return recruiterLinks;
    case 'admin':     return adminLinks;
    default:          return candidateLinks;
  }
}

function getHomePath(role: string | undefined) {
  switch (role) {
    case 'recruiter': return '/recruiter';
    case 'admin':     return '/admin/dashboard';
    default:          return '/dashboard';
  }
}

export default function Navbar() {
  const { user, logout } = useAuth();
  const pathname = usePathname();
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      api.getMe().then(u => setAvatarUrl(u.avatar_url || null)).catch(() => {});
    }
  }, [user]);

  if (!user) return null;

  const navLinks = getNavLinks(user.role);

  return (
    <nav className="bg-white shadow-sm border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          {/* Left: Logo + Links */}
          <div className="flex items-center">
            <Link href={getHomePath(user.role)} className="text-xl font-bold text-blue-600">
              JobMatch AI
            </Link>
            <div className="ml-10 hidden sm:flex space-x-4">
              {navLinks.map((link) => {
                const isActive = pathname === link.href || pathname.startsWith(link.href + '/');
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                      isActive
                        ? 'text-gray-900 bg-gray-100'
                        : 'text-gray-500 hover:text-gray-900'
                    }`}
                  >
                    {link.label}
                  </Link>
                );
              })}
            </div>
          </div>

          {/* Right: Bell + User + Settings + Logout */}
          <div className="flex items-center gap-3">
            {/* Notification bell */}
            <button className="text-gray-400 hover:text-gray-600 transition-colors relative">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
              </svg>
            </button>

            {/* Avatar + name + role badge */}
            <div className="flex items-center gap-2">
              {/* Avatar circle */}
              <div className="w-8 h-8 rounded-full overflow-hidden bg-gray-200 flex-shrink-0 border border-gray-300">
                {avatarUrl
                  ? <img src={avatarUrl} alt="avatar" className="w-full h-full object-cover" />
                  : <span className="w-full h-full flex items-center justify-center text-sm font-semibold text-gray-500">
                      {(user.first_name?.[0] || user.email[0]).toUpperCase()}
                    </span>
                }
              </div>
              <div className="text-right hidden sm:block">
                <span className="text-sm text-gray-700 font-medium">
                  {user.first_name} {user.last_name}
                </span>
                <span className={`ml-2 px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider ${
                  user.role === 'recruiter' ? 'bg-purple-100 text-purple-700'
                  : user.role === 'admin'    ? 'bg-red-100 text-red-700'
                  : 'bg-blue-100 text-blue-700'
                }`}>
                  {user.role}
                </span>
              </div>
            </div>

            {/* Settings gear icon */}
            <Link href="/settings" title="Settings"
              className={`text-gray-400 hover:text-gray-700 transition-colors ${pathname === '/settings' ? 'text-blue-600' : ''}`}>
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 010 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 010-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </Link>

            {/* Logout */}
            <button onClick={logout} className="text-sm text-red-500 hover:text-red-700 font-medium transition-colors">
              Logout
            </button>
          </div>
        </div>
      </div>

      {/* Mobile nav */}
      <div className="sm:hidden flex items-center gap-1 px-4 pb-2 overflow-x-auto">
        {navLinks.map((link) => {
          const isActive = pathname === link.href || pathname.startsWith(link.href + '/');
          return (
            <Link
              key={link.href}
              href={link.href}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                isActive
                  ? 'bg-blue-50 text-blue-700'
                  : 'text-gray-500 hover:text-gray-800'
              }`}
            >
              {link.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
