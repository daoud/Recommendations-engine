'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import api, { Skill } from '@/lib/api';
import Link from 'next/link';

interface JobForm {
  title: string;
  company_name: string;
  description_raw: string;
  location_city: string;
  location_country: string;
  location_type: string;
  employment_type: string;
  salary_min: string;
  salary_max: string;
  salary_currency: string;
  experience_min_years: string;
  experience_max_years: string;
}

interface SelectedSkill {
  id: string;
  name: string;
  requirement_type: string;
  in_taxonomy: boolean;    // true = from DB, false = AI-validated new skill
  is_verified: boolean;    // false = AI added, pending admin review
}

interface SkillValidation {
  status: 'idle' | 'validating' | 'valid' | 'invalid' | 'error';
  message: string;
}

export default function PostJobPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [selectedSkills, setSelectedSkills] = useState<SelectedSkill[]>([]);
  const [skillSearch, setSkillSearch] = useState('');
  const [showSkillDropdown, setShowSkillDropdown] = useState(false);
  const [skillValidation, setSkillValidation] = useState<SkillValidation>({ status: 'idle', message: '' });
  const [parsing, setParsing] = useState(false);
  const [parseMessage, setParseMessage] = useState('');
  const skillInputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const [form, setForm] = useState<JobForm>({
    title: '',
    company_name: '',
    description_raw: '',
    location_city: '',
    location_country: '',
    location_type: 'onsite',
    employment_type: 'full_time',
    salary_min: '',
    salary_max: '',
    salary_currency: 'USD',
    experience_min_years: '',
    experience_max_years: '',
  });

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    } else if (!loading && user?.role !== 'recruiter') {
      router.push('/dashboard');
    }
  }, [user, loading, router]);

  useEffect(() => {
    fetchSkills();
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowSkillDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchSkills = async () => {
    try {
      const data = await api.getSkills();
      setSkills(data);
    } catch (error) {
      console.error('Error fetching skills:', error);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  // ─────────────────────────────────────────────────
  // SKILL HANDLING — Taxonomy match + AI validation
  // ─────────────────────────────────────────────────

  const handleAddSkill = (skill: Skill) => {
    if (!selectedSkills.find(s => s.id === skill.id)) {
      setSelectedSkills(prev => [...prev, {
        id: skill.id,
        name: skill.name,
        requirement_type: 'required',
        in_taxonomy: true,
        is_verified: true,
      }]);
    }
    setSkillSearch('');
    setShowSkillDropdown(false);
    setSkillValidation({ status: 'idle', message: '' });
  };

  const handleRemoveSkill = (skillId: string) => {
    setSelectedSkills(prev => prev.filter(s => s.id !== skillId));
  };

  const handleSkillTypeChange = (skillId: string, type: string) => {
    setSelectedSkills(prev => prev.map(s =>
      s.id === skillId ? { ...s, requirement_type: type } : s
    ));
  };

  const filteredSkills = skills.filter(s =>
    s.name.toLowerCase().includes(skillSearch.toLowerCase()) &&
    !selectedSkills.find(sel => sel.id === s.id)
  ).slice(0, 10);

  // ★ AI SKILL VALIDATION — called when user types a skill not in the dropdown
  const handleValidateAndAddSkill = useCallback(async () => {
    const raw = skillSearch.trim();
    if (!raw || raw.length < 2) return;

    // Check if already selected
    if (selectedSkills.find(s => s.name.toLowerCase() === raw.toLowerCase())) {
      setSkillValidation({ status: 'invalid', message: 'Skill already added' });
      return;
    }

    // Check if it matches a taxonomy skill exactly
    const exactMatch = skills.find(s => s.name.toLowerCase() === raw.toLowerCase());
    if (exactMatch) {
      handleAddSkill(exactMatch);
      return;
    }

    // ★ Call AI Validation endpoint
    setSkillValidation({ status: 'validating', message: 'Verifying skill with AI...' });

    try {
      const token = localStorage.getItem('token');
      const resp = await fetch('http://localhost:8000/jobs/validate-skill', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ skill_name: raw }),
      });

      if (!resp.ok) {
        const errData = await resp.json().catch(() => ({}));
        throw new Error(errData.detail || 'Validation failed');
      }

      const data = await resp.json();

      if (data.is_valid) {
        const skillId = data.existing_skill_id || data.newly_created_id;
        const alreadyAdded = selectedSkills.find(s => s.id === skillId);
        if (alreadyAdded) {
          setSkillValidation({ status: 'invalid', message: `Already added as "${alreadyAdded.name}"` });
          return;
        }

        // Show correction if name was fixed
        const correctedMsg = data.corrected_name.toLowerCase() !== raw.toLowerCase()
          ? ` (corrected from "${raw}")`
          : '';

        setSelectedSkills(prev => [...prev, {
          id: skillId,
          name: data.canonical_name,
          requirement_type: 'required',
          in_taxonomy: !!data.existing_skill_id,
          is_verified: !!data.existing_skill_id,
        }]);

        setSkillValidation({
          status: 'valid',
          message: `✓ "${data.canonical_name}" verified${correctedMsg} — ${data.description}`,
        });
        setSkillSearch('');
        setShowSkillDropdown(false);

        // Refresh skills list to include newly added skill
        if (data.newly_created_id) {
          fetchSkills();
        }

        // Clear message after 4s
        setTimeout(() => setSkillValidation({ status: 'idle', message: '' }), 4000);
      } else {
        setSkillValidation({
          status: 'invalid',
          message: `✗ "${raw}" is not a recognized skill. ${data.description || 'Please check the spelling.'}`,
        });
      }
    } catch (err: any) {
      console.error('Skill validation error:', err);
      setSkillValidation({
        status: 'error',
        message: `Validation error: ${err.message}. The skill was not added.`,
      });
    }
  }, [skillSearch, selectedSkills, skills]);

  // Handle Enter key in skill input → trigger AI validation
  const handleSkillKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      // If dropdown has exact match, add it; otherwise validate via AI
      if (filteredSkills.length > 0 && filteredSkills[0].name.toLowerCase() === skillSearch.toLowerCase()) {
        handleAddSkill(filteredSkills[0]);
      } else if (filteredSkills.length > 0) {
        handleAddSkill(filteredSkills[0]);
      } else {
        handleValidateAndAddSkill();
      }
    }
  };

  // ─────────────────────────────────────────────────
  // JOB DESCRIPTION AUTO-PARSER
  // ─────────────────────────────────────────────────

  const handleParseDescription = async () => {
    const desc = form.description_raw.trim();
    if (!desc || desc.length < 30) {
      setParseMessage('Please enter at least 30 characters in the Job Description first.');
      setTimeout(() => setParseMessage(''), 3000);
      return;
    }

    setParsing(true);
    setParseMessage('AI is analyzing the job description...');

    try {
      const token = localStorage.getItem('token');
      const resp = await fetch('http://localhost:8000/jobs/parse-description', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ description: desc }),
      });

      if (!resp.ok) {
        const errData = await resp.json().catch(() => ({}));
        throw new Error(errData.detail || 'Parse failed');
      }

      const data = await resp.json();

      // ★ Auto-fill form fields (only overwrite empty fields by default)
      setForm(prev => ({
        ...prev,
        title: data.title || prev.title,
        company_name: data.company_name || prev.company_name,
        location_city: data.location_city || prev.location_city,
        location_country: data.location_country || prev.location_country,
        location_type: data.location_type || prev.location_type,
        employment_type: data.employment_type || prev.employment_type,
        salary_min: data.salary_min ? String(data.salary_min) : prev.salary_min,
        salary_max: data.salary_max ? String(data.salary_max) : prev.salary_max,
        salary_currency: data.salary_currency || prev.salary_currency,
        experience_min_years: data.experience_min_years != null ? String(data.experience_min_years) : prev.experience_min_years,
        experience_max_years: data.experience_max_years != null ? String(data.experience_max_years) : prev.experience_max_years,
      }));

      // ★ Auto-fill skills
      if (data.skills && data.skills.length > 0) {
        const newSkills: SelectedSkill[] = [];
        for (const sk of data.skills) {
          // Skip if already in selected list
          if (selectedSkills.find(s => s.name.toLowerCase() === sk.name.toLowerCase())) continue;
          if (newSkills.find(s => s.name.toLowerCase() === sk.name.toLowerCase())) continue;

          if (sk.skill_id && sk.in_taxonomy) {
            // Skill found in DB taxonomy
            newSkills.push({
              id: sk.skill_id,
              name: sk.name,
              requirement_type: sk.requirement_type || 'required',
              in_taxonomy: true,
              is_verified: true,
            });
          } else {
            // Skill NOT in taxonomy → needs AI validation
            // We'll validate them silently in background
            try {
              const vResp = await fetch('http://localhost:8000/jobs/validate-skill', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${token}`,
                },
                body: JSON.stringify({ skill_name: sk.name }),
              });
              if (vResp.ok) {
                const vData = await vResp.json();
                if (vData.is_valid) {
                  const sid = vData.existing_skill_id || vData.newly_created_id;
                  if (!selectedSkills.find(s => s.id === sid) && !newSkills.find(s => s.id === sid)) {
                    newSkills.push({
                      id: sid,
                      name: vData.canonical_name,
                      requirement_type: sk.requirement_type || 'required',
                      in_taxonomy: !!vData.existing_skill_id,
                      is_verified: !!vData.existing_skill_id,
                    });
                  }
                }
              }
            } catch {
              // Skip skills that fail validation
            }
          }
        }
        if (newSkills.length > 0) {
          setSelectedSkills(prev => [...prev, ...newSkills]);
          fetchSkills(); // Refresh to include any newly created skills
        }

        const totalFound = data.skills.length;
        const added = newSkills.length;
        setParseMessage(`✓ AI extracted ${totalFound} skills and auto-filled form fields. ${added} new skill${added !== 1 ? 's' : ''} added.`);
      } else {
        setParseMessage('✓ Form fields auto-filled from description. No specific skills detected.');
      }

      setTimeout(() => setParseMessage(''), 6000);
    } catch (err: any) {
      console.error('JD parse error:', err);
      setParseMessage(`✗ ${err.message}`);
      setTimeout(() => setParseMessage(''), 5000);
    } finally {
      setParsing(false);
    }
  };

  // ─────────────────────────────────────────────────
  // FORM SUBMIT
  // ─────────────────────────────────────────────────

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);

    try {
      const jobData = {
        title: form.title,
        company_name: form.company_name,
        description_raw: form.description_raw,
        location_city: form.location_city || undefined,
        location_country: form.location_country || undefined,
        location_type: form.location_type,
        employment_type: form.employment_type,
        salary_min: form.salary_min ? parseInt(form.salary_min) : undefined,
        salary_max: form.salary_max ? parseInt(form.salary_max) : undefined,
        salary_currency: form.salary_currency,
        experience_min_years: form.experience_min_years ? parseInt(form.experience_min_years) : undefined,
        experience_max_years: form.experience_max_years ? parseInt(form.experience_max_years) : undefined,
        is_active: true,
        source_type: 'internal',
      };

      const job = await api.createJob(jobData);

      for (const skill of selectedSkills) {
        try {
          await api.addJobSkill(job.id, skill.id, skill.requirement_type);
        } catch (err) {
          console.error('Error adding skill:', err);
        }
      }

      setSuccess(true);
      setTimeout(() => {
        router.push('/recruiter/my-jobs');
      }, 2000);
    } catch (err: any) {
      setError(err.message || 'Failed to post job');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-xl">Loading...</div>
      </div>
    );
  }

  if (!user || user.role !== 'recruiter') {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-blue-600">Post New Job</h1>
          <Link href="/recruiter" className="text-blue-600 hover:text-blue-800">
            ← Back to Dashboard
          </Link>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto px-4 py-8">
        {success ? (
          <div className="bg-green-100 border border-green-400 text-green-700 px-6 py-4 rounded-lg">
            <h3 className="font-bold text-lg">Job Posted Successfully!</h3>
            <p>Redirecting to your jobs...</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow p-6 space-y-6">
            {error && (
              <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
                {error}
              </div>
            )}

            {/* Row 1: Title + Company */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Job Title *</label>
                <input
                  type="text"
                  name="title"
                  value={form.title}
                  onChange={handleChange}
                  required
                  placeholder="e.g., Senior Software Engineer"
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Company Name *</label>
                <input
                  type="text"
                  name="company_name"
                  value={form.company_name}
                  onChange={handleChange}
                  required
                  placeholder="e.g., Tech Corp"
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* ★ Job Description + AI Auto-Fill Button */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-sm font-medium text-gray-700">Job Description *</label>
                <button
                  type="button"
                  onClick={handleParseDescription}
                  disabled={parsing || !form.description_raw.trim()}
                  className={`text-sm px-4 py-1.5 rounded-lg font-medium transition-all flex items-center gap-2
                    ${parsing
                      ? 'bg-amber-100 text-amber-700 cursor-wait'
                      : form.description_raw.trim().length >= 30
                        ? 'bg-gradient-to-r from-purple-600 to-blue-600 text-white hover:from-purple-700 hover:to-blue-700 shadow-sm'
                        : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                    }`}
                >
                  {parsing ? (
                    <>
                      <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                      </svg>
                      Analyzing...
                    </>
                  ) : (
                    <>
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                      AI Auto-Fill from Description
                    </>
                  )}
                </button>
              </div>
              <textarea
                name="description_raw"
                value={form.description_raw}
                onChange={handleChange}
                required
                rows={8}
                placeholder="Paste or type the full job description here. Include responsibilities, requirements, skills needed, location, salary range, etc. Then click 'AI Auto-Fill' to populate the form automatically."
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              />
              {parseMessage && (
                <div className={`mt-2 text-sm px-3 py-2 rounded-lg ${
                  parseMessage.startsWith('✓') ? 'bg-green-50 text-green-700 border border-green-200' :
                  parseMessage.startsWith('✗') ? 'bg-red-50 text-red-700 border border-red-200' :
                  'bg-blue-50 text-blue-700 border border-blue-200'
                }`}>
                  {parseMessage}
                </div>
              )}
            </div>

            {/* Row: Location */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
                <input
                  type="text"
                  name="location_city"
                  value={form.location_city}
                  onChange={handleChange}
                  placeholder="e.g., Riyadh"
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Country</label>
                <input
                  type="text"
                  name="location_country"
                  value={form.location_country}
                  onChange={handleChange}
                  placeholder="e.g., Saudi Arabia"
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Work Type</label>
                <select
                  name="location_type"
                  value={form.location_type}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="onsite">On-site</option>
                  <option value="remote">Remote</option>
                  <option value="hybrid">Hybrid</option>
                </select>
              </div>
            </div>

            {/* Row: Employment + Experience */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Employment Type</label>
                <select
                  name="employment_type"
                  value={form.employment_type}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="full_time">Full-time</option>
                  <option value="part_time">Part-time</option>
                  <option value="contract">Contract</option>
                  <option value="internship">Internship</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Min Experience (years)</label>
                <input
                  type="number"
                  name="experience_min_years"
                  value={form.experience_min_years}
                  onChange={handleChange}
                  min="0"
                  placeholder="e.g., 3"
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Max Experience (years)</label>
                <input
                  type="number"
                  name="experience_max_years"
                  value={form.experience_max_years}
                  onChange={handleChange}
                  min="0"
                  placeholder="e.g., 7"
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* Row: Salary */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Min Salary</label>
                <input
                  type="number"
                  name="salary_min"
                  value={form.salary_min}
                  onChange={handleChange}
                  min="0"
                  placeholder="e.g., 50000"
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Max Salary</label>
                <input
                  type="number"
                  name="salary_max"
                  value={form.salary_max}
                  onChange={handleChange}
                  min="0"
                  placeholder="e.g., 80000"
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Currency</label>
                <select
                  name="salary_currency"
                  value={form.salary_currency}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="USD">USD ($)</option>
                  <option value="SAR">SAR (ر.س)</option>
                  <option value="EUR">EUR (€)</option>
                  <option value="GBP">GBP (£)</option>
                  <option value="INR">INR (₹)</option>
                  <option value="AED">AED (د.إ)</option>
                </select>
              </div>
            </div>

            {/* ★ SKILLS SECTION — with AI validation */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Required Skills
                <span className="ml-2 text-xs text-gray-400 font-normal">
                  Type a skill and press Enter. Unknown skills are verified by AI automatically.
                </span>
              </label>

              {/* Selected skills chips */}
              {selectedSkills.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-3">
                  {selectedSkills.map((skill) => (
                    <div
                      key={skill.id}
                      className={`flex items-center gap-2 rounded-lg px-3 py-1 border ${
                        skill.in_taxonomy
                          ? 'bg-blue-50 border-blue-200'
                          : 'bg-amber-50 border-amber-200'
                      }`}
                    >
                      <span className="font-medium text-sm">{skill.name}</span>
                      {!skill.in_taxonomy && (
                        <span className="text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded">AI added</span>
                      )}
                      <select
                        value={skill.requirement_type}
                        onChange={(e) => handleSkillTypeChange(skill.id, e.target.value)}
                        className="text-xs bg-transparent border-none focus:ring-0 py-0"
                      >
                        <option value="required">Required</option>
                        <option value="preferred">Preferred</option>
                        <option value="nice_to_have">Nice to have</option>
                      </select>
                      <button
                        type="button"
                        onClick={() => handleRemoveSkill(skill.id)}
                        className="text-red-400 hover:text-red-600 text-lg leading-none"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Skill search input with dropdown + AI validate button */}
              <div className="relative" ref={dropdownRef}>
                <div className="flex gap-2">
                  <input
                    ref={skillInputRef}
                    type="text"
                    value={skillSearch}
                    onChange={(e) => { setSkillSearch(e.target.value); setShowSkillDropdown(true); setSkillValidation({ status: 'idle', message: '' }); }}
                    onFocus={() => setShowSkillDropdown(true)}
                    onKeyDown={handleSkillKeyDown}
                    placeholder="Search skills or type a new one and press Enter..."
                    className="flex-1 px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                  {skillSearch.trim().length >= 2 && filteredSkills.length === 0 && (
                    <button
                      type="button"
                      onClick={handleValidateAndAddSkill}
                      disabled={skillValidation.status === 'validating'}
                      className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${
                        skillValidation.status === 'validating'
                          ? 'bg-amber-100 text-amber-700'
                          : 'bg-green-600 text-white hover:bg-green-700'
                      }`}
                    >
                      {skillValidation.status === 'validating' ? (
                        <span className="flex items-center gap-1">
                          <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                          </svg>
                          Verifying...
                        </span>
                      ) : (
                        '+ Add & Verify'
                      )}
                    </button>
                  )}
                </div>

                {/* Dropdown */}
                {showSkillDropdown && skillSearch && filteredSkills.length > 0 && (
                  <div className="absolute z-10 w-full mt-1 bg-white border rounded-lg shadow-lg max-h-60 overflow-y-auto">
                    {filteredSkills.map((skill) => (
                      <button
                        key={skill.id}
                        type="button"
                        onClick={() => handleAddSkill(skill)}
                        className="w-full px-4 py-2 text-left hover:bg-blue-50 flex items-center justify-between"
                      >
                        <span>{skill.name}</span>
                        <span className="text-xs text-gray-400">({skill.skill_type})</span>
                      </button>
                    ))}
                    {/* Show "not found" hint at bottom of partial results */}
                    {filteredSkills.length > 0 && skillSearch.length >= 2 && (
                      <div className="px-4 py-2 text-xs text-gray-400 border-t bg-gray-50">
                        Don&apos;t see your skill? Press <kbd className="px-1 py-0.5 bg-gray-200 rounded text-xs">Enter</kbd> to verify &quot;{skillSearch}&quot; with AI
                      </div>
                    )}
                  </div>
                )}

                {/* No dropdown results + hint to validate */}
                {showSkillDropdown && skillSearch.length >= 2 && filteredSkills.length === 0 && skillValidation.status === 'idle' && (
                  <div className="absolute z-10 w-full mt-1 bg-amber-50 border border-amber-200 rounded-lg shadow-lg px-4 py-3">
                    <p className="text-sm text-amber-800">
                      &quot;{skillSearch}&quot; not found in skill database.
                      Press <kbd className="px-1.5 py-0.5 bg-amber-100 border border-amber-300 rounded text-xs font-mono">Enter</kbd> or
                      click <strong>+ Add & Verify</strong> to validate it with AI.
                    </p>
                  </div>
                )}
              </div>

              {/* Validation status message */}
              {skillValidation.message && (
                <div className={`mt-2 text-sm px-3 py-2 rounded-lg ${
                  skillValidation.status === 'valid' ? 'bg-green-50 text-green-700 border border-green-200' :
                  skillValidation.status === 'invalid' ? 'bg-red-50 text-red-700 border border-red-200' :
                  skillValidation.status === 'validating' ? 'bg-blue-50 text-blue-700 border border-blue-200' :
                  'bg-red-50 text-red-700 border border-red-200'
                }`}>
                  {skillValidation.message}
                </div>
              )}
            </div>

            {/* Submit buttons */}
            <div className="flex gap-4">
              <button
                type="submit"
                disabled={submitting}
                className="flex-1 bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 font-medium disabled:bg-blue-400"
              >
                {submitting ? 'Posting...' : 'Post Job'}
              </button>
              <Link href="/recruiter" className="px-6 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 font-medium text-center">
                Cancel
              </Link>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
