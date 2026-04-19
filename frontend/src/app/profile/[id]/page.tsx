'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import api from '@/lib/api';

const PROFICIENCY_COLOR: Record<string, string> = {
  expert:       'bg-purple-100 text-purple-700',
  advanced:     'bg-blue-100 text-blue-700',
  intermediate: 'bg-green-100 text-green-700',
  beginner:     'bg-gray-100 text-gray-600',
};

export default function CandidateProfilePage() {
  const params = useParams();
  const router = useRouter();
  const userId = params.id as string;

  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const token = api.getToken();
    if (!token) { router.push('/login'); return; }
    api.getCandidateProfile(userId)
      .then(setProfile)
      .catch(e => setError(e.message || 'Profile not found'))
      .finally(() => setLoading(false));
  }, [userId, router]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
        </div>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <div className="max-w-3xl mx-auto px-4 py-16 text-center">
          <p className="text-5xl mb-4">👤</p>
          <h2 className="text-xl font-semibold text-gray-700 mb-2">Profile Not Found</h2>
          <p className="text-gray-400 text-sm mb-6">{error}</p>
          <button onClick={() => router.back()} className="text-blue-600 hover:underline text-sm">← Go back</button>
        </div>
      </div>
    );
  }

  const fullName = `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || 'Candidate';
  const initials = (profile.first_name?.[0] || '') + (profile.last_name?.[0] || '') || '?';
  const location = [profile.location_city, profile.location_country].filter(Boolean).join(', ');

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      <main className="max-w-3xl mx-auto px-4 py-8">
        {/* Back */}
        <button onClick={() => router.back()} className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800 mb-6 transition-colors">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          Back
        </button>

        {/* Header card */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 mb-5">
          <div className="flex items-start gap-5">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-xl font-bold flex-shrink-0">
              {initials.toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-xl font-bold text-gray-900">{fullName}</h1>
                {profile.is_verified && (
                  <span className="text-xs bg-green-100 text-green-700 font-semibold px-2 py-0.5 rounded-full">Verified</span>
                )}
                {profile.is_open_to_work && (
                  <span className="text-xs bg-blue-100 text-blue-700 font-semibold px-2 py-0.5 rounded-full">Open to Work</span>
                )}
              </div>
              {profile.headline && <p className="text-gray-600 mt-1">{profile.headline}</p>}
              <div className="flex flex-wrap gap-4 mt-2 text-sm text-gray-500">
                {location && (
                  <span className="flex items-center gap-1">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a2 2 0 01-2.828 0l-4.243-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                    {location}
                  </span>
                )}
                {profile.years_experience !== undefined && profile.years_experience !== null && (
                  <span className="flex items-center gap-1">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                    {profile.years_experience} yrs experience
                  </span>
                )}
                {profile.email && (
                  <span className="flex items-center gap-1">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                    {profile.email}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Summary */}
        {profile.summary && (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 mb-5">
            <h2 className="text-base font-semibold text-gray-800 mb-3">About</h2>
            <p className="text-gray-600 text-sm leading-relaxed whitespace-pre-wrap">{profile.summary}</p>
          </div>
        )}

        {/* Skills */}
        {profile.skills && profile.skills.length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 mb-5">
            <h2 className="text-base font-semibold text-gray-800 mb-4">Skills</h2>
            <div className="flex flex-wrap gap-2">
              {profile.skills.map((s: any) => (
                <span key={s.skill_id}
                  className={`px-3 py-1 rounded-full text-xs font-medium ${PROFICIENCY_COLOR[s.proficiency_level] || 'bg-gray-100 text-gray-600'}`}>
                  {s.skill_name}
                  {s.years_experience ? ` · ${s.years_experience}y` : ''}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Desired role */}
        {profile.desired_role && (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
            <h2 className="text-base font-semibold text-gray-800 mb-2">Looking For</h2>
            <p className="text-gray-600 text-sm">{profile.desired_role}</p>
          </div>
        )}
      </main>
    </div>
  );
}
