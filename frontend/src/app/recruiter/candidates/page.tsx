'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import Navbar from '@/components/Navbar';
import { api, Job, Application } from '@/lib/api';

const STATUS_META: Record<string, { label: string; color: string }> = {
  applied:     { label: 'Applied',     color: 'bg-blue-100 text-blue-700' },
  reviewing:   { label: 'Reviewing',   color: 'bg-yellow-100 text-yellow-700' },
  shortlisted: { label: 'Shortlisted', color: 'bg-purple-100 text-purple-700' },
  interview:   { label: 'Interview',   color: 'bg-indigo-100 text-indigo-700' },
  offer:       { label: 'Offer Sent',  color: 'bg-teal-100 text-teal-700' },
  hired:       { label: 'Hired',       color: 'bg-green-100 text-green-700' },
  rejected:    { label: 'Rejected',    color: 'bg-red-100 text-red-700' },
};

const STATUS_ORDER = ['applied', 'reviewing', 'shortlisted', 'interview', 'offer', 'hired', 'rejected'];

function StatusBadge({ status }: { status: string }) {
  const meta = STATUS_META[status] || { label: status, color: 'bg-gray-100 text-gray-600' };
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${meta.color}`}>
      {meta.label}
    </span>
  );
}

function StatusSelect({ value, onChange, loading }: { value: string; onChange: (s: string) => void; loading: boolean }) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      disabled={loading}
      className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-400 disabled:opacity-50"
    >
      {STATUS_ORDER.map(s => (
        <option key={s} value={s}>{STATUS_META[s]?.label || s}</option>
      ))}
    </select>
  );
}

export default function RecruiterCandidatesPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  const [jobs, setJobs] = useState<Job[]>([]);
  const [selectedJobId, setSelectedJobId] = useState<string | 'all'>('all');
  const [applications, setApplications] = useState<Application[]>([]);
  const [statusCounts, setStatusCounts] = useState<Record<string, number>>({});
  const [allApps, setAllApps] = useState<Application[]>([]);
  const [loadingApps, setLoadingApps] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [pageLoading, setPageLoading] = useState(true);

  useEffect(() => {
    if (!loading && !user) router.push('/login');
    if (!loading && user && user.role !== 'recruiter') router.push('/dashboard');
  }, [user, loading, router]);

  // Load jobs + all applications on mount
  useEffect(() => {
    if (!user || user.role !== 'recruiter') return;
    (async () => {
      try {
        const [jobsRes, appsRes] = await Promise.all([
          api.getMyJobs(),
          api.getAllRecruiterApplications(),
        ]);
        setJobs(jobsRes.jobs || []);
        setAllApps(appsRes.applications || []);
        setApplications(appsRes.applications || []);
      } catch {
        // silently fail
      } finally {
        setPageLoading(false);
      }
    })();
  }, [user]);

  // Load applications when job selection changes
  const loadJobApps = useCallback(async (jobId: string | 'all') => {
    setLoadingApps(true);
    setFilterStatus('');
    try {
      if (jobId === 'all') {
        const res = await api.getAllRecruiterApplications();
        setApplications(res.applications || []);
        setStatusCounts({});
      } else {
        const res = await api.getJobApplications(jobId);
        setApplications(res.applications || []);
        setStatusCounts(res.status_counts || {});
      }
    } catch {
      setApplications([]);
    } finally {
      setLoadingApps(false);
    }
  }, []);

  const handleSelectJob = (jobId: string | 'all') => {
    setSelectedJobId(jobId);
    loadJobApps(jobId);
  };

  const handleStatusChange = async (appId: string, newStatus: string) => {
    setUpdatingId(appId);
    try {
      await api.updateApplication(appId, { status: newStatus });
      const update = (list: Application[]) =>
        list.map(a => a.id === appId ? { ...a, status: newStatus } : a);
      setApplications(update);
      setAllApps(update);
      // recalculate status counts
      if (selectedJobId !== 'all') {
        setStatusCounts(prev => {
          const old = applications.find(a => a.id === appId)?.status || '';
          const next = { ...prev };
          if (old && next[old]) next[old] = Math.max(0, next[old] - 1);
          next[newStatus] = (next[newStatus] || 0) + 1;
          return next;
        });
      }
    } catch {
      // keep existing
    } finally {
      setUpdatingId(null);
    }
  };

  // Per-job applicant counts from allApps
  const jobAppCounts = jobs.reduce<Record<string, number>>((acc, j) => {
    acc[j.id] = allApps.filter(a => a.job_id === j.id).length;
    return acc;
  }, {});

  const totalApplicants = allApps.length;
  const totalHired = allApps.filter(a => a.status === 'hired').length;
  const totalShortlisted = allApps.filter(a => a.status === 'shortlisted').length;

  // Pipeline counts from allApps
  const pipelineMap: Record<string, number> = {};
  allApps.forEach(a => { pipelineMap[a.status] = (pipelineMap[a.status] || 0) + 1; });
  const pipelineStages = [
    { key: 'applied',            label: 'Applied',     bar: 'bg-blue-500',    light: 'bg-blue-50 text-blue-700' },
    { key: 'reviewing',          label: 'Reviewing',   bar: 'bg-yellow-500',  light: 'bg-yellow-50 text-yellow-700' },
    { key: 'shortlisted',        label: 'Shortlisted', bar: 'bg-green-500',   light: 'bg-green-50 text-green-700' },
    { key: 'interview',          label: 'Interview',   bar: 'bg-purple-500',  light: 'bg-purple-50 text-purple-700' },
    { key: 'offer',              label: 'Offer Sent',  bar: 'bg-teal-500',    light: 'bg-teal-50 text-teal-700' },
    { key: 'hired',              label: 'Hired',       bar: 'bg-emerald-500', light: 'bg-emerald-50 text-emerald-700' },
  ];

  const filtered = filterStatus ? applications.filter(a => a.status === filterStatus) : applications;

  if (loading || pageLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      <main className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Candidates</h1>

        {/* Summary stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
          {[
            { label: 'Total Jobs', value: jobs.length, color: 'text-blue-600' },
            { label: 'Total Applicants', value: totalApplicants, color: 'text-purple-600' },
            { label: 'Shortlisted', value: totalShortlisted, color: 'text-indigo-600' },
            { label: 'Hired', value: totalHired, color: 'text-green-600' },
          ].map(s => (
            <div key={s.label} className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
              <p className="text-xs text-gray-500 font-medium">{s.label}</p>
              <p className={`text-3xl font-bold mt-1 ${s.color}`}>{s.value}</p>
            </div>
          ))}
        </div>

        {/* Pipeline bar chart */}
        {totalApplicants > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 mb-6">
            <h2 className="text-base font-semibold text-gray-800 mb-4">Hiring Pipeline</h2>
            <div className="flex gap-2 items-end h-28">
              {pipelineStages.map(stage => {
                const count = pipelineMap[stage.key] || 0;
                const maxCount = Math.max(...pipelineStages.map(s => pipelineMap[s.key] || 0), 1);
                const heightPct = Math.max(8, (count / maxCount) * 100);
                return (
                  <div key={stage.key} className="flex-1 flex flex-col items-center justify-end h-full">
                    <span className="text-sm font-bold text-gray-800 mb-1">{count}</span>
                    <div className="w-full flex flex-col justify-end" style={{ height: `${heightPct}%` }}>
                      <div className={`w-full ${stage.bar} rounded-t-md opacity-80`} style={{ height: '100%' }} />
                    </div>
                    <div className={`w-full text-center py-1.5 text-[11px] font-medium rounded-b-md mt-0 ${stage.light}`}>
                      {stage.label}
                    </div>
                  </div>
                );
              })}
            </div>
            {(pipelineMap['rejected'] || pipelineMap['withdrawn']) && (
              <div className="flex gap-4 mt-3 text-xs text-gray-400">
                {pipelineMap['rejected'] && <span>🚫 {pipelineMap['rejected']} rejected</span>}
                {pipelineMap['withdrawn'] && <span>↩ {pipelineMap['withdrawn']} withdrawn</span>}
              </div>
            )}
          </div>
        )}

        <div className="flex gap-6">
          {/* Left: job list */}
          <div className="w-64 flex-shrink-0">
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-100">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Filter by Job</p>
              </div>
              <ul className="divide-y divide-gray-100 max-h-[500px] overflow-y-auto">
                <li>
                  <button
                    onClick={() => handleSelectJob('all')}
                    className={`w-full text-left px-4 py-3 flex items-center justify-between transition-colors ${
                      selectedJobId === 'all' ? 'bg-blue-50 text-blue-700' : 'hover:bg-gray-50 text-gray-700'
                    }`}
                  >
                    <span className="text-sm font-medium">All Jobs</span>
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                      selectedJobId === 'all' ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-500'
                    }`}>{totalApplicants}</span>
                  </button>
                </li>
                {jobs.map(job => (
                  <li key={job.id}>
                    <button
                      onClick={() => handleSelectJob(job.id)}
                      className={`w-full text-left px-4 py-3 transition-colors ${
                        selectedJobId === job.id ? 'bg-blue-50' : 'hover:bg-gray-50'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className={`text-sm font-medium truncate max-w-[140px] ${
                          selectedJobId === job.id ? 'text-blue-700' : 'text-gray-700'
                        }`}>{job.title}</span>
                        <span className={`flex-shrink-0 text-xs font-bold px-2 py-0.5 rounded-full ${
                          selectedJobId === job.id ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-500'
                        }`}>{jobAppCounts[job.id] || 0}</span>
                      </div>
                      <p className="text-xs text-gray-400 mt-0.5 truncate">{job.location_city || job.employment_type}</p>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Right: candidates panel */}
          <div className="flex-1 min-w-0">
            {/* Pipeline status filter (shown for single job) */}
            {selectedJobId !== 'all' && Object.keys(statusCounts).length > 0 && (
              <div className="flex flex-wrap gap-2 mb-4">
                <button
                  onClick={() => setFilterStatus('')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                    filterStatus === '' ? 'bg-gray-800 text-white border-gray-800' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'
                  }`}
                >All ({applications.length})</button>
                {STATUS_ORDER.filter(s => statusCounts[s]).map(s => (
                  <button key={s}
                    onClick={() => setFilterStatus(filterStatus === s ? '' : s)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                      filterStatus === s
                        ? 'bg-gray-800 text-white border-gray-800'
                        : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'
                    }`}
                  >
                    {STATUS_META[s]?.label} ({statusCounts[s]})
                  </button>
                ))}
              </div>
            )}

            {loadingApps ? (
              <div className="flex items-center justify-center py-20">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
              </div>
            ) : filtered.length === 0 ? (
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-16 text-center">
                <div className="text-5xl mb-4">👥</div>
                <h3 className="text-lg font-semibold text-gray-700 mb-1">No Candidates Yet</h3>
                <p className="text-gray-400 text-sm">
                  {jobs.length === 0
                    ? 'Post a job to start receiving applications.'
                    : 'No applications match the selected filter.'}
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {filtered.map(app => (
                  <div key={app.id} className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 flex flex-col sm:flex-row sm:items-center gap-4">
                    {/* Avatar */}
                    <div className="w-11 h-11 rounded-full bg-gradient-to-br from-blue-400 to-indigo-500 flex-shrink-0 flex items-center justify-center text-white font-bold text-base">
                      {(app.applicant_name || app.applicant_email || '?')[0].toUpperCase()}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-gray-900 text-sm">{app.applicant_name || 'Unknown'}</span>
                        <StatusBadge status={app.status} />
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5 truncate">{app.applicant_email}</p>
                      {app.headline && (
                        <p className="text-xs text-gray-600 mt-1 truncate">{app.headline}</p>
                      )}
                      <div className="flex flex-wrap gap-3 mt-2">
                        {app.years_experience !== undefined && (
                          <span className="text-xs text-gray-400 flex items-center gap-1">
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                            {app.years_experience} yrs exp
                          </span>
                        )}
                        {selectedJobId === 'all' && app.job_title && (
                          <span className="text-xs text-gray-400 flex items-center gap-1">
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
                            {app.job_title}
                          </span>
                        )}
                        <span className="text-xs text-gray-400 flex items-center gap-1">
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                          Applied {new Date(app.applied_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </span>
                      </div>
                    </div>

                    {/* Status update */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <StatusSelect
                        value={app.status}
                        onChange={s => handleStatusChange(app.id, s)}
                        loading={updatingId === app.id}
                      />
                      {updatingId === app.id && (
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500" />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
