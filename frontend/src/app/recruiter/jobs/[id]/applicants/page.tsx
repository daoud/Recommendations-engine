'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import api, { Application, MatchedCandidate } from '@/lib/api';
import NotificationBell from '@/components/NotificationBell';

type TabType = 'applicants' | 'screening';

export default function ViewApplicantsPage() {
  const router = useRouter();
  const params = useParams();
  const jobId = params.id as string;

  // Shared state
  const [job, setJob] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<TabType>('applicants');

  // Applicants tab state
  const [applications, setApplications] = useState<Application[]>([]);
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedApp, setSelectedApp] = useState<Application | null>(null);
  const [updating, setUpdating] = useState(false);
  const [newStatus, setNewStatus] = useState('');
  const [recruiterNotes, setRecruiterNotes] = useState('');

  // Screening tab state
  const [candidates, setCandidates] = useState<MatchedCandidate[]>([]);
  const [screeningLoading, setScreeningLoading] = useState(false);
  const [screeningLoaded, setScreeningLoaded] = useState(false);
  const [screeningError, setScreeningError] = useState('');
  const [jobSkillsCount, setJobSkillsCount] = useState(0);
  const [scoreFilter, setScoreFilter] = useState(0); // min composite score filter
  const [expandedCandidate, setExpandedCandidate] = useState<string | null>(null);

  const statuses = [
    { value: 'all', label: 'All' },
    { value: 'applied', label: 'Applied' },
    { value: 'screening', label: 'Screening' },
    { value: 'shortlisted', label: 'Shortlisted' },
    { value: 'interview_scheduled', label: 'Interview' },
    { value: 'interviewed', label: 'Interviewed' },
    { value: 'offer_extended', label: 'Offer' },
    { value: 'rejected', label: 'Rejected' },
    { value: 'withdrawn', label: 'Withdrawn' },
  ];

  useEffect(() => {
    const token = api.getToken();
    if (!token) { router.push('/login'); return; }
    loadData();
  }, [router, jobId, statusFilter]);

  // Auto-load screening when tab switches
  useEffect(() => {
    if (activeTab === 'screening' && !screeningLoaded && !screeningLoading) {
      loadScreeningData();
    }
  }, [activeTab]);

  const loadData = async () => {
    try {
      const [userData, jobData] = await Promise.all([
        api.getMe(),
        api.getJob(jobId)
      ]);

      if (userData.role !== 'recruiter') { router.push('/dashboard'); return; }
      if (jobData.posted_by_id !== userData.id) {
        setError('You do not have permission to view applicants for this job');
        setLoading(false);
        return;
      }

      setJob(jobData);

      const filterStatus = statusFilter === 'all' ? undefined : statusFilter;
      const apps = await api.getJobApplications(jobId, filterStatus);
      setApplications(apps.applications || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load applicants');
    } finally {
      setLoading(false);
    }
  };

  const loadScreeningData = async () => {
    setScreeningLoading(true);
    setScreeningError('');
    try {
      const data = await api.getMatchedCandidates(jobId, 50);
      setCandidates(data.candidates || []);
      setJobSkillsCount(data.job_skills_count || 0);
      setScreeningLoaded(true);
    } catch (err: any) {
      setScreeningError(err.message || 'Failed to load matched candidates');
    } finally {
      setScreeningLoading(false);
    }
  };

  const handleUpdateStatus = async () => {
    if (!selectedApp || !newStatus) return;
    setUpdating(true);
    try {
      await api.updateApplication(selectedApp.id, {
        status: newStatus,
        recruiter_notes: recruiterNotes || undefined
      });
      setApplications(apps => apps.map(a =>
        a.id === selectedApp.id
          ? { ...a, status: newStatus, recruiter_notes: recruiterNotes }
          : a
      ));
      setSelectedApp(null);
      setNewStatus('');
      setRecruiterNotes('');
    } catch (err: any) {
      alert(err.message || 'Failed to update application');
    } finally {
      setUpdating(false);
    }
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      applied: 'bg-blue-100 text-blue-800',
      screening: 'bg-yellow-100 text-yellow-800',
      shortlisted: 'bg-green-100 text-green-800',
      interview_scheduled: 'bg-purple-100 text-purple-800',
      interviewed: 'bg-indigo-100 text-indigo-800',
      offer_extended: 'bg-emerald-100 text-emerald-800',
      offer_accepted: 'bg-green-200 text-green-900',
      offer_declined: 'bg-orange-100 text-orange-800',
      rejected: 'bg-red-100 text-red-800',
      withdrawn: 'bg-gray-200 text-gray-600',
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  const getScoreColor = (score: number) => {
    if (score >= 75) return 'text-green-600';
    if (score >= 50) return 'text-blue-600';
    if (score >= 30) return 'text-yellow-600';
    return 'text-red-500';
  };

  const getScoreBarColor = (score: number) => {
    if (score >= 75) return 'bg-green-500';
    if (score >= 50) return 'bg-blue-500';
    if (score >= 30) return 'bg-yellow-500';
    return 'bg-red-400';
  };

  const getScoreLabel = (score: number) => {
    if (score >= 85) return 'Excellent';
    if (score >= 70) return 'Strong';
    if (score >= 50) return 'Good';
    if (score >= 30) return 'Fair';
    return 'Low';
  };

  const filteredCandidates = candidates.filter(c => c.scores.composite >= scoreFilter);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 mb-4">{error}</p>
          <Link href="/recruiter/my-jobs" className="text-blue-600 hover:underline">Back to My Jobs</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <div>
            <Link href="/recruiter/my-jobs" className="text-gray-500 hover:text-gray-700 text-sm">
              &larr; Back to My Jobs
            </Link>
            <h1 className="text-2xl font-bold text-gray-900 mt-1">{job?.title}</h1>
            <p className="text-gray-500">{job?.company_name}</p>
          </div>
          <div className="flex items-center gap-4">
            <NotificationBell />
            <div className="text-right">
              <p className="text-2xl font-bold text-blue-600">{applications.length}</p>
              <p className="text-gray-500 text-sm">Applicants</p>
            </div>
          </div>
        </div>
      </header>

      {/* Tab Navigation */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex gap-0">
            <button
              onClick={() => setActiveTab('applicants')}
              className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'applicants'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <span className="flex items-center gap-2">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                Applicants ({applications.length})
              </span>
            </button>
            <button
              onClick={() => setActiveTab('screening')}
              className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'screening'
                  ? 'border-purple-600 text-purple-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <span className="flex items-center gap-2">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
                AI Screening
                {screeningLoaded && (
                  <span className="ml-1 bg-purple-100 text-purple-700 text-xs px-2 py-0.5 rounded-full">
                    {candidates.length}
                  </span>
                )}
              </span>
            </button>
          </div>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-4 py-6">
        {/* ═══════════════════════════════════════════ */}
        {/* TAB: APPLICANTS                            */}
        {/* ═══════════════════════════════════════════ */}
        {activeTab === 'applicants' && (
          <>
            {/* Status Filter */}
            <div className="bg-white rounded-lg shadow p-4 mb-6">
              <div className="flex flex-wrap gap-2">
                {statuses.map(status => (
                  <button
                    key={status.value}
                    onClick={() => setStatusFilter(status.value)}
                    className={`px-3 py-1.5 rounded-md text-sm font-medium transition ${
                      statusFilter === status.value
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {status.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Applicants List */}
            {applications.length === 0 ? (
              <div className="bg-white rounded-lg shadow p-8 text-center">
                <p className="text-gray-500 text-lg">No applicants found</p>
                {statusFilter !== 'all' && (
                  <button onClick={() => setStatusFilter('all')} className="mt-4 text-blue-600 hover:underline">
                    View all applicants
                  </button>
                )}
                <p className="text-gray-400 text-sm mt-4">
                  Try the <button onClick={() => setActiveTab('screening')} className="text-purple-600 hover:underline font-medium">AI Screening</button> tab to discover matching candidates automatically.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {applications.map(app => (
                  <div key={app.id} className="bg-white rounded-lg shadow p-6">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="text-xl font-semibold text-gray-900">
                            {app.applicant_name || 'Unknown Applicant'}
                          </h3>
                          <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(app.status)}`}>
                            {app.status.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                          </span>
                        </div>
                        <p className="text-gray-600 mb-2">{app.applicant_email}</p>
                        <div className="flex flex-wrap gap-4 text-sm text-gray-500 mb-3">
                          {app.headline && <span>Title: {app.headline}</span>}
                          {app.years_experience !== null && app.years_experience !== undefined && (
                            <span>Experience: {app.years_experience} years</span>
                          )}
                          <span>Applied: {new Date(app.applied_at).toLocaleDateString()}</span>
                          {app.match_score_at_apply && (
                            <span className="text-green-600 font-medium">
                              Match Score: {app.match_score_at_apply.toFixed(0)}%
                            </span>
                          )}
                        </div>
                        {app.cover_letter && (
                          <div className="mt-3 p-3 bg-gray-50 rounded-md">
                            <p className="text-sm font-medium text-gray-700 mb-1">Cover Letter:</p>
                            <p className="text-sm text-gray-600 whitespace-pre-wrap">{app.cover_letter}</p>
                          </div>
                        )}
                        {app.recruiter_notes && (
                          <div className="mt-3 p-3 bg-yellow-50 rounded-md">
                            <p className="text-sm font-medium text-yellow-800 mb-1">Your Notes:</p>
                            <p className="text-sm text-yellow-700">{app.recruiter_notes}</p>
                          </div>
                        )}
                      </div>
                      <div className="ml-4 flex flex-col gap-2">
                        <button
                          onClick={() => { setSelectedApp(app); setNewStatus(app.status); setRecruiterNotes(app.recruiter_notes || ''); }}
                          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm"
                        >
                          Update Status
                        </button>
                        <Link
                          href={`/profile/${app.user_id}`}
                          className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 text-sm text-center"
                        >
                          View Profile
                        </Link>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* ═══════════════════════════════════════════ */}
        {/* TAB: AI SCREENING                          */}
        {/* ═══════════════════════════════════════════ */}
        {activeTab === 'screening' && (
          <>
            {/* Screening Header Card */}
            <div className="bg-gradient-to-r from-purple-600 to-blue-600 rounded-lg shadow p-6 mb-6 text-white">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold flex items-center gap-2">
                    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                    </svg>
                    AI Candidate Screening
                  </h2>
                  <p className="text-purple-100 mt-1 text-sm">
                    Candidates ranked by semantic similarity, skill match, and experience alignment
                  </p>
                </div>
                <div className="flex items-center gap-4">
                  {screeningLoaded && (
                    <div className="text-right">
                      <p className="text-3xl font-bold">{filteredCandidates.length}</p>
                      <p className="text-purple-200 text-sm">Matching Candidates</p>
                    </div>
                  )}
                  <button
                    onClick={loadScreeningData}
                    disabled={screeningLoading}
                    className="px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg text-sm font-medium backdrop-blur transition"
                  >
                    {screeningLoading ? 'Scanning...' : 'Refresh'}
                  </button>
                </div>
              </div>

              {/* Score Legend */}
              <div className="mt-4 flex flex-wrap gap-4 text-xs text-purple-100">
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-purple-300"></span>
                  Semantic Similarity (40%)
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-blue-300"></span>
                  Skill Match (35%)
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-cyan-300"></span>
                  Experience (25%)
                </span>
              </div>
            </div>

            {/* Score Filter */}
            {screeningLoaded && candidates.length > 0 && (
              <div className="bg-white rounded-lg shadow p-4 mb-6">
                <div className="flex items-center gap-4">
                  <span className="text-sm font-medium text-gray-700">Minimum Score:</span>
                  <div className="flex gap-2">
                    {[0, 30, 50, 70, 85].map(val => (
                      <button
                        key={val}
                        onClick={() => setScoreFilter(val)}
                        className={`px-3 py-1 rounded-md text-sm font-medium transition ${
                          scoreFilter === val
                            ? 'bg-purple-600 text-white'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                      >
                        {val === 0 ? 'All' : `${val}%+`}
                      </button>
                    ))}
                  </div>
                  <span className="text-sm text-gray-400 ml-auto">
                    Showing {filteredCandidates.length} of {candidates.length} candidates
                  </span>
                </div>
              </div>
            )}

            {/* Loading State */}
            {screeningLoading && (
              <div className="bg-white rounded-lg shadow p-12 text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
                <p className="text-gray-600 font-medium">Scanning candidate profiles...</p>
                <p className="text-gray-400 text-sm mt-1">Matching skills, experience, and semantic similarity</p>
              </div>
            )}

            {/* Error State */}
            {screeningError && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
                <p className="text-red-600 mb-3">{screeningError}</p>
                <button onClick={loadScreeningData} className="text-red-700 underline hover:text-red-900">
                  Try Again
                </button>
              </div>
            )}

            {/* No Results */}
            {screeningLoaded && !screeningLoading && candidates.length === 0 && (
              <div className="bg-white rounded-lg shadow p-12 text-center">
                <svg className="mx-auto h-16 w-16 text-gray-300 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <h3 className="text-xl font-medium text-gray-900 mb-2">No matching candidates found</h3>
                <p className="text-gray-500">
                  No candidate profiles have been vectorized yet.
                  Candidates need to upload their resume or complete their profile first.
                </p>
              </div>
            )}

            {/* Candidate Cards */}
            {screeningLoaded && !screeningLoading && filteredCandidates.length > 0 && (
              <div className="space-y-4">
                {filteredCandidates.map((candidate, idx) => {
                  const isExpanded = expandedCandidate === candidate.profile_id;
                  const composite = candidate.scores.composite;

                  return (
                    <div
                      key={candidate.profile_id}
                      className="bg-white rounded-lg shadow hover:shadow-md transition-shadow border-l-4"
                      style={{
                        borderLeftColor: composite >= 75 ? '#16a34a' : composite >= 50 ? '#2563eb' : composite >= 30 ? '#eab308' : '#ef4444'
                      }}
                    >
                      {/* Main Row */}
                      <div className="p-5">
                        <div className="flex items-start gap-4">
                          {/* Rank Badge */}
                          <div className="flex-shrink-0 w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-sm font-bold text-gray-600">
                            #{idx + 1}
                          </div>

                          {/* Candidate Info */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-3 mb-1">
                              <h3 className="text-lg font-semibold text-gray-900 truncate">{candidate.name}</h3>
                              {candidate.is_open_to_work && (
                                <span className="flex-shrink-0 px-2 py-0.5 text-xs font-medium bg-green-100 text-green-700 rounded-full">
                                  Open to Work
                                </span>
                              )}
                            </div>
                            <p className="text-sm text-gray-600 truncate">{candidate.headline || candidate.email}</p>
                            <div className="flex flex-wrap gap-3 text-xs text-gray-500 mt-1">
                              {candidate.location_city && (
                                <span className="flex items-center gap-1">
                                  <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                                  {candidate.location_city}{candidate.location_country ? `, ${candidate.location_country}` : ''}
                                </span>
                              )}
                              <span className="flex items-center gap-1">
                                <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                                {candidate.years_experience} years exp
                              </span>
                              {candidate.desired_role && (
                                <span className="flex items-center gap-1">
                                  <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>
                                  Seeking: {candidate.desired_role}
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Composite Score */}
                          <div className="flex-shrink-0 text-center">
                            <div className={`text-3xl font-bold ${getScoreColor(composite)}`}>
                              {composite.toFixed(0)}%
                            </div>
                            <div className={`text-xs font-medium ${getScoreColor(composite)}`}>
                              {getScoreLabel(composite)}
                            </div>
                          </div>

                          {/* Actions */}
                          <div className="flex-shrink-0 flex flex-col gap-2">
                            <Link
                              href={`/profile/${candidate.user_id}`}
                              className="px-3 py-1.5 text-sm text-blue-600 bg-blue-50 rounded hover:bg-blue-100 text-center"
                            >
                              View Profile
                            </Link>
                            <button
                              onClick={() => setExpandedCandidate(isExpanded ? null : candidate.profile_id)}
                              className="px-3 py-1.5 text-sm text-gray-600 bg-gray-50 rounded hover:bg-gray-100 text-center"
                            >
                              {isExpanded ? 'Collapse' : 'Details'}
                            </button>
                          </div>
                        </div>

                        {/* Score Bars (always visible) */}
                        <div className="mt-4 grid grid-cols-3 gap-4">
                          <div>
                            <div className="flex justify-between text-xs mb-1">
                              <span className="text-gray-500">Semantic Match</span>
                              <span className="font-medium text-gray-700">{candidate.scores.vector_similarity.toFixed(0)}%</span>
                            </div>
                            <div className="w-full bg-gray-100 rounded-full h-2">
                              <div
                                className="bg-purple-500 h-2 rounded-full transition-all"
                                style={{ width: `${Math.min(100, candidate.scores.vector_similarity)}%` }}
                              />
                            </div>
                          </div>
                          <div>
                            <div className="flex justify-between text-xs mb-1">
                              <span className="text-gray-500">Skill Match</span>
                              <span className="font-medium text-gray-700">{candidate.scores.skill_match.toFixed(0)}%</span>
                            </div>
                            <div className="w-full bg-gray-100 rounded-full h-2">
                              <div
                                className="bg-blue-500 h-2 rounded-full transition-all"
                                style={{ width: `${Math.min(100, candidate.scores.skill_match)}%` }}
                              />
                            </div>
                          </div>
                          <div>
                            <div className="flex justify-between text-xs mb-1">
                              <span className="text-gray-500">Experience</span>
                              <span className="font-medium text-gray-700">{candidate.scores.experience_match.toFixed(0)}%</span>
                            </div>
                            <div className="w-full bg-gray-100 rounded-full h-2">
                              <div
                                className="bg-cyan-500 h-2 rounded-full transition-all"
                                style={{ width: `${Math.min(100, candidate.scores.experience_match)}%` }}
                              />
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Expanded Details */}
                      {isExpanded && (
                        <div className="border-t bg-gray-50 px-5 py-4">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* Matched Skills */}
                            <div>
                              <h4 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-1">
                                <svg className="h-4 w-4 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                                Matched Skills ({candidate.matched_skills.length})
                              </h4>
                              <div className="flex flex-wrap gap-1.5">
                                {candidate.matched_skills.length > 0 ? (
                                  candidate.matched_skills.map(s => (
                                    <span key={s} className="px-2 py-0.5 text-xs font-medium bg-green-100 text-green-800 rounded">
                                      {s}
                                    </span>
                                  ))
                                ) : (
                                  <span className="text-xs text-gray-400">No direct skill matches</span>
                                )}
                              </div>
                            </div>

                            {/* Missing Skills */}
                            <div>
                              <h4 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-1">
                                <svg className="h-4 w-4 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                Missing Skills ({candidate.missing_skills.length})
                              </h4>
                              <div className="flex flex-wrap gap-1.5">
                                {candidate.missing_skills.length > 0 ? (
                                  candidate.missing_skills.map(s => (
                                    <span key={s} className="px-2 py-0.5 text-xs font-medium bg-red-50 text-red-700 rounded border border-red-200">
                                      {s}
                                    </span>
                                  ))
                                ) : (
                                  <span className="text-xs text-green-600 font-medium">All required skills matched!</span>
                                )}
                              </div>
                            </div>

                            {/* All Candidate Skills */}
                            <div className="md:col-span-2">
                              <h4 className="text-sm font-semibold text-gray-700 mb-2">
                                All Candidate Skills ({candidate.profile_skills.length})
                              </h4>
                              <div className="flex flex-wrap gap-1.5">
                                {candidate.profile_skills.map(s => (
                                  <span
                                    key={s}
                                    className={`px-2 py-0.5 text-xs rounded ${
                                      candidate.matched_skills.includes(s)
                                        ? 'bg-green-100 text-green-800 font-medium'
                                        : 'bg-gray-100 text-gray-600'
                                    }`}
                                  >
                                    {s}
                                  </span>
                                ))}
                              </div>
                            </div>

                            {/* Summary */}
                            {candidate.summary && (
                              <div className="md:col-span-2">
                                <h4 className="text-sm font-semibold text-gray-700 mb-1">Profile Summary</h4>
                                <p className="text-sm text-gray-600">{candidate.summary}</p>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </main>

      {/* Update Status Modal (Applicants Tab) */}
      {selectedApp && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Update Application Status</h2>
            <p className="text-gray-600 mb-4">{selectedApp.applicant_name}</p>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
              <select
                value={newStatus}
                onChange={(e) => setNewStatus(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="applied">Applied</option>
                <option value="screening">Screening</option>
                <option value="shortlisted">Shortlisted</option>
                <option value="interview_scheduled">Interview Scheduled</option>
                <option value="interviewed">Interviewed</option>
                <option value="offer_extended">Offer Extended</option>
                <option value="offer_accepted">Offer Accepted</option>
                <option value="offer_declined">Offer Declined</option>
                <option value="rejected">Rejected</option>
              </select>
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">Notes (Private)</label>
              <textarea
                value={recruiterNotes}
                onChange={(e) => setRecruiterNotes(e.target.value)}
                rows={4}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                placeholder="Add private notes about this candidate..."
              />
            </div>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setSelectedApp(null)} className="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200">
                Cancel
              </button>
              <button onClick={handleUpdateStatus} disabled={updating} className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50">
                {updating ? 'Updating...' : 'Update'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
