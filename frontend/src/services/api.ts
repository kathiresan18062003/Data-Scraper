import {
  DashboardStats,
  HealthStatus,
  Job,
  JobStartRequest,
  ProductResult,
  ProductResultsPage,
  UploadResponse,
} from '../types';

const RAW_API_URL = ((import.meta as any).env?.VITE_API_URL as string | undefined)?.trim() || '';
const API_BASE = RAW_API_URL
  ? (RAW_API_URL.endsWith('/api') ? RAW_API_URL : `${RAW_API_URL.replace(/\/$/, '')}/api`)
  : '/api';

async function request<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const url = `${API_BASE}${endpoint}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      Accept: 'application/json',
      ...options?.headers,
    },
  });

  if (!response.ok) {
    let errorDetail = `HTTP ${response.status}: ${response.statusText}`;
    try {
      const errJson = await response.json();
      if (errJson.detail) {
        errorDetail = typeof errJson.detail === 'string' ? errJson.detail : JSON.stringify(errJson.detail);
      }
    } catch {
      // ignore
    }
    throw new Error(errorDetail);
  }

  return response.json();
}

export const api = {
  getHealth: () => request<HealthStatus>('/health'),

  getDashboardStats: () => request<DashboardStats>('/dashboard'),

  uploadFile: async (file: File): Promise<UploadResponse> => {
    const formData = new FormData();
    formData.append('file', file);
    return request<UploadResponse>('/jobs/upload', {
      method: 'POST',
      body: formData,
    });
  },

  createJob: (req: JobStartRequest) =>
    request<Job>('/jobs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req),
    }),

  listJobs: async () => {
    const res = await request<{ jobs: Job[] }>('/jobs');
    return res.jobs;
  },

  getJob: (jobId: string) => request<Job>(`/jobs/${jobId}`),

  startJob: (jobId: string) =>
    request<Job>(`/jobs/${jobId}/start`, { method: 'POST' }),

  pauseJob: (jobId: string) =>
    request<Job>(`/jobs/${jobId}/pause`, { method: 'POST' }),

  resumeJob: (jobId: string) =>
    request<Job>(`/jobs/${jobId}/resume`, { method: 'POST' }),

  cancelJob: (jobId: string) =>
    request<Job>(`/jobs/${jobId}/cancel`, { method: 'POST' }),

  deleteJob: (jobId: string) =>
    request<{ success: boolean; message: string }>(`/jobs/${jobId}`, { method: 'DELETE' }),

  retryFailed: (jobId: string) =>
    request<Job>(`/jobs/${jobId}/retry`, { method: 'POST' }),

  getJobResults: (
    jobId: string,
    page: number = 1,
    pageSize: number = 25,
    status?: string,
    search?: string
  ) => {
    const params = new URLSearchParams();
    params.set('page', String(page));
    params.set('page_size', String(pageSize));
    if (status && status !== 'ALL') params.set('status', status);
    if (search && search.trim()) params.set('search', search.trim());
    return request<ProductResultsPage>(`/jobs/${jobId}/results?${params.toString()}`);
  },

  getSingleResult: (jobId: string, resultId: number) =>
    request<ProductResult>(`/jobs/${jobId}/results/${resultId}`),

  getDownloadUrl: (jobId: string, type: 'organized' | 'scraped' | 'review' = 'organized') =>
    `${API_BASE}/jobs/${jobId}/download?type=${type}`,
};

