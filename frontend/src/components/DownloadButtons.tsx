import React from 'react';
import { Download, FileSpreadsheet, CheckCheck, FileText } from 'lucide-react';
import { api } from '../services/api';

interface DownloadButtonsProps {
  jobId?: string | null;
  hasOutput?: boolean;
}

export const DownloadButtons: React.FC<DownloadButtonsProps> = ({ jobId, hasOutput = true }) => {
  if (!jobId) {
    return (
      <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 text-center text-sm text-slate-500">
        No job selected. Select or start a job to download generated reports.
      </div>
    );
  }

  const reports = [
    {
      type: 'organized' as const,
      title: 'Final Organized Output',
      desc: 'Clean single row per product with formatted specs, features & links',
      icon: CheckCheck,
      color: 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/20',
      badge: 'Recommended',
    },
    {
      type: 'scraped' as const,
      title: 'Enriched Source Workbook',
      desc: 'Original input catalog enriched in-place with scraped columns',
      icon: FileSpreadsheet,
      color: 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-600/20',
      badge: 'In-Place',
    },
    {
      type: 'review' as const,
      title: 'Scrape Review & Audit Report',
      desc: 'Summary sheet + row audit with failure reasons & Google fallback links',
      icon: FileText,
      color: 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-600/20',
      badge: 'Audit',
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {reports.map((r) => {
        const Icon = r.icon;
        const downloadUrl = api.getDownloadUrl(jobId, r.type);

        return (
          <a
            key={r.type}
            href={hasOutput ? downloadUrl : undefined}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => {
              if (!hasOutput) {
                e.preventDefault();
                alert('The export files are currently being generated. Please wait a moment.');
              }
            }}
            className={`flex flex-col justify-between p-4 rounded-xl border border-transparent shadow-sm transition-all text-left ${
              hasOutput
                ? `${r.color} shadow-md cursor-pointer hover:scale-[1.01]`
                : 'bg-slate-200 text-slate-400 cursor-not-allowed border-slate-300'
            }`}
          >
            <div>
              <div className="flex items-center justify-between mb-2">
                <Icon className="w-6 h-6" />
                <span className={`text-[11px] font-semibold uppercase px-2 py-0.5 rounded-full ${hasOutput ? 'bg-white/20' : 'bg-slate-300 text-slate-500'}`}>
                  {r.badge}
                </span>
              </div>
              <h4 className="font-bold text-base">{r.title}</h4>
              <p className={`text-xs mt-1 ${hasOutput ? 'text-white/80' : 'text-slate-500'}`}>
                {r.desc}
              </p>
            </div>
            <div className="mt-4 flex items-center space-x-1.5 text-xs font-semibold">
              <Download className="w-4 h-4" />
              <span>{hasOutput ? 'Download Excel (.xlsx)' : 'Generating file...'}</span>
            </div>
          </a>
        );
      })}
    </div>
  );
};

