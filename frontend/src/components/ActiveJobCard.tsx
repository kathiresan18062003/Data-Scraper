import React, { useState } from 'react';
import { Play, Pause, Square, RotateCw, Terminal, ChevronDown, ChevronUp } from 'lucide-react';
import { Job } from '../types';

interface ActiveJobCardProps {
  job: Job;
  onPause: () => void;
  onResume: () => void;
  onCancel: () => void;
  onRetry: () => void;
}

export const ActiveJobCard: React.FC<ActiveJobCardProps> = ({
  job,
  onPause,
  onResume,
  onCancel,
  onRetry,
}) => {
  const [showLogs, setShowLogs] = useState(true);

  const pct = job.total_products > 0
    ? Math.round((job.processed_products / job.total_products) * 100)
    : 0;

  const statusColors = {
    RUNNING: 'bg-blue-100 text-blue-800 border-blue-200',
    COMPLETED: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    PAUSED: 'bg-amber-100 text-amber-800 border-amber-200',
    CANCELLED: 'bg-slate-100 text-slate-800 border-slate-200',
    FAILED: 'bg-rose-100 text-rose-800 border-rose-200',
    PENDING: 'bg-slate-100 text-slate-600 border-slate-200',
  };

  const curr = job.current_product_info || {};

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      {/* Header bar */}
      <div className="px-6 py-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3 bg-slate-50/50">
        <div>
          <div className="flex items-center space-x-2">
            <h3 className="font-bold text-slate-900 text-lg">
              {job.original_filename || job.filename}
            </h3>
            <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full border ${statusColors[job.status] || 'bg-slate-100'}`}>
              {job.status}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Worksheet: <span className="font-medium text-slate-700">{job.sheet_name}</span> · Job ID: <span className="font-mono text-slate-400">{job.id.substring(0, 8)}...</span>
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex items-center space-x-2">
          {job.status === 'RUNNING' && (
            <button
              onClick={onPause}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-amber-500 hover:bg-amber-600 text-white shadow-sm transition"
            >
              <Pause className="w-3.5 h-3.5" />
              <span>Pause</span>
            </button>
          )}

          {job.status === 'PAUSED' && (
            <button
              onClick={onResume}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white shadow-sm transition"
            >
              <Play className="w-3.5 h-3.5" />
              <span>Resume</span>
            </button>
          )}

          {['RUNNING', 'PAUSED', 'PENDING'].includes(job.status) && (
            <button
              onClick={onCancel}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 transition"
            >
              <Square className="w-3.5 h-3.5" />
              <span>Cancel</span>
            </button>
          )}

          {['COMPLETED', 'CANCELLED', 'FAILED', 'PAUSED'].includes(job.status) && job.failed_products > 0 && (
            <button
              onClick={onRetry}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm transition"
            >
              <RotateCw className="w-3.5 h-3.5" />
              <span>Retry Failed ({job.failed_products})</span>
            </button>
          )}
        </div>
      </div>

      {/* Progress body */}
      <div className="p-6">
        <div className="flex items-center justify-between text-sm mb-1.5">
          <span className="font-semibold text-slate-700">Progress</span>
          <span className="font-bold text-slate-900">{pct}% ({job.processed_products} / {job.total_products} products)</span>
        </div>
        <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden">
          <div
            className={`h-full transition-all duration-300 rounded-full ${
              job.status === 'COMPLETED'
                ? 'bg-emerald-500'
                : job.status === 'FAILED'
                ? 'bg-rose-500'
                : 'bg-blue-600'
            }`}
            style={{ width: `${pct}%` }}
          />
        </div>

        {/* Current product indicator */}
        {job.status === 'RUNNING' && curr.mpn && (
          <div className="mt-4 p-3 rounded-lg bg-blue-50/70 border border-blue-200 text-xs text-blue-900 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <span className="font-bold uppercase tracking-wider text-blue-700 mr-2">Current Item:</span>
              <span className="font-semibold">{curr.mfr} {curr.mpn}</span>
              {curr.stage && (
                <span className="ml-2 px-2 py-0.5 rounded bg-blue-200/70 text-blue-800 font-medium">
                  {curr.stage}
                </span>
              )}
            </div>
            {curr.url && (
              <span className="truncate max-w-xs text-blue-600 underline font-mono text-[11px]" title={curr.url}>
                {curr.url}
              </span>
            )}
          </div>
        )}

        {/* Logs accordion */}
        <div className="mt-5 border border-slate-200 rounded-lg overflow-hidden">
          <button
            onClick={() => setShowLogs(!showLogs)}
            className="w-full px-4 py-2 bg-slate-50 hover:bg-slate-100 flex items-center justify-between text-xs font-semibold text-slate-700 transition"
          >
            <div className="flex items-center space-x-2">
              <Terminal className="w-4 h-4 text-slate-500" />
              <span>Execution Logs & Activity ({job.logs?.length || 0})</span>
            </div>
            {showLogs ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>

          {showLogs && (
            <div className="bg-slate-950 p-4 font-mono text-xs text-slate-300 max-h-52 overflow-y-auto space-y-1">
              {job.logs && job.logs.length > 0 ? (
                job.logs.slice(-25).map((line, idx) => (
                  <div key={idx} className="leading-relaxed">
                    {line.includes('SUCCESS') ? (
                      <span className="text-emerald-400">{line}</span>
                    ) : line.includes('REVIEW') ? (
                      <span className="text-amber-400">{line}</span>
                    ) : line.includes('FAILED') || line.includes('Error') ? (
                      <span className="text-rose-400">{line}</span>
                    ) : (
                      <span>{line}</span>
                    )}
                  </div>
                ))
              ) : (
                <div className="text-slate-600 italic">No activity logs recorded yet.</div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

