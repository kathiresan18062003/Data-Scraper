import { useState, useEffect, useCallback, useRef } from 'react';
import { Job } from '../types';
import { api } from '../services/api';

export function useJobProgress(jobId: string | null) {
  const [job, setJob] = useState<Job | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const timerRef = useRef<number | null>(null);

  const fetchJob = useCallback(async () => {
    if (!jobId) {
      setJob(null);
      return;
    }
    try {
      const data = await api.getJob(jobId);
      setJob(data);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch job data');
    }
  }, [jobId]);

  useEffect(() => {
    if (!jobId) return;

    setLoading(true);
    fetchJob().finally(() => setLoading(false));

    // Polling interval
    const poll = async () => {
      await fetchJob();
    };

    timerRef.current = window.setInterval(poll, 1500);

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [jobId, fetchJob]);

  const pause = async () => {
    if (!jobId) return;
    try {
      const updated = await api.pauseJob(jobId);
      setJob(updated);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const resume = async () => {
    if (!jobId) return;
    try {
      const updated = await api.resumeJob(jobId);
      setJob(updated);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const cancel = async () => {
    if (!jobId) return;
    try {
      const updated = await api.cancelJob(jobId);
      setJob(updated);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const retry = async () => {
    if (!jobId) return;
    try {
      const updated = await api.retryFailed(jobId);
      setJob(updated);
    } catch (err: any) {
      setError(err.message);
    }
  };

  return {
    job,
    loading,
    error,
    refresh: fetchJob,
    pause,
    resume,
    cancel,
    retry,
  };
}

