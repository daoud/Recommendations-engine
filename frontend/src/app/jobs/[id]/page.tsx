'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import api, { Job, Skill } from '@/lib/api';

export default function JobDetailsPage() {
  const router = useRouter();
  const params = useParams();
  const jobId = params.id as string;

  const [job, setJob] = useState<Job | null>(null);
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  const [hasApplied, setHasApplied] = useState(false);
  const [applicationStatus, setApplicationStatus] = useState<string | null>(null);
  const [showApplyModal, setShowApplyModal] = useState(false);
  const [coverLetter, setCoverLetter] = useState('');
  const [applying, setApplying] = useState(false);
  const [applySuccess, setApplySuccess] = useState(false);
  const [generatingCL, setGeneratingCL] = useState(false);
  const [clGenerated, setClGenerated] = useState(false);

  useEffect(() => {
    const token = api.getToken();
    if (!token) {
      router.push('/login');
      return;
    }
    loadData();
  }, [router, jobId]);

  const loadData = async () => {
    try {
      const [userData, jobData] = await Promise.all([
        api.getMe(),
        api.getJob(jobId)
      ]);
      
      setUser(userData);
      setJob(jobData);

      if (userData.role === 'candidate') {
        try {
          const appStatus = await api.checkApplicationStatus(jobId);
          setHasApplied(appStatus.applied);
          setApplicationStatus(appStatus.status || null);
        } catch (err) {}
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load job details');
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateCL = async () => {
    setGeneratingCL(true);
    try {
      const data = await api.generateCoverLetter(jobId);
      setCoverLetter(data.cover_letter || '');
      setClGenerated(true);
    } catch (err: any) {
      alert('AI generation failed: ' + (err.message || 'Try again'));
    } finally {
      setGeneratingCL(false);
    }
  };

  const handleApply = async (skipCoverLetter = false) => {
    setApplying(true);
    try {
      await api.applyToJob(jobId, skipCoverLetter ? undefined : (coverLetter || undefined), 'direct');
      setApplySuccess(true);
      setHasApplied(true);
      setApplicationStatus('applied');
      setShowApplyModal(false);
      setCoverLetter('');
      setClGenerated(false);
    } catch (err: any) {
      alert(err.message || 'Failed to apply');
    } finally {
      setApplying(false);
    }
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      applied: 'bg-blue-100 text-blue-800',
      screening: 'bg-yellow-100 text-yellow-800',
      shortlisted: 'bg-green-100 text-green-800',
      interview_scheduled: 'bg-purple-100 text-purple-800',
      rejected: 'bg-red-100 text-red-800',
      withdrawn: 'bg-gray-200 text-gray-600',
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error || !job) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 mb-4">{error || 'Job not found'}</p>
          <Link href="/jobs" className="text-blue-600 hover:underline">Back to Jobs</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <Link href="/jobs" className="text-gray-600 hover:text-gray-900">Back to Jobs</Link>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        {applySuccess && (
          <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded mb-6">
            Application submitted successfully! <Link href="/applications" className="underline">View your applications</Link>
          </div>
        )}

        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <div className="flex justify-between items-start">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <h1 className="text-3xl font-bold text-gray-900">{job.title}</h1>
                {!job.is_active && (
                  <span className="px-2 py-1 text-xs font-medium rounded bg-gray-100 text-gray-600">Closed</span>
                )}
              </div>
              <p className="text-xl text-gray-600 mb-4">{job.company_name}</p>
              
              <div className="flex flex-wrap gap-4 text-gray-500">
                {job.location_city && <span>Location: {job.location_city}, {job.location_country}</span>}
                <span>Type: {job.location_type}</span>
                <span>Employment: {job.employment_type?.replace('_', ' ')}</span>
                {job.experience_min_years !== null && job.experience_min_years !== undefined && (
                  <span>Experience: {job.experience_min_years}+ years</span>
                )}
              </div>

              {job.salary_min && job.salary_max && (
                <p className="mt-3 text-lg font-medium text-green-600">
                  Salary: {job.salary_currency || 'USD'} {job.salary_min.toLocaleString()} - {job.salary_max.toLocaleString()}
                </p>
              )}
            </div>

            <div className="text-right">
              {user?.role === 'candidate' && (
                <>
                  {hasApplied ? (
                    <div className="text-center">
                      <span className={`inline-block px-4 py-2 rounded-md font-medium ${getStatusColor(applicationStatus || 'applied')}`}>
                        {applicationStatus?.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) || 'Applied'}
                      </span>
                      <p className="text-sm text-gray-500 mt-2">
                        <Link href="/applications" className="text-blue-600 hover:underline">View application</Link>
                      </p>
                    </div>
                  ) : job.is_active ? (
                    <button
                      onClick={() => setShowApplyModal(true)}
                      className="bg-blue-600 text-white px-6 py-3 rounded-md hover:bg-blue-700 font-medium text-lg"
                    >
                      Apply Now
                    </button>
                  ) : (
                    <span className="text-gray-500">No longer accepting applications</span>
                  )}
                </>
              )}

              {user?.role === 'recruiter' && job.posted_by_id === user.id && (
                <div className="flex flex-col gap-2">
                  <Link href={`/recruiter/jobs/${job.id}/applicants`} className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 text-center">
                    View Applicants
                  </Link>
                  <Link href={`/recruiter/jobs/${job.id}/edit`} className="bg-purple-600 text-white px-4 py-2 rounded-md hover:bg-purple-700 text-center">
                    Edit Job
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Job Description</h2>
          <div className="prose max-w-none text-gray-700 whitespace-pre-wrap">{job.description_raw}</div>
        </div>

        {job.skills && job.skills.length > 0 && (
          <div className="bg-white rounded-lg shadow p-6 mb-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Required Skills</h2>
            <div className="flex flex-wrap gap-2">
              {job.skills.map((skill: any, index: number) => (
                <span key={index} className={`px-3 py-1 rounded-full text-sm font-medium ${
                  skill.requirement_type === 'required' ? 'bg-red-100 text-red-800' :
                  skill.requirement_type === 'preferred' ? 'bg-yellow-100 text-yellow-800' : 'bg-gray-100 text-gray-800'
                }`}>
                  {skill.skill_name || skill.name}
                </span>
              ))}
            </div>
          </div>
        )}

        <div className="text-center text-gray-500 text-sm">
          Posted: {job.posted_at ? new Date(job.posted_at).toLocaleDateString() : 'N/A'}
        </div>
      </main>

      {showApplyModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
          onClick={() => { setShowApplyModal(false); setCoverLetter(''); setClGenerated(false); }}>
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full" onClick={e => e.stopPropagation()}>

            {/* Header */}
            <div className="flex justify-between items-start p-5 border-b bg-gradient-to-r from-blue-50 to-indigo-50 rounded-t-xl">
              <div>
                <h2 className="text-lg font-bold text-gray-900">Apply to {job.title}</h2>
                <p className="text-sm text-gray-500 mt-0.5">{job.company_name}</p>
              </div>
              <button
                onClick={() => { setShowApplyModal(false); setCoverLetter(''); setClGenerated(false); }}
                className="text-gray-400 hover:text-gray-700 text-2xl leading-none"
              >&times;</button>
            </div>

            <div className="p-5">
              {/* Cover Letter Section */}
              <div className="mb-5">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium text-gray-700">
                    Cover Letter <span className="text-gray-400 font-normal">(Optional)</span>
                  </label>
                  <button
                    onClick={handleGenerateCL}
                    disabled={generatingCL}
                    className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg bg-purple-50 text-purple-700 hover:bg-purple-100 disabled:opacity-50 disabled:cursor-not-allowed transition"
                  >
                    {generatingCL ? (
                      <>
                        <svg className="animate-spin h-3.5 w-3.5" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
                        </svg>
                        Generating...
                      </>
                    ) : (
                      <>
                        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0112 15a9.065 9.065 0 00-6.23-.693L5 14.5m14.8.8l1.402 1.402c1 1 .03 2.798-1.442 2.798H4.24c-1.47 0-2.441-1.798-1.442-2.798L4.2 15.3" />
                        </svg>
                        AI Generate
                      </>
                    )}
                  </button>
                </div>

                {/* AI generated indicator */}
                {clGenerated && (
                  <div className="flex items-center gap-1.5 mb-2 text-xs text-purple-700 bg-purple-50 border border-purple-200 rounded-lg px-3 py-1.5">
                    <svg className="h-3.5 w-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    AI-generated based on your profile &amp; this job — feel free to edit
                  </div>
                )}

                <textarea
                  value={coverLetter}
                  onChange={(e) => setCoverLetter(e.target.value)}
                  rows={7}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm resize-none"
                  placeholder="Tell the employer why you are a great fit for this role, or click 'AI Generate' to auto-fill..."
                />
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3">
                {/* Skip — apply with no cover letter */}
                <button
                  onClick={() => handleApply(true)}
                  disabled={applying}
                  className="flex-1 py-2.5 border border-gray-300 text-gray-600 rounded-lg hover:bg-gray-50 disabled:opacity-50 text-sm font-medium transition"
                >
                  {applying ? 'Submitting...' : 'Skip & Apply'}
                </button>

                {/* Submit with cover letter */}
                <button
                  onClick={() => handleApply(false)}
                  disabled={applying}
                  className="flex-1 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm font-medium transition"
                >
                  {applying ? 'Submitting...' : 'Submit Application'}
                </button>
              </div>

              <p className="text-center text-xs text-gray-400 mt-3">
                &ldquo;Skip &amp; Apply&rdquo; submits without a cover letter
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
