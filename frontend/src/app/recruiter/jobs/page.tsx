'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function RecruiterJobsRedirect() {
  const router = useRouter();
  useEffect(() => { router.replace('/recruiter/my-jobs'); }, [router]);
  return null;
}
