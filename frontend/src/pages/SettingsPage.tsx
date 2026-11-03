import React, { useState, useEffect } from 'react';
import {
  Sliders,
  ShieldCheck,
  Database,
  HardDrive,
  CheckCircle2,
  AlertTriangle,
  HelpCircle,
  Globe,
  Save,
  Check,
  RefreshCw,
} from 'lucide-react';
import { HealthStatus } from '../types';

interface SettingsPageProps {
  health: HealthStatus | null;
}

export const SettingsPage: React.FC<SettingsPageProps> = ({ health }) => {
  // Preferred Domains
  const [preferredDomains, setPreferredDomains] = useState(
    'wilwood.com, summitracing.com, jegs.com, autozone.com, rockauto.com'
  );
  // Excluded Domains
  const [excludedDomains, setExcludedDomains] = useState(
    'pinterest.com, facebook.com, instagram.com, tiktok.com, twitter.com'
  );

  // Scraper defaults
  const [defaultTimeout, setDefaultTimeout] = useState('20');
  const [defaultDelay, setDefaultDelay] = useState('1.5');
  const [defaultRetries, setDefaultRetries] = useState('2');
  const [defaultScoreThreshold, setDefaultScoreThreshold] = useState('35');

  const [settingsSaved, setSettingsSaved] = useState(false);

  useEffect(() => {
    const savedPref = localStorage.getItem('scraper_preferred_domains');
    if (savedPref) setPreferredDomains(savedPref);

    const savedExcl = localStorage.getItem('scraper_excluded_domains');
    if (savedExcl) setExcludedDomains(savedExcl);

    const savedTimeout = localStorage.getItem('scraper_timeout');
    if (savedTimeout) setDefaultTimeout(savedTimeout);

    const savedDelay = localStorage.getItem('scraper_delay');
    if (savedDelay) setDefaultDelay(savedDelay);

    const savedRetries = localStorage.getItem('scraper_retries');
    if (savedRetries) setDefaultRetries(savedRetries);

    const savedScore = localStorage.getItem('scraper_score_threshold');
    if (savedScore) setDefaultScoreThreshold(savedScore);
  }, []);

  const handleSaveGeneralSettings = () => {
    localStorage.setItem('scraper_preferred_domains', preferredDomains.trim());
    localStorage.setItem('scraper_excluded_domains', excludedDomains.trim());
    localStorage.setItem('scraper_timeout', defaultTimeout.trim());
    localStorage.setItem('scraper_delay', defaultDelay.trim());
    localStorage.setItem('scraper_retries', defaultRetries.trim());
    localStorage.setItem('scraper_score_threshold', defaultScoreThreshold.trim());

    setSettingsSaved(true);
    setTimeout(() => setSettingsSaved(false), 2500);
  };

  const hasKey = Boolean(health?.gemini_available);

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Scraper Settings & Preferences</h1>
        <p className="text-sm text-slate-500 mt-1">
          Configure Google Gemini AI API credentials, domain whitelisting, scraping timeouts, and persistence directories.
        </p>
      </div>

      {/* 1. Gemini AI API Key Configuration */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <h2 className="text-base font-bold text-slate-900">Google Gemini AI Configuration</h2>
          </div>
          <span
            className={`text-xs font-bold px-2.5 py-0.5 rounded-full border ${
              hasKey
                ? 'bg-purple-50 text-purple-700 border-purple-200'
                : 'bg-amber-50 text-amber-700 border-amber-200'
            }`}
          >
            {hasKey ? 'Configured & Active' : 'Fallback Mode (Deterministic Only)'}
          </span>
        </div>

        <p className="text-xs text-slate-600 leading-relaxed">
          Gemini can help extract information already present on a product page. Its API key is configured only on the backend in the project .env file and is never stored in this browser. Without a server-side key, the scraper uses deterministic extraction.
        </p>
      </div>

      {/* 2. Source & Domain Preferences */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-4">
        <div className="flex items-center space-x-2">
          <Globe className="w-5 h-5 text-blue-600" />
          <h2 className="text-base font-bold text-slate-900">Source Domain Preferences</h2>
        </div>

        <div className="space-y-4 pt-2 text-xs">
          <div>
            <label className="block font-bold text-slate-700 mb-1">
              Preferred / Prioritized Domains (Comma-Separated)
            </label>
            <textarea
              rows={2}
              value={preferredDomains}
              onChange={(e) => setPreferredDomains(e.target.value)}
              placeholder="wilwood.com, summitracing.com, jegs.com..."
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-mono focus:ring-2 focus:ring-blue-500"
            />
            <span className="text-[11px] text-slate-400 mt-0.5 block">
              When search engine returns multiple matches, candidates from these domains receive highest priority.
            </span>
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">
              Excluded / Blocked Domains (Comma-Separated)
            </label>
            <textarea
              rows={2}
              value={excludedDomains}
              onChange={(e) => setExcludedDomains(e.target.value)}
              placeholder="pinterest.com, facebook.com, instagram.com..."
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-mono focus:ring-2 focus:ring-blue-500"
            />
            <span className="text-[11px] text-slate-400 mt-0.5 block">
              Search results from these aggregator or social domains are immediately filtered out.
            </span>
          </div>
        </div>
      </div>

      {/* 3. Scraping Performance & Delays */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-4">
        <div className="flex items-center space-x-2">
          <Sliders className="w-5 h-5 text-indigo-600" />
          <h2 className="text-base font-bold text-slate-900">Default Scraping Parameters</h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
          <div>
            <label className="block font-bold text-slate-700 mb-1">HTTP Request Timeout (s)</label>
            <input
              type="number"
              min={5}
              max={120}
              value={defaultTimeout}
              onChange={(e) => setDefaultTimeout(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
            />
            <span className="text-[11px] text-slate-400 mt-0.5 block">Default: 20 seconds</span>
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">Per-Domain Delay (s)</label>
            <input
              type="number"
              step="0.5"
              min={0.5}
              max={10}
              value={defaultDelay}
              onChange={(e) => setDefaultDelay(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
            />
            <span className="text-[11px] text-slate-400 mt-0.5 block">Polite anti-ban delay: 1.5s</span>
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">Max Candidate Retries</label>
            <input
              type="number"
              min={0}
              max={5}
              value={defaultRetries}
              onChange={(e) => setDefaultRetries(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
            />
            <span className="text-[11px] text-slate-400 mt-0.5 block">Default: 2 retries</span>
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">Match Score Threshold</label>
            <input
              type="number"
              min={10}
              max={100}
              value={defaultScoreThreshold}
              onChange={(e) => setDefaultScoreThreshold(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
            />
            <span className="text-[11px] text-slate-400 mt-0.5 block">Verified identity: 35 pts</span>
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <button
            onClick={handleSaveGeneralSettings}
            className="flex items-center space-x-1.5 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg text-xs transition shadow-sm"
          >
            {settingsSaved ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
            <span>{settingsSaved ? 'Preferences Saved!' : 'Save Parameters'}</span>
          </button>
        </div>
      </div>

      {/* 4. Active Directories & Paths */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-4">
        <div className="flex items-center space-x-2">
          <HardDrive className="w-5 h-5 text-slate-600" />
          <h2 className="text-base font-bold text-slate-900">Storage Directories</h2>
        </div>

        <div className="divide-y divide-slate-100 text-xs">
          <div className="py-2.5 flex items-center justify-between">
            <span className="text-slate-600 font-medium">Excel Outputs:</span>
            <span className="font-mono text-slate-800 bg-slate-100 px-2 py-0.5 rounded">./output</span>
          </div>
          <div className="py-2.5 flex items-center justify-between">
            <span className="text-slate-600 font-medium">Database Storage:</span>
            <span className="font-mono text-slate-800 bg-slate-100 px-2 py-0.5 rounded">./data/scraper.db</span>
          </div>
          <div className="py-2.5 flex items-center justify-between">
            <span className="text-slate-600 font-medium">Uploaded Temporary Catalogs:</span>
            <span className="font-mono text-slate-800 bg-slate-100 px-2 py-0.5 rounded">./temp_uploads</span>
          </div>
        </div>
      </div>
    </div>
  );
};
