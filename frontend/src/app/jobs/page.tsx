// frontend/src/app/jobs/page.tsx
'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import Navbar from '@/components/Navbar';
import { api, Job } from '@/lib/api';

interface Filters {
  location: string;
  workMode: string;       // location_type: onsite | remote | hybrid | ''
  employmentType: string; // full_time | part_time | contract | internship | ''
  salaryMin: string;
  salaryMax: string;
  experienceMax: string;  // max years of experience required
}

const EMPTY_FILTERS: Filters = {
  location: '',
  workMode: '',
  employmentType: '',
  salaryMin: '',
  salaryMax: '',
  experienceMax: '',
};

const WORK_MODE_OPTIONS = [
  { value: '', label: 'Any' },
  { value: 'onsite', label: 'On-site' },
  { value: 'remote', label: 'Remote' },
  { value: 'hybrid', label: 'Hybrid' },
];

const EMPLOYMENT_TYPE_OPTIONS = [
  { value: '', label: 'Any' },
  { value: 'full_time', label: 'Full-time' },
  { value: 'part_time', label: 'Part-time' },
  { value: 'contract', label: 'Contract' },
  { value: 'internship', label: 'Internship' },
];

const EXPERIENCE_OPTIONS = [
  { value: '', label: 'Any' },
  { value: '1', label: '0–1 year' },
  { value: '2', label: 'Up to 2 years' },
  { value: '3', label: 'Up to 3 years' },
  { value: '5', label: 'Up to 5 years' },
  { value: '7', label: 'Up to 7 years' },
  { value: '10', label: 'Up to 10 years' },
];

function formatLabel(val: string) {
  return val.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

export default function JobsPage() {
  const { user, loading, logout } = useAuth();
  const router = useRouter();
  const [allJobs, setAllJobs] = useState<(Job & { similarity_score?: number })[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loadingJobs, setLoadingJobs] = useState(false);
  const [searchMode, setSearchMode] = useState<'list' | 'semantic' | 'text'>('list');
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [filtersOpen, setFiltersOpen] = useState(true);

  useEffect(() => {
    if (!loading && !user) router.push('/login');
  }, [user, loading, router]);

  useEffect(() => {
    if (user) loadJobs();
  }, [user]);

  const loadJobs = async () => {
    setLoadingJobs(true);
    try {
      const data = await api.getJobs();
      setAllJobs(data || []);
      setSearchMode('list');
    } catch (err) {
      console.error('Failed to load jobs:', err);
      setAllJobs([]);
    } finally {
      setLoadingJobs(false);
    }
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    const q = searchQuery.trim();
    if (!q) { loadJobs(); return; }
    setLoadingJobs(true);
    try {
      // 1. Try semantic search first
      let jobs: (Job & { similarity_score?: number })[] = [];
      try {
        const data = await api.searchJobsSemantic(q);
        jobs = data.jobs || [];
      } catch { /* semantic unavailable */ }

      // 2. If semantic returned nothing, fall back to API text search
      if (jobs.length === 0) {
        try {
          const fallback = await api.getJobs({ search: q });
          jobs = fallback || [];
        } catch { /* text search unavailable */ }
      }

      // 3. If still nothing, filter already-loaded jobs by title / company / description
      if (jobs.length === 0 && allJobs.length > 0) {
        const lower = q.toLowerCase();
        jobs = allJobs.filter(j =>
          j.title?.toLowerCase().includes(lower) ||
          j.company_name?.toLowerCase().includes(lower) ||
          j.description_raw?.toLowerCase().includes(lower) ||
          j.location_city?.toLowerCase().includes(lower) ||
          j.employment_type?.toLowerCase().includes(lower)
        );
        setSearchMode('text');
      } else {
        setSearchMode(jobs.some(j => (j as any).similarity_score) ? 'semantic' : 'text');
      }

      setAllJobs(jobs);
    } catch (err) {
      console.error('Search failed:', err);
    } finally {
      setLoadingJobs(false);
    }
  };

  const handleClear = () => {
    setSearchQuery('');
    setFilters(EMPTY_FILTERS);
    loadJobs();
  };

  const setFilter = (key: keyof Filters, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const activeFilterCount = Object.values(filters).filter(v => v !== '').length;

  // Client-side filtering applied on top of the loaded jobs list
  const filteredJobs = useMemo(() => {
    return allJobs.filter(job => {
      // Location filter (city or country, case-insensitive)
      if (filters.location) {
        const loc = filters.location.toLowerCase();
        const cityMatch = job.location_city?.toLowerCase().includes(loc);
        const countryMatch = job.location_country?.toLowerCase().includes(loc);
        if (!cityMatch && !countryMatch) return false;
      }

      // Work mode filter
      if (filters.workMode && job.location_type !== filters.workMode) return false;

      // Employment type filter
      if (filters.employmentType && job.employment_type !== filters.employmentType) return false;

      // Salary min filter — job's max salary must be at least what user wants
      if (filters.salaryMin) {
        const min = parseInt(filters.salaryMin, 10);
        if (!isNaN(min) && (job.salary_max ?? 0) < min) return false;
      }

      // Salary max filter — job's min salary must be at most what user can offer
      if (filters.salaryMax) {
        const max = parseInt(filters.salaryMax, 10);
        if (!isNaN(max) && (job.salary_min ?? 0) > max) return false;
      }

      // Experience filter — show jobs whose minimum requirement <= selected max
      if (filters.experienceMax) {
        const maxExp = parseInt(filters.experienceMax, 10);
        if (!isNaN(maxExp) && job.experience_min_years > maxExp) return false;
      }

      return true;
    });
  }, [allJobs, filters]);

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <Navbar />

      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 sm:px-0">

          {/* Page header */}
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Find Jobs</h2>

          {/* Search bar */}
          <form onSubmit={handleSearch} className="mb-6">
            <div className="flex gap-3">
              <input
                type="text"
                placeholder="Search jobs with AI..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
              />
              <button type="submit" className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium">
                Search
              </button>
              {(searchMode === 'semantic' || activeFilterCount > 0) && (
                <button type="button" onClick={handleClear} className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 font-medium">
                  Clear all
                </button>
              )}
              {/* Toggle filter panel */}
              <button
                type="button"
                onClick={() => setFiltersOpen(o => !o)}
                className="flex items-center gap-2 px-4 py-2 border border-gray-300 bg-white text-gray-700 rounded-lg hover:bg-gray-50 font-medium"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2a1 1 0 01-.293.707L13 13.414V19a1 1 0 01-.553.894l-4 2A1 1 0 017 21v-7.586L3.293 6.707A1 1 0 013 6V4z" />
                </svg>
                Filters
                {activeFilterCount > 0 && (
                  <span className="bg-blue-600 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                    {activeFilterCount}
                  </span>
                )}
              </button>
            </div>
          </form>

          {searchMode === 'semantic' && (
            <p className="text-sm text-blue-600 mb-4 font-medium">Showing AI-powered semantic search results</p>
          )}
          {searchMode === 'text' && (
            <p className="text-sm text-gray-500 mb-4 font-medium">Showing keyword search results for &quot;{searchQuery}&quot;</p>
          )}

          <div className="flex gap-6">
            {/* Filter sidebar */}
            {filtersOpen && (
              <aside className="w-64 flex-shrink-0">
                <div className="bg-white rounded-lg shadow p-5 space-y-5 sticky top-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-gray-900">Filters</h3>
                    {activeFilterCount > 0 && (
                      <button
                        onClick={() => setFilters(EMPTY_FILTERS)}
                        className="text-xs text-blue-600 hover:text-blue-800"
                      >
                        Reset all
                      </button>
                    )}
                  </div>

                  {/* Location */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
                    <input
                      type="text"
                      placeholder="City or country..."
                      value={filters.location}
                      onChange={e => setFilter('location', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  {/* Work Mode */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Work Mode</label>
                    <div className="space-y-1">
                      {WORK_MODE_OPTIONS.map(opt => (
                        <label key={opt.value} className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="radio"
                            name="workMode"
                            value={opt.value}
                            checked={filters.workMode === opt.value}
                            onChange={() => setFilter('workMode', opt.value)}
                            className="text-blue-600"
                          />
                          <span className="text-sm text-gray-700">{opt.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* Employment Type */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Job Type</label>
                    <div className="space-y-1">
                      {EMPLOYMENT_TYPE_OPTIONS.map(opt => (
                        <label key={opt.value} className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="radio"
                            name="employmentType"
                            value={opt.value}
                            checked={filters.employmentType === opt.value}
                            onChange={() => setFilter('employmentType', opt.value)}
                            className="text-blue-600"
                          />
                          <span className="text-sm text-gray-700">{opt.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* Salary Range */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Salary Range</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        placeholder="Min"
                        value={filters.salaryMin}
                        onChange={e => setFilter('salaryMin', e.target.value)}
                        className="w-full px-2 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500"
                        min={0}
                      />
                      <span className="text-gray-400 text-sm">–</span>
                      <input
                        type="number"
                        placeholder="Max"
                        value={filters.salaryMax}
                        onChange={e => setFilter('salaryMax', e.target.value)}
                        className="w-full px-2 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500"
                        min={0}
                      />
                    </div>
                  </div>

                  {/* Experience Level */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Experience Required</label>
                    <select
                      value={filters.experienceMax}
                      onChange={e => setFilter('experienceMax', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500"
                    >
                      {EXPERIENCE_OPTIONS.map(opt => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </aside>
            )}

            {/* Job listings */}
            <div className="flex-1 min-w-0">
              {/* Result count */}
              <p className="text-sm text-gray-500 mb-3">
                {loadingJobs ? 'Loading...' : `${filteredJobs.length} job${filteredJobs.length !== 1 ? 's' : ''} found`}
              </p>

              {loadingJobs ? (
                <div className="text-center py-12 text-gray-500">Loading jobs...</div>
              ) : filteredJobs.length > 0 ? (
                <div className="space-y-4">
                  {filteredJobs.map((job) => (
                    <Link href={'/jobs/' + job.id} key={job.id}>
                      <div className="bg-white rounded-lg shadow p-5 hover:shadow-md transition-shadow cursor-pointer mb-3">
                        <div className="flex justify-between items-start gap-4">
                          <div className="flex-1 min-w-0">
                            <h3 className="text-base font-semibold text-gray-900 truncate">{job.title}</h3>
                            <p className="text-gray-600 text-sm">{job.company_name}</p>
                            <div className="flex flex-wrap gap-2 mt-2">
                              {job.location_city && (
                                <span className="inline-flex items-center gap-1 text-xs text-gray-500">
                                  <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                                  </svg>
                                  {job.location_city}, {job.location_country}
                                </span>
                              )}
                              {job.location_type && (
                                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                                  job.location_type === 'remote'
                                    ? 'bg-green-100 text-green-700'
                                    : job.location_type === 'hybrid'
                                    ? 'bg-purple-100 text-purple-700'
                                    : 'bg-gray-100 text-gray-600'
                                }`}>
                                  {formatLabel(job.location_type)}
                                </span>
                              )}
                              {job.employment_type && (
                                <span className="text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 font-medium">
                                  {formatLabel(job.employment_type)}
                                </span>
                              )}
                            </div>
                            {(job.salary_min || job.salary_max) && (
                              <p className="text-sm text-green-600 font-medium mt-1.5">
                                {job.salary_currency || 'USD'}{' '}
                                {job.salary_min?.toLocaleString()}
                                {job.salary_max ? ` – ${job.salary_max.toLocaleString()}` : '+'}
                              </p>
                            )}
                            {job.experience_min_years > 0 && (
                              <p className="text-xs text-gray-400 mt-1">{job.experience_min_years}+ years experience</p>
                            )}
                          </div>
                          <div className="flex-shrink-0 text-right">
                            {job.similarity_score && (
                              <span className="inline-block bg-blue-100 text-blue-800 text-xs px-2.5 py-1 rounded-full font-medium">
                                {(job.similarity_score * 100).toFixed(1)}% match
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 text-gray-500">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mx-auto mb-3 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 115 11a6 6 0 0112 0z" />
                  </svg>
                  <p className="font-medium">{searchMode !== 'list' ? `No jobs found for "${searchQuery}"` : 'No jobs match your filters'}</p>
                  <p className="text-sm mt-1">{searchMode !== 'list' ? 'Try different keywords or clear the search' : 'Try adjusting or clearing your filters'}</p>
                  {activeFilterCount > 0 && (
                    <button
                      onClick={() => setFilters(EMPTY_FILTERS)}
                      className="mt-3 text-blue-600 hover:text-blue-800 text-sm font-medium"
                    >
                      Clear filters
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
