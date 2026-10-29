import React, { useEffect, useState } from 'react';
import { ListFilter, RefreshCw, Eye, Download, Play, Pause, Square, RotateCw } from 'lucide-react';
import { Job } from '../types';
import { api } from '../services/api';
import { useJobProgress } from '../hooks/useJobProgress';
import { ActiveJobCard } from '../components/ActiveJobCard';
import { DownloadButtons } from '../components/DownloadButtons';

interface JobsPageProps {
  onSelectJob: (jobId: string) => void;
  selectedJobId: string | null;
  onNavigate: (page: string) => void;
}

export const JobsPage: React.FC<JobsPageProps> = ({
  onSelectJob,
  selectedJobId,
  onNavigate,
}) => {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(false);

  const { job: activeJob, pause, resume, cancel, retry } = useJobProgress(selectedJobId);

  const fetchJobs = async () => {
    setLoading(true);
    try {
      const data = await api.listJobs();
      setJobs(data);
      if (!selectedJobId && data.length > 0) {
        onSelectJob(data[0].id);
      }
    } catch (err) {
      console.error('Failed to load jobs list', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchJobs();
    const interval = setInterval(fetchJobs, 6000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Scraping Jobs Queue</h1>
          <p className="text-sm text-slate-500 mt-1">
            Monitor active batch tasks, control pauses/cancellations, and inspect persistent job records.
          </p>
        </div>

        <button
          onClick={fetchJobs}
          className="flex items-center space-x-1.5 px-3 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 rounded-lg text-xs font-semibold shadow-sm transition"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Refresh</span>
        </button>
      </div>

      {/* Active Selected Job Display */}
      {activeJob && (
        <div className="space-y-4">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700">
            Active Job Monitor
          </h2>
          <ActiveJobCard
            job={activeJob}
            onPause={pause}
            onResume={resume}
            onCancel={cancel}
            onRetry={retry}
          />

          <div className="pt-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-2">
              Job Downloads
            </h3>
            <DownloadButtons jobId={activeJob.id} hasOutput={activeJob.has_output} />
          </div>
        </div>
      )}

      {/* All Jobs Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/50">
          <h3 className="font-bold text-slate-900 text-sm">All Historical Scraping Jobs ({jobs.length})</h3>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-xs text-left">
            <thead className="bg-slate-100 font-bold text-slate-700">
              <tr>
                <th className="px-4 py-3">File / Sheet</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Progress</th>
                <th className="px-4 py-3">Verified / Review / Failed</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {loading && jobs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-8 text-slate-400">
                    Loading jobs...
                  </td>
                </tr>
              ) : jobs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-8 text-slate-400">
                    No jobs created yet.
                  </td>
                </tr>
              ) : (
                jobs.map((j) => (
                  <tr
                    key={j.id}
                    className={`hover:bg-slate-50 transition cursor-pointer ${
                      selectedJobId === j.id ? 'bg-blue-50/50 font-medium' : ''
                    }`}
                    onClick={() => onSelectJob(j.id)}
                  >
                    <td className="px-4 py-3">
                      <span className="font-bold text-slate-900 block">{j.original_filename}</span>
                      <span className="text-[11px] text-slate-500 font-normal">Sheet: {j.sheet_name}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${
                          j.status === 'COMPLETED'
                            ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                            : j.status === 'RUNNING'
                            ? 'bg-blue-100 text-blue-800 border-blue-200'
                            : j.status === 'PAUSED'
                            ? 'bg-amber-100 text-amber-800 border-amber-200'
                            : 'bg-slate-100 text-slate-700 border-slate-200'
                        }`}
                      >
                        {j.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-bold text-slate-800">
                        {j.processed_products} / {j.total_products}
                      </span>
                      <span className="text-slate-400 ml-1">
                        ({j.total_products > 0 ? Math.round((j.processed_products / j.total_products) * 100) : 0}%)
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center space-x-1.5">
                        <span className="text-emerald-700 font-semibold">{j.successful_products} ok</span>
                        <span>·</span>
                        <span className="text-amber-700 font-semibold">{j.review_products} rev</span>
                        <span>·</span>
                        <span className="text-rose-700 font-semibold">{j.failed_products} fail</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-500 text-[11px]">
                      {j.created_at ? new Date(j.created_at).toLocaleString() : 'N/A'}
                    </td>
                    <td className="px-4 py-3 text-right space-x-1" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => {
                          onSelectJob(j.id);
                          onNavigate('results');
                        }}
                        className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded font-semibold text-xs"
                      >
                        Results
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

