import React, { useEffect, useState } from 'react';
import {
  History,
  RefreshCw,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  AlertTriangle,
  XCircle,
  Download,
  Trash2,
  RotateCw,
  ArrowRight,
  Eye,
} from 'lucide-react';
import { Job } from '../types';
import { api } from '../services/api';
import { useJobProgress } from '../hooks/useJobProgress';
import { ActiveJobCard } from '../components/ActiveJobCard';
import { DownloadButtons } from '../components/DownloadButtons';

interface HistoryPageProps {
  onSelectJob: (jobId: string) => void;
  selectedJobId: string | null;
  onNavigate: (page: string) => void;
}

export const HistoryPage: React.FC<HistoryPageProps> = ({
  onSelectJob,
  selectedJobId,
  onNavigate,
}) => {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [actionError, setActionError] = useState<string | null>(null);

  const { job: activeJob, pause, resume, cancel, retry } = useJobProgress(selectedJobId);

  const fetchJobs = async () => {
    setLoading(true);
    try {
      const data = await api.listJobs();
      setJobs(data);
      if (!selectedJobId && data.length > 0) {
        onSelectJob(data[0].id);
      }
    } catch (err: any) {
      console.error('Failed to load historical jobs', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchJobs();
    const interval = setInterval(fetchJobs, 6000);
    return () => clearInterval(interval);
  }, []);

  const handleDelete = async (jobId: string) => {
    if (!window.confirm('Are you sure you want to delete this job and its output records?')) {
      return;
    }
    try {
      await api.deleteJob(jobId);
      setJobs((prev) => prev.filter((j) => j.id !== jobId));
      if (selectedJobId === jobId) {
        const remaining = jobs.filter((j) => j.id !== jobId);
        onSelectJob(remaining.length > 0 ? remaining[0].id : '');
      }
    } catch (err: any) {
      setActionError(err.message || 'Failed to delete job');
    }
  };

  // Filter jobs
  const filteredJobs = jobs.filter((j) => {
    const matchesSearch =
      (j.original_filename || j.filename).toLowerCase().includes(search.toLowerCase()) ||
      j.sheet_name.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'ALL' || j.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  // Calculate totals
  const totalJobs = jobs.length;
  const totalProducts = jobs.reduce((acc, j) => acc + (j.total_products || 0), 0);
  const totalProcessed = jobs.reduce((acc, j) => acc + (j.processed_products || 0), 0);
  const totalSuccess = jobs.reduce((acc, j) => acc + (j.successful_products || 0), 0);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-2xl font-bold text-slate-900">Processing History</h1>
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-slate-200 text-slate-700">
              {totalJobs} {totalJobs === 1 ? 'Job' : 'Jobs'} Total
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Audit historical batch runs, inspect execution metrics, download reports, or resume interrupted jobs.
          </p>
        </div>

        <button
          onClick={fetchJobs}
          disabled={loading}
          className="flex items-center space-x-1.5 px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 rounded-lg text-xs font-semibold shadow-sm transition"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh History</span>
        </button>
      </div>

      {actionError && (
        <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center justify-between">
          <span>{actionError}</span>
          <button onClick={() => setActionError(null)} className="text-rose-500 hover:text-rose-700 text-xs font-bold">Dismiss</button>
        </div>
      )}

      {/* Aggregate Stats Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <span className="text-xs font-semibold text-slate-500 block">Total Workbooks</span>
          <span className="text-2xl font-bold text-slate-900 mt-1 block">{totalJobs}</span>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <span className="text-xs font-semibold text-slate-500 block">Total Products Listed</span>
          <span className="text-2xl font-bold text-slate-900 mt-1 block">{totalProducts}</span>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <span className="text-xs font-semibold text-slate-500 block">Products Processed</span>
          <span className="text-2xl font-bold text-blue-600 mt-1 block">{totalProcessed}</span>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <span className="text-xs font-semibold text-slate-500 block">Verified Matches</span>
          <span className="text-2xl font-bold text-emerald-600 mt-1 block">{totalSuccess}</span>
        </div>
      </div>

      {/* Selected Job Active Monitor (if active or clicked) */}
      {activeJob && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700">
              Selected Job Progress & Controls
            </h2>
            <button
              onClick={() => {
                onSelectJob(activeJob.id);
                onNavigate('results');
              }}
              className="text-xs font-bold text-blue-600 hover:text-blue-700 flex items-center space-x-1"
            >
              <span>Explore Extracted Records</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <ActiveJobCard
            job={activeJob}
            onPause={pause}
            onResume={resume}
            onCancel={cancel}
            onRetry={retry}
          />

          <div className="pt-1">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-2">
              Download Output Reports
            </h3>
            <DownloadButtons jobId={activeJob.id} hasOutput={activeJob.has_output} />
          </div>
        </div>
      )}

      {/* Search and Filters */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search by filename or sheet name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-lg text-xs font-medium focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="flex items-center space-x-2">
          <Filter className="w-4 h-4 text-slate-400" />
          <span className="text-xs font-semibold text-slate-600">Status:</span>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 bg-white"
          >
            <option value="ALL">All Statuses</option>
            <option value="RUNNING">Running</option>
            <option value="COMPLETED">Completed</option>
            <option value="PAUSED">Paused</option>
            <option value="PENDING">Pending</option>
            <option value="FAILED">Failed</option>
          </select>
        </div>
      </div>

      {/* Historical Jobs Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-xs text-left">
            <thead className="bg-slate-50 font-bold text-slate-700">
              <tr>
                <th className="px-5 py-3.5">Filename & Sheet</th>
                <th className="px-5 py-3.5">Status</th>
                <th className="px-5 py-3.5">Progress</th>
                <th className="px-5 py-3.5">Verified / Review / Failed</th>
                <th className="px-5 py-3.5">Started At</th>
                <th className="px-5 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {loading && jobs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-slate-400">
                    Loading job history...
                  </td>
                </tr>
              ) : filteredJobs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-slate-400">
                    No matching jobs found in history.
                  </td>
                </tr>
              ) : (
                filteredJobs.map((j) => {
                  const isSelected = selectedJobId === j.id;
                  const pct = j.total_products > 0
                    ? Math.round((j.processed_products / j.total_products) * 100)
                    : 0;

                  return (
                    <tr
                      key={j.id}
                      onClick={() => onSelectJob(j.id)}
                      className={`hover:bg-slate-50 transition cursor-pointer ${
                        isSelected ? 'bg-blue-50/60 font-medium' : ''
                      }`}
                    >
                      <td className="px-5 py-4">
                        <span className="font-bold text-slate-900 block text-sm">
                          {j.original_filename || j.filename}
                        </span>
                        <span className="text-[11px] text-slate-500 font-normal">
                          Sheet: <span className="font-semibold text-slate-700">{j.sheet_name}</span> · ID: <span className="font-mono text-slate-400">{j.id.substring(0, 8)}...</span>
                        </span>
                      </td>

                      <td className="px-5 py-4">
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${
                            j.status === 'COMPLETED'
                              ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                              : j.status === 'RUNNING'
                              ? 'bg-blue-100 text-blue-800 border-blue-200'
                              : j.status === 'PAUSED'
                              ? 'bg-amber-100 text-amber-800 border-amber-200'
                              : j.status === 'FAILED'
                              ? 'bg-rose-100 text-rose-800 border-rose-200'
                              : 'bg-slate-100 text-slate-700 border-slate-200'
                          }`}
                        >
                          {j.status}
                        </span>
                      </td>

                      <td className="px-5 py-4">
                        <div className="flex items-center space-x-2">
                          <span className="font-bold text-slate-800">
                            {j.processed_products} / {j.total_products}
                          </span>
                          <span className="text-xs font-semibold text-slate-500">
                            ({pct}%)
                          </span>
                        </div>
                        <div className="w-24 bg-slate-200 rounded-full h-1.5 mt-1 overflow-hidden">
                          <div
                            className={`h-full ${pct === 100 ? 'bg-emerald-500' : 'bg-blue-600'}`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </td>

                      <td className="px-5 py-4">
                        <div className="flex items-center space-x-2 text-xs">
                          <span className="text-emerald-700 font-semibold">{j.successful_products} ok</span>
                          <span className="text-slate-300">·</span>
                          <span className="text-amber-700 font-semibold">{j.review_products} rev</span>
                          <span className="text-slate-300">·</span>
                          <span className="text-rose-700 font-semibold">{j.failed_products} fail</span>
                        </div>
                      </td>

                      <td className="px-5 py-4 text-slate-500 text-[11px]">
                        {j.created_at ? new Date(j.created_at).toLocaleString() : 'N/A'}
                      </td>

                      <td className="px-5 py-4 text-right space-x-2" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => {
                            onSelectJob(j.id);
                            onNavigate('results');
                          }}
                          className="px-2.5 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg font-semibold text-xs transition"
                          title="View Extracted Results"
                        >
                          Results
                        </button>

                        <button
                          onClick={() => handleDelete(j.id)}
                          className="px-2 py-1.5 bg-slate-100 hover:bg-rose-50 text-slate-500 hover:text-rose-600 rounded-lg text-xs transition"
                          title="Delete Job Record"
                        >
                          <Trash2 className="w-3.5 h-3.5 inline" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

