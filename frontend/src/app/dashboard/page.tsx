'use client';

'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import api from '@/lib/api';
import NotificationBell from '@/components/NotificationBell';

interface User {
  id: string;
  email: string;
  role: string;
  first_name?: string;
  last_name?: string;
  email_verified?: boolean;
  preferred_notice_period?: string;
}

interface Profile {
  headline?: string;
  summary?: string;
  location_city?: string;
  location_country?: string;
  years_experience?: number;
  is_verified?: boolean;
  notice_period?: string;
}

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = api.getToken();
    if (!token) {
      router.push('/login');
      return;
    }

    const loadData = async () => {
      try {
        const userData = await api.getMe();
        setUser(userData);

        if (userData.role === 'candidate') {
          try {
            const profileData = await api.getProfile();
            setProfile(profileData);
          } catch (err) {
            // Profile may not exist yet
          }
        }
      } catch (error) {
        console.error('Error loading dashboard:', error);
        router.push('/login');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [router]);

  const handleLogout = () => {
    api.logout();
    router.push('/login');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <div className="flex items-center gap-3">
            <span className="text-gray-600">
              Welcome, {user?.first_name || user?.email}
            </span>
            <NotificationBell />
            <span className="px-2 py-1 text-xs font-medium rounded bg-blue-100 text-blue-800">
              {user?.role}
            </span>
            {/* Settings gear icon */}
            <Link href="/settings" title="Settings" className="text-gray-400 hover:text-gray-700 transition-colors">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 010 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 010-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </Link>
            <button
              onClick={handleLogout}
              className="text-gray-600 hover:text-gray-900"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">

        {/* Email Verification Banner */}
        {user && user.email_verified === false && (
          <div className="bg-yellow-50 border border-yellow-300 rounded-lg p-4 mb-6 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-yellow-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
              </svg>
              <div>
                <p className="text-yellow-800 font-medium text-sm">Please verify your email address</p>
                <p className="text-yellow-700 text-xs mt-0.5">A verification code was sent to <strong>{user.email}</strong></p>
              </div>
            </div>
            <a
              href="/verify-email"
              className="flex-shrink-0 bg-yellow-500 hover:bg-yellow-600 text-white text-sm font-medium px-4 py-2 rounded-md transition"
            >
              Verify Now
            </a>
          </div>
        )}

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {user?.role === 'candidate' && (
            <>
              <Link
                href="/jobs"
                className="bg-blue-600 text-white p-6 rounded-lg shadow hover:bg-blue-700 transition"
              >
                <h3 className="text-lg font-semibold mb-2">Browse Jobs</h3>
                <p className="text-blue-100">Find your next opportunity</p>
              </Link>
              <Link
                href="/applications"
                className="bg-green-600 text-white p-6 rounded-lg shadow hover:bg-green-700 transition"
              >
                <h3 className="text-lg font-semibold mb-2">My Applications</h3>
                <p className="text-green-100">Track your job applications</p>
              </Link>
              <Link
                href="/profile"
                className="bg-purple-600 text-white p-6 rounded-lg shadow hover:bg-purple-700 transition"
              >
                <h3 className="text-lg font-semibold mb-2">My Profile</h3>
                <p className="text-purple-100">Update your profile</p>
              </Link>
              <Link
                href="/recommendations"
                className="bg-orange-600 text-white p-6 rounded-lg shadow hover:bg-orange-700 transition"
              >
                <h3 className="text-lg font-semibold mb-2">Recommendations</h3>
                <p className="text-orange-100">Jobs matched for you</p>
              </Link>
            </>
          )}

          {user?.role === 'recruiter' && (
            <>
              <Link
                href="/recruiter/post-job"
                className="bg-blue-600 text-white p-6 rounded-lg shadow hover:bg-blue-700 transition"
              >
                <h3 className="text-lg font-semibold mb-2">Post a Job</h3>
                <p className="text-blue-100">Create a new job posting</p>
              </Link>
              <Link
                href="/recruiter/my-jobs"
                className="bg-green-600 text-white p-6 rounded-lg shadow hover:bg-green-700 transition"
              >
                <h3 className="text-lg font-semibold mb-2">My Jobs</h3>
                <p className="text-green-100">Manage your job postings</p>
              </Link>
              <Link
                href="/recruiter/dashboard"
                className="bg-purple-600 text-white p-6 rounded-lg shadow hover:bg-purple-700 transition"
              >
                <h3 className="text-lg font-semibold mb-2">Recruiter Dashboard</h3>
                <p className="text-purple-100">View analytics and stats</p>
              </Link>
              <Link
                href="/jobs"
                className="bg-gray-600 text-white p-6 rounded-lg shadow hover:bg-gray-700 transition"
              >
                <h3 className="text-lg font-semibold mb-2">All Jobs</h3>
                <p className="text-gray-100">Browse all job listings</p>
              </Link>
            </>
          )}

          {user?.role === 'admin' && (
            <>
              <Link
                href="/admin/users"
                className="bg-blue-600 text-white p-6 rounded-lg shadow hover:bg-blue-700 transition"
              >
                <h3 className="text-lg font-semibold mb-2">Manage Users</h3>
                <p className="text-blue-100">View and manage all users</p>
              </Link>
              <Link
                href="/admin/jobs"
                className="bg-green-600 text-white p-6 rounded-lg shadow hover:bg-green-700 transition"
              >
                <h3 className="text-lg font-semibold mb-2">Manage Jobs</h3>
                <p className="text-green-100">View and manage all jobs</p>
              </Link>
              <Link
                href="/admin/skills"
                className="bg-purple-600 text-white p-6 rounded-lg shadow hover:bg-purple-700 transition"
              >
                <h3 className="text-lg font-semibold mb-2">Skill Taxonomy</h3>
                <p className="text-purple-100">Manage skill categories</p>
              </Link>
              <Link
                href="/jobs"
                className="bg-gray-600 text-white p-6 rounded-lg shadow hover:bg-gray-700 transition"
              >
                <h3 className="text-lg font-semibold mb-2">All Jobs</h3>
                <p className="text-gray-100">Browse all job listings</p>
              </Link>
            </>
          )}
        </div>

        {/* Profile Summary for Candidates */}
        {user?.role === 'candidate' && profile && (
          <div className="bg-white rounded-lg shadow p-6 mb-8">
            <div className="flex justify-between items-start mb-4">
              <h2 className="text-xl font-semibold text-gray-900">Profile Summary</h2>
              <Link
                href="/profile"
                className="text-blue-600 hover:text-blue-800 text-sm"
              >
                Edit Profile
              </Link>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-gray-600 text-sm">Headline</p>
                <p className="font-medium">{profile.headline || 'Not set'}</p>
              </div>
              <div>
                <p className="text-gray-600 text-sm">Location</p>
                <p className="font-medium">
                  {profile.location_city && profile.location_country
                    ? `${profile.location_city}, ${profile.location_country}`
                    : 'Not set'}
                </p>
              </div>
              <div>
                <p className="text-gray-600 text-sm">Experience</p>
                <p className="font-medium">
                  {profile.years_experience !== undefined
                    ? `${profile.years_experience} years`
                    : 'Not set'}
                </p>
              </div>
              <div>
                <p className="text-gray-600 text-sm">Profile Status</p>
                <p className={`font-medium ${user?.email_verified ? 'text-green-600' : 'text-yellow-600'}`}>
                  {user?.email_verified ? 'Verified' : 'Pending Verification'}
                </p>
              </div>
              <div>
                <p className="text-gray-600 text-sm">Availability</p>
                <p className="font-medium">
                  {profile.notice_period === 'immediate' ? 'Immediately Available'
                    : profile.notice_period === '15_days' ? '15 Days Notice'
                    : profile.notice_period === '30_days' ? '30 Days Notice'
                    : 'Not specified'}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Getting Started for Candidates without Profile */}
        {user?.role === 'candidate' && !profile && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 mb-8">
            <h2 className="text-xl font-semibold text-yellow-800 mb-2">Complete Your Profile</h2>
            <p className="text-yellow-700 mb-4">
              Set up your profile to get personalized job recommendations and apply to jobs.
            </p>
            <Link
              href="/profile"
              className="inline-block bg-yellow-600 text-white px-4 py-2 rounded hover:bg-yellow-700"
            >
              Create Profile
            </Link>
          </div>
        )}

        {/* Recent Activity Placeholder */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Recent Activity</h2>
          <p className="text-gray-500">Your recent activity will appear here.</p>
        </div>
      </main>
    </div>
  );
}




