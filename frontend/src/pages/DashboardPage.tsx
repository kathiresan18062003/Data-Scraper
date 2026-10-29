import React, { useEffect, useState } from 'react';
import {
  Layers,
  Upload,
  ArrowRight,
  Play,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Activity,
} from 'lucide-react';
import { DashboardStats, Job } from '../types';
import { api } from '../services/api';
import { useJobProgress } from '../hooks/useJobProgress';
import { MetricsCards } from '../components/MetricsCards';
import { DownloadButtons } from '../components/DownloadButtons';
import { ActiveJobCard } from '../components/ActiveJobCard';

interface DashboardPageProps {
  onNavigate: (page: string) => void;
  onSelectJob: (jobId: string) => void;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({ onNavigate, onSelectJob }) => {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchStats = async () => {
    try {
      const data = await api.getDashboardStats();
      setStats(data);
    } catch (err) {
      console.error('Failed to load dashboard stats', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
    const interval = setInterval(fetchStats, 5000);
    return () => clearInterval(interval);
  }, []);

  // Find if any job is currently running, paused, or pending
  const activeRunningJob = stats?.recent_jobs?.find(
    (j) => j.status === 'RUNNING' || j.status === 'PAUSED' || j.status === 'PENDING'
  );

  const latestJob = stats?.recent_jobs?.[0];
  const monitoredJobId = activeRunningJob?.id || (latestJob?.status === 'RUNNING' ? latestJob.id : null);

  const {
    job: activeJob,
    pause,
    resume,
    cancel,
    retry,
  } = useJobProgress(monitoredJobId);

  return (
    <div className="space-y-8 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Welcome & Action Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-blue-950 to-indigo-950 rounded-2xl p-6 sm:p-8 text-white shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-6 border border-slate-800">
        <div>
          <span className="text-xs font-semibold tracking-wider uppercase text-blue-400 bg-blue-500/20 px-2.5 py-1 rounded-full border border-blue-500/30">
            Enterprise Scraper Engine v2.1
          </span>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight mt-2">
            Product Data Scraper Dashboard
          </h1>
          <p className="text-sm text-slate-300 mt-1 max-w-2xl">
            Automated e-commerce catalog enrichment with multi-source web discovery, deterministic Schema.org parsing, and optional Google Gemini AI synthesis.
          </p>
        </div>

        <button
          onClick={() => onNavigate('upload')}
          className="flex items-center space-x-2 px-5 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm shadow-lg shadow-blue-600/30 transition hover:scale-105 flex-shrink-0"
        >
          <Upload className="w-4 h-4" />
          <span>Upload New Workbook</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>

      {/* Live Active Scraping Monitor (if job is active) */}
      {activeJob && (activeJob.status === 'RUNNING' || activeJob.status === 'PAUSED' || activeJob.status === 'PENDING') && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-bold uppercase tracking-wider text-blue-700 flex items-center space-x-1.5">
              <span className="w-2 h-2 rounded-full bg-blue-600 animate-ping" />
              <span>Live Scraping Progress Monitor</span>
            </h2>
            <button
              onClick={() => {
                onSelectJob(activeJob.id);
                onNavigate('history');
              }}
              className="text-xs font-semibold text-blue-600 hover:text-blue-800"
            >
              Open Queue Controls &rarr;
            </button>
          </div>
          <ActiveJobCard
            job={activeJob}
            onPause={pause}
            onResume={resume}
            onCancel={cancel}
            onRetry={retry}
          />
        </div>
      )}

      {/* High-level metrics */}
      <div>
        <h2 className="text-base font-bold text-slate-900 mb-3 uppercase tracking-wider text-xs">
          Global Scraping Metrics
        </h2>
        <MetricsCards
          total={stats?.total_products || 0}
          processed={(stats?.successful_products || 0) + (stats?.review_products || 0) + (stats?.failed_products || 0)}
          success={stats?.successful_products || 0}
          review={stats?.review_products || 0}
          failed={stats?.failed_products || 0}
        />
      </div>

      {/* Downloads for latest job */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
            Latest Job Exports & Reports
          </h2>
          {latestJob && (
            <span className="text-xs text-slate-500">
              Job: <span className="font-semibold text-slate-700">{latestJob.original_filename}</span> ({latestJob.status})
            </span>
          )}
        </div>
        <DownloadButtons jobId={latestJob?.id} hasOutput={latestJob?.has_output} />
      </div>

      {/* Recent Jobs Overview */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/50">
          <h3 className="font-bold text-slate-900 text-sm">Recent Scraping Jobs</h3>
          <button
            onClick={() => onNavigate('history')}
            className="text-xs font-semibold text-blue-600 hover:text-blue-700 flex items-center space-x-1"
          >
            <span>View All Historical Jobs</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="divide-y divide-slate-100">
          {stats?.recent_jobs && stats.recent_jobs.length > 0 ? (
            stats.recent_jobs.map((job) => (
              <div
                key={job.id}
                className="p-4 sm:px-6 hover:bg-slate-50 transition flex flex-col sm:flex-row sm:items-center justify-between gap-4"
              >
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="font-bold text-slate-900 text-sm">{job.original_filename}</span>
                    <span
                      className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${
                        job.status === 'COMPLETED'
                          ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                          : job.status === 'RUNNING'
                          ? 'bg-blue-100 text-blue-800 border-blue-200'
                          : job.status === 'PAUSED'
                          ? 'bg-amber-100 text-amber-800 border-amber-200'
                          : 'bg-slate-100 text-slate-700 border-slate-200'
                      }`}
                    >
                      {job.status}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    Sheet: <span className="font-medium text-slate-700">{job.sheet_name}</span> · Created: {job.created_at ? new Date(job.created_at).toLocaleString() : 'N/A'}
                  </p>
                </div>

                <div className="flex items-center space-x-4">
                  <div className="text-right">
                    <span className="text-xs font-bold text-slate-800 block">
                      {job.processed_products} / {job.total_products} products
                    </span>
                    <div className="flex items-center space-x-2 text-[11px] text-slate-500 mt-0.5">
                      <span className="text-emerald-600 font-semibold">{job.successful_products} ok</span>
                      <span>·</span>
                      <span className="text-amber-600 font-semibold">{job.review_products} rev</span>
                      <span>·</span>
                      <span className="text-rose-600 font-semibold">{job.failed_products} fail</span>
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      onSelectJob(job.id);
                      onNavigate('results');
                    }}
                    className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold rounded-lg text-xs transition"
                  >
                    View Results
                  </button>
                </div>
              </div>
            ))
          ) : (
            <div className="p-8 text-center text-slate-400 text-sm">
              No scraping jobs yet. Click "Upload New Workbook" to get started!
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
