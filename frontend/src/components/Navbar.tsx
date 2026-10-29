import React from 'react';
import { Layers, Upload, ListFilter, Sliders, CheckCircle2, AlertCircle, RefreshCw } from 'lucide-react';
import { HealthStatus } from '../types';

interface NavbarProps {
  currentPage: string;
  onNavigate: (page: string) => void;
  health: HealthStatus | null;
  onRefreshHealth: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentPage,
  onNavigate,
  health,
  onRefreshHealth,
}) => {
  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: Layers },
    { id: 'upload', label: 'Upload & Process', icon: Upload },
    { id: 'jobs', label: 'Scrape Jobs', icon: ListFilter },
    { id: 'results', label: 'Results Explorer', icon: CheckCircle2 },
    { id: 'settings', label: 'Settings & Status', icon: Sliders },
  ];

  return (
    <header className="bg-slate-900 border-b border-slate-800 text-white sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Brand */}
          <div className="flex items-center space-x-3 cursor-pointer" onClick={() => onNavigate('dashboard')}>
            <div className="w-10 h-10 rounded-lg bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center shadow-lg shadow-blue-500/20">
              <Layers className="w-6 h-6 text-white" />
            </div>
            <div>
              <span className="font-bold text-lg tracking-tight bg-gradient-to-r from-white to-slate-300 bg-clip-text text-transparent">
                Product Scraper
              </span>
              <span className="ml-2 text-xs font-semibold px-2 py-0.5 rounded bg-blue-500/20 text-blue-400 border border-blue-500/30">
                v2.0
              </span>
            </div>
          </div>

          {/* Navigation links */}
          <nav className="hidden md:flex space-x-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = currentPage === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => onNavigate(item.id)}
                  className={`flex items-center space-x-2 px-3.5 py-2 rounded-md text-sm font-medium transition-all ${
                    isActive
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>

          {/* System status pill */}
          <div className="flex items-center space-x-3">
            <div
              className={`hidden sm:flex items-center space-x-2 px-3 py-1 rounded-full text-xs font-medium border ${
                health?.status === 'healthy'
                  ? 'bg-emerald-950/60 border-emerald-800/80 text-emerald-400'
                  : 'bg-amber-950/60 border-amber-800/80 text-amber-400'
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${health?.status === 'healthy' ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
              <span>FastAPI Backend</span>
              {health?.gemini_available ? (
                <span className="bg-emerald-800/40 text-emerald-300 px-1.5 py-0.2 rounded text-[10px]">Gemini Ready</span>
              ) : (
                <span className="bg-slate-800 text-slate-400 px-1.5 py-0.2 rounded text-[10px]">Deterministic</span>
              )}
            </div>

            <button
              onClick={onRefreshHealth}
              title="Refresh status"
              className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};

