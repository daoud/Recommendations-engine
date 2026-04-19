'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import api, { Job, User } from '@/lib/api';
import Navbar from '@/components/Navbar';
import NotificationBell from '@/components/NotificationBell';

export default function MyJobsPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    const token = api.getToken();
    if (!token) {
      router.push('/login');
      return;
    }
    loadData();
  }, [router]);

  const loadData = async () => {
    try {
      const userData = await api.getMe();
      setUser(userData);

      if (userData.role !== 'recruiter' && userData.role !== 'admin') {
        router.push('/dashboard');
        return;
      }

      const response = await api.getMyJobs();
      setJobs(response.jobs || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load jobs');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleActive = async (job: Job) => {
    setActionLoading(job.id);
    try {
      await api.updateJob(job.id, { is_active: !job.is_active });
      const response = await api.getMyJobs();
      setJobs(response.jobs || []);
    } catch (err: any) {
      alert('Failed to update job: ' + err.message);
    } finally {
      setActionLoading(null);
    }
  };

  const handleDelete = async (jobId: string) => {
    if (!confirm('Are you sure you want to delete this job? This action cannot be undone.')) {
      return;
    }

    setActionLoading(jobId);
    try {
      await api.deleteJob(jobId);
      const response = await api.getMyJobs();
      setJobs(response.jobs || []);
    } catch (err: any) {
      alert('Failed to delete job: ' + err.message);
    } finally {
      setActionLoading(null);
    }
  };

  const filteredJobs = jobs.filter(job => {
    if (filter === 'active') return job.is_active;
    if (filter === 'inactive') return !job.is_active;
    return true;
  });

  const activeCount = jobs.filter(j => j.is_active).length;
  const inactiveCount = jobs.filter(j => !j.is_active).length;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-900">My Posted Jobs</h1>
          <Link href="/recruiter/post-job" className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 font-medium text-sm transition-colors">
            + Post New Job
          </Link>
        </div>
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-6">
            {error}
          </div>
        )}

        {/* Stats Summary */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-3xl font-bold text-gray-900">{jobs.length}</p>
              <p className="text-gray-600">Total Jobs</p>
            </div>
            <div>
              <p className="text-3xl font-bold text-green-600">{activeCount}</p>
              <p className="text-gray-600">Active</p>
            </div>
            <div>
              <p className="text-3xl font-bold text-gray-400">{inactiveCount}</p>
              <p className="text-gray-600">Inactive</p>
            </div>
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setFilter('all')}
            className={`px-4 py-2 rounded-md font-medium ${
              filter === 'all'
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-700 hover:bg-gray-50'
            }`}
          >
            All ({jobs.length})
          </button>
          <button
            onClick={() => setFilter('active')}
            className={`px-4 py-2 rounded-md font-medium ${
              filter === 'active'
                ? 'bg-green-600 text-white'
                : 'bg-white text-gray-700 hover:bg-gray-50'
            }`}
          >
            Active ({activeCount})
          </button>
          <button
            onClick={() => setFilter('inactive')}
            className={`px-4 py-2 rounded-md font-medium ${
              filter === 'inactive'
                ? 'bg-gray-600 text-white'
                : 'bg-white text-gray-700 hover:bg-gray-50'
            }`}
          >
            Inactive ({inactiveCount})
          </button>
        </div>

        {/* Jobs List */}
        {filteredJobs.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-12 text-center">
            <svg className="mx-auto h-16 w-16 text-gray-300 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            <h3 className="text-xl font-medium text-gray-900 mb-2">
              {filter === 'all' ? 'No jobs posted yet' : `No ${filter} jobs`}
            </h3>
            <p className="text-gray-600 mb-6">
              {filter === 'all'
                ? 'Start by posting your first job to attract candidates.'
                : `You don't have any ${filter} jobs at the moment.`}
            </p>
            {filter === 'all' && (
              <Link
                href="/recruiter/post-job"
                className="inline-block bg-blue-600 text-white px-6 py-3 rounded-md hover:bg-blue-700"
              >
                Post Your First Job
              </Link>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {filteredJobs.map((job) => (
              <div
                key={job.id}
                className={`bg-white rounded-lg shadow p-6 border-l-4 ${
                  job.is_active ? 'border-green-500' : 'border-gray-300'
                }`}
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-xl font-semibold text-gray-900">{job.title}</h3>
                      <span
                        className={`px-2 py-1 text-xs font-medium rounded ${
                          job.is_active
                            ? 'bg-green-100 text-green-800'
                            : 'bg-gray-100 text-gray-600'
                        }`}
                      >
                        {job.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                    <p className="text-gray-600 mb-2">{job.company_name}</p>
                    <div className="flex flex-wrap gap-4 text-sm text-gray-500">
                      <span className="flex items-center gap-1">
                        <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                        {job.location_city || 'Not specified'}{job.location_country ? `, ${job.location_country}` : ''}
                      </span>
                      <span className="flex items-center gap-1">
                        <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
                        {job.location_type}
                      </span>
                      <span className="flex items-center gap-1">
                        <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                        {job.employment_type?.replace('_', ' ')}
                      </span>
                      {job.salary_min && job.salary_max && (
                        <span className="flex items-center gap-1">
                          <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                          {job.salary_currency || 'USD'} {job.salary_min.toLocaleString()} - {job.salary_max.toLocaleString()}
                        </span>
                      )}
                      {job.experience_min_years !== undefined && job.experience_min_years !== null && (
                        <span className="flex items-center gap-1">
                          <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                          {job.experience_min_years}+ years exp
                        </span>
                      )}
                    </div>
                    {job.description_raw && (
                      <p className="text-gray-600 mt-3 text-sm">
                        {job.description_raw.substring(0, 200)}
                        {job.description_raw.length > 200 ? '...' : ''}
                      </p>
                    )}
                    <p className="text-xs text-gray-400 mt-2">
                      Posted: {job.posted_at ? new Date(job.posted_at).toLocaleDateString() : 'N/A'}
                    </p>
                  </div>

                  <div className="flex flex-col gap-2 ml-4">
                    <Link
                      href={`/jobs/${job.id}`}
                      className="px-4 py-2 text-sm text-blue-600 bg-blue-50 rounded hover:bg-blue-100 text-center"
                    >
                      View Details
                    </Link>
                    <Link
                      href={`/recruiter/jobs/${job.id}/edit`}
                      className="px-4 py-2 text-sm text-purple-600 bg-purple-50 rounded hover:bg-purple-100 text-center"
                    >
                      Edit
                    </Link>
                    <button
                      onClick={() => handleToggleActive(job)}
                      disabled={actionLoading === job.id}
                      className={`px-4 py-2 text-sm rounded text-center ${
                        job.is_active
                          ? 'text-orange-600 bg-orange-50 hover:bg-orange-100'
                          : 'text-green-600 bg-green-50 hover:bg-green-100'
                      } disabled:opacity-50`}
                    >
                      {actionLoading === job.id ? '...' : job.is_active ? 'Deactivate' : 'Activate'}
                    </button>
                    <button
                      onClick={() => handleDelete(job.id)}
                      disabled={actionLoading === job.id}
                      className="px-4 py-2 text-sm text-red-600 bg-red-50 rounded hover:bg-red-100 disabled:opacity-50"
                    >
                      {actionLoading === job.id ? '...' : 'Delete'}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
