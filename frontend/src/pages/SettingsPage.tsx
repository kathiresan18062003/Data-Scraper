import React from 'react';
import { Sliders, ShieldCheck, Database, HardDrive, CheckCircle2, AlertTriangle, HelpCircle } from 'lucide-react';
import { HealthStatus } from '../types';

interface SettingsPageProps {
  health: HealthStatus | null;
}

export const SettingsPage: React.FC<SettingsPageProps> = ({ health }) => {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Backend Status & Settings</h1>
        <p className="text-sm text-slate-500 mt-1">
          System readiness, AI configuration, SQLite persistence, and scraper runtime parameters.
        </p>
      </div>

      {/* Services Health Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* FastAPI Server */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-start space-x-3">
          <div className="p-2.5 rounded-lg bg-emerald-50 text-emerald-600">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div>
            <h4 className="font-bold text-sm text-slate-800">FastAPI Backend</h4>
            <span className="text-xs text-emerald-600 font-semibold block mt-0.5">
              Uvicorn (v{health?.version || '2.0.0'})
            </span>
            <span className="text-[11px] text-slate-400">REST API & background workers</span>
          </div>
        </div>

        {/* Database */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-start space-x-3">
          <div className="p-2.5 rounded-lg bg-blue-50 text-blue-600">
            <Database className="w-5 h-5" />
          </div>
          <div>
            <h4 className="font-bold text-sm text-slate-800">SQLite Database</h4>
            <span className="text-xs text-blue-600 font-semibold block mt-0.5">
              {health?.database_connected ? 'Connected & Migrated' : 'Disconnected'}
            </span>
            <span className="text-[11px] text-slate-400">data/scraper.db</span>
          </div>
        </div>

        {/* Gemini AI */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-start space-x-3">
          <div className={`p-2.5 rounded-lg ${health?.gemini_available ? 'bg-purple-50 text-purple-600' : 'bg-amber-50 text-amber-600'}`}>
            {health?.gemini_available ? <ShieldCheck className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
          </div>
          <div>
            <h4 className="font-bold text-sm text-slate-800">Google Gemini AI</h4>
            <span className={`text-xs font-semibold block mt-0.5 ${health?.gemini_available ? 'text-purple-600' : 'text-amber-600'}`}>
              {health?.gemini_available ? 'Key Verified & Ready' : 'Key Missing (Fallback Mode)'}
            </span>
            <span className="text-[11px] text-slate-400">gemini-2.5-flash</span>
          </div>
        </div>
      </div>

      {/* Configuration Details Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 bg-slate-50/50">
          <h3 className="font-bold text-slate-900 text-sm">Active Runtime Parameters (.env)</h3>
        </div>

        <div className="divide-y divide-slate-100 text-xs">
          <div className="px-6 py-3 flex items-center justify-between">
            <span className="font-semibold text-slate-700">GEMINI_API_KEY</span>
            <span className="font-mono text-slate-500">
              {health?.gemini_available ? '●●●●●●●●●●●●●●●● (Configured securely in backend)' : 'Not set'}
            </span>
          </div>
          <div className="px-6 py-3 flex items-center justify-between">
            <span className="font-semibold text-slate-700">GEMINI_MODEL</span>
            <span className="font-mono text-slate-800 bg-slate-100 px-2 py-0.5 rounded">gemini-2.5-flash</span>
          </div>
          <div className="px-6 py-3 flex items-center justify-between">
            <span className="font-semibold text-slate-700">REQUEST_TIMEOUT</span>
            <span className="font-mono text-slate-800">20 seconds (configurable per job)</span>
          </div>
          <div className="px-6 py-3 flex items-center justify-between">
            <span className="font-semibold text-slate-700">DOMAIN_DELAY</span>
            <span className="font-mono text-slate-800">1.5 seconds (per-domain polite scraping)</span>
          </div>
          <div className="px-6 py-3 flex items-center justify-between">
            <span className="font-semibold text-slate-700">VALID_SCORE</span>
            <span className="font-mono text-slate-800">35 points (threshold for verified identity)</span>
          </div>
          <div className="px-6 py-3 flex items-center justify-between">
            <span className="font-semibold text-slate-700">OUTPUT_DIR</span>
            <span className="font-mono text-slate-800">./output</span>
          </div>
          <div className="px-6 py-3 flex items-center justify-between">
            <span className="font-semibold text-slate-700">DATA_DIR</span>
            <span className="font-mono text-slate-800">./data</span>
          </div>
        </div>
      </div>

      {/* Help & Workflow Guide */}
      <div className="bg-slate-50 rounded-xl border border-slate-200 p-6 space-y-4">
        <h3 className="font-bold text-slate-900 text-sm flex items-center space-x-2">
          <HelpCircle className="w-4 h-4 text-blue-600" />
          <span>Product Scraping Workflow Guide</span>
        </h3>
        <ol className="list-decimal list-inside space-y-2 text-xs text-slate-600 leading-relaxed">
          <li>
            <strong className="text-slate-800">Upload Catalog:</strong> Upload your .xlsx file on the "Upload & Process" page. The backend reads sheets and auto-detects columns.
          </li>
          <li>
            <strong className="text-slate-800">Column Mapping:</strong> Confirm the MPN and Manufacturer columns. The system strips leading brand line codes (e.g., <code className="bg-white px-1 py-0.5 rounded">WLD140-13303-R</code> &rarr; <code className="bg-white px-1 py-0.5 rounded">140-13303-R</code>) for accurate web discovery.
          </li>
          <li>
            <strong className="text-slate-800">Multi-Tier Discovery:</strong> The engine queries official manufacturer domains first, then reputable distributors and e-commerce stores via DuckDuckGo.
          </li>
          <li>
            <strong className="text-slate-800">Hybrid Extraction:</strong> Schema.org JSON-LD and HTML specs are parsed deterministically. If gaps remain, Google Gemini AI synthesizes missing fields from the page text.
          </li>
          <li>
            <strong className="text-slate-800">Simultaneous Saving:</strong> As scraping progresses, each product is committed to SQLite and continuously synced to three Excel reports in the <code className="bg-white px-1 py-0.5 rounded">output/</code> directory.
          </li>
        </ol>
      </div>
    </div>
  );
};

