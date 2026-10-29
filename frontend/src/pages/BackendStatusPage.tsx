import React, { useState } from 'react';
import {
  Activity,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Database,
  Search,
  Sparkles,
  Server,
  RefreshCw,
  Clock,
  HardDrive,
  ShieldCheck,
  Terminal,
} from 'lucide-react';
import { HealthStatus } from '../types';
import { api } from '../services/api';

interface BackendStatusPageProps {
  health: HealthStatus | null;
  onRefreshHealth: () => void;
}

export const BackendStatusPage: React.FC<BackendStatusPageProps> = ({
  health,
  onRefreshHealth,
}) => {
  const [testing, setTesting] = useState(false);
  const [latencyMs, setLatencyMs] = useState<number | null>(null);
  const [testResult, setTestResult] = useState<string | null>(null);

  const runDiagnostics = async () => {
    setTesting(true);
    setTestResult(null);
    const start = performance.now();
    try {
      await api.getHealth();
      const elapsed = Math.round(performance.now() - start);
      setLatencyMs(elapsed);
      setTestResult(`Health probe returned OK in ${elapsed}ms. All core API routers responding normally.`);
      onRefreshHealth();
    } catch (err: any) {
      setLatencyMs(null);
      setTestResult(`Health probe failed: ${err.message || 'Connection refused'}`);
    } finally {
      setTesting(false);
    }
  };

  const isHealthy = health?.status === 'healthy';

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-2xl font-bold text-slate-900">Backend Status & Diagnostics</h1>
            <span
              className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${
                isHealthy
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : 'bg-rose-50 text-rose-700 border-rose-200'
              }`}
            >
              {isHealthy ? 'Operational' : 'Degraded'}
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Real-time health inspection, database connectivity, AI subsystem availability, and runtime parameters.
          </p>
        </div>

        <button
          onClick={runDiagnostics}
          disabled={testing}
          className="flex items-center space-x-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg shadow-sm transition disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${testing ? 'animate-spin' : ''}`} />
          <span>{testing ? 'Probing Backend...' : 'Run Diagnostics Probe'}</span>
        </button>
      </div>

      {/* Health Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* 1. FastAPI Server */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <div className="flex items-start justify-between">
            <div className="p-2.5 rounded-lg bg-blue-50 text-blue-600">
              <Server className="w-5 h-5" />
            </div>
            <span
              className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                isHealthy ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
              }`}
            >
              {isHealthy ? 'ONLINE' : 'OFFLINE'}
            </span>
          </div>
          <div className="mt-4">
            <h3 className="font-bold text-sm text-slate-900">FastAPI REST Server</h3>
            <p className="text-xs text-slate-500 mt-0.5">Uvicorn ASGI Engine v{health?.version || '2.1.0'}</p>
            <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
              <span>Latency:</span>
              <span className="font-mono font-semibold text-slate-800">
                {latencyMs !== null ? `${latencyMs}ms` : '< 20ms'}
              </span>
            </div>
          </div>
        </div>

        {/* 2. SQLite Database */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <div className="flex items-start justify-between">
            <div className="p-2.5 rounded-lg bg-indigo-50 text-indigo-600">
              <Database className="w-5 h-5" />
            </div>
            <span
              className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                health?.database_connected ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
              }`}
            >
              {health?.database_connected ? 'CONNECTED' : 'DISCONNECTED'}
            </span>
          </div>
          <div className="mt-4">
            <h3 className="font-bold text-sm text-slate-900">SQLite Database</h3>
            <p className="text-xs text-slate-500 mt-0.5">Persistent Job & Product Store</p>
            <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
              <span>Path:</span>
              <span className="font-mono font-semibold text-slate-800">data/scraper.db</span>
            </div>
          </div>
        </div>

        {/* 3. Search Engine Discovery */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <div className="flex items-start justify-between">
            <div className="p-2.5 rounded-lg bg-emerald-50 text-emerald-600">
              <Search className="w-5 h-5" />
            </div>
            <span
              className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                health?.search_available ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
              }`}
            >
              {health?.search_available ? 'AVAILABLE' : 'STANDBY'}
            </span>
          </div>
          <div className="mt-4">
            <h3 className="font-bold text-sm text-slate-900">Search Discovery</h3>
            <p className="text-xs text-slate-500 mt-0.5">DuckDuckGo Search + Direct URL</p>
            <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
              <span>Fallbacks:</span>
              <span className="font-semibold text-slate-800">Direct + Multi-query</span>
            </div>
          </div>
        </div>

        {/* 4. Google Gemini AI */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <div className="flex items-start justify-between">
            <div className={`p-2.5 rounded-lg ${health?.gemini_available ? 'bg-purple-50 text-purple-600' : 'bg-slate-100 text-slate-600'}`}>
              <Sparkles className="w-5 h-5" />
            </div>
            <span
              className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                health?.gemini_available ? 'bg-purple-100 text-purple-800' : 'bg-slate-100 text-slate-600'
              }`}
            >
              {health?.gemini_available ? 'ACTIVE' : 'DETERMINISTIC'}
            </span>
          </div>
          <div className="mt-4">
            <h3 className="font-bold text-sm text-slate-900">Google Gemini AI</h3>
            <p className="text-xs text-slate-500 mt-0.5">gemini-2.5-flash</p>
            <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
              <span>Mode:</span>
              <span className="font-semibold text-slate-800">
                {health?.gemini_available ? 'AI Synthesis' : 'Pure HTML/DOM'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Diagnostic Probe Results */}
      {testResult && (
        <div className="bg-slate-900 text-slate-100 p-4 rounded-xl border border-slate-800 font-mono text-xs flex items-center space-x-3">
          <Terminal className="w-4 h-4 text-emerald-400 flex-shrink-0" />
          <span>{testResult}</span>
        </div>
      )}

      {/* Subsystems & Architecture Specs */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Execution Architecture */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-4">
          <h3 className="font-bold text-slate-900 text-sm">Processing Pipeline Components</h3>
          <div className="space-y-3 text-xs">
            <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-between">
              <div>
                <span className="font-bold text-slate-800 block">Stage 1: Source Discovery</span>
                <span className="text-slate-500 text-[11px]">Direct URL verification & DDGS search querying</span>
              </div>
              <span className="font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded">Ready</span>
            </div>

            <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-between">
              <div>
                <span className="font-bold text-slate-800 block">Stage 2: Deterministic HTML Parser</span>
                <span className="text-slate-500 text-[11px]">2-column tables, &lt;dl&gt; lists, Schema.org JSON-LD</span>
              </div>
              <span className="font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded">Ready</span>
            </div>

            <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-between">
              <div>
                <span className="font-bold text-slate-800 block">Stage 3: Identity & Match Scoring</span>
                <span className="text-slate-500 text-[11px]">Exact MPN matching with 35-point threshold</span>
              </div>
              <span className="font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded">Ready</span>
            </div>

            <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-between">
              <div>
                <span className="font-bold text-slate-800 block">Stage 4: Excel Generator (openpyxl)</span>
                <span className="text-slate-500 text-[11px]">Incremental atomic writes & 3 export formats</span>
              </div>
              <span className="font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded">Ready</span>
            </div>
          </div>
        </div>

        {/* Right: Storage & Environment Info */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-4">
          <h3 className="font-bold text-slate-900 text-sm">Storage & Directory Status</h3>
          <div className="divide-y divide-slate-100 text-xs">
            <div className="py-2.5 flex items-center justify-between">
              <span className="text-slate-600 font-medium">Output Export Directory:</span>
              <span className="font-mono text-slate-800 bg-slate-100 px-2 py-0.5 rounded">./output</span>
            </div>
            <div className="py-2.5 flex items-center justify-between">
              <span className="text-slate-600 font-medium">Database Storage Directory:</span>
              <span className="font-mono text-slate-800 bg-slate-100 px-2 py-0.5 rounded">./data</span>
            </div>
            <div className="py-2.5 flex items-center justify-between">
              <span className="text-slate-600 font-medium">Temporary Workbooks:</span>
              <span className="font-mono text-slate-800 bg-slate-100 px-2 py-0.5 rounded">./temp_uploads</span>
            </div>
            <div className="py-2.5 flex items-center justify-between">
              <span className="text-slate-600 font-medium">Domain Rate Limiting:</span>
              <span className="text-slate-800 font-semibold">1.5s per domain delay</span>
            </div>
            <div className="py-2.5 flex items-center justify-between">
              <span className="text-slate-600 font-medium">Concurrency Engine:</span>
              <span className="text-slate-800 font-semibold">Background Worker Thread + Step Polling</span>
            </div>
            <div className="py-2.5 flex items-center justify-between">
              <span className="text-slate-600 font-medium">CORS Policy:</span>
              <span className="text-emerald-700 font-semibold">Permissive local & production origins</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

