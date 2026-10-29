import React from 'react';
import {
  LayoutDashboard,
  UploadCloud,
  Table2,
  History,
  Settings,
  Activity,
  HelpCircle,
  RefreshCw,
  Sparkles,
  Bot,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';
import { HealthStatus } from '../types';

export interface NavItem {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
}

interface SidebarProps {
  currentPage: string;
  onNavigate: (page: string) => void;
  health: HealthStatus | null;
  onRefreshHealth: () => void;
}

export const NAV_ITEMS: NavItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'upload', label: 'Upload & Process', icon: UploadCloud },
  { id: 'results', label: 'Results', icon: Table2 },
  { id: 'history', label: 'Processing History', icon: History },
  { id: 'settings', label: 'Settings', icon: Settings },
  { id: 'status', label: 'Backend Status', icon: Activity },
  { id: 'help', label: 'Help & Support', icon: HelpCircle },
];

export const Sidebar: React.FC<SidebarProps> = ({
  currentPage,
  onNavigate,
  health,
  onRefreshHealth,
}) => {
  const isHealthy = health?.status === 'healthy';

  return (
    <aside className="w-64 bg-slate-900 border-r border-slate-800 text-white flex flex-col shrink-0 min-h-screen">
      {/* Brand Header */}
      <div className="p-5 border-b border-slate-800/80 flex items-center justify-between">
        <div
          onClick={() => onNavigate('dashboard')}
          className="flex items-center space-x-3 cursor-pointer group"
        >
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center shadow-lg shadow-blue-500/20 group-hover:scale-105 transition-transform">
            <Bot className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="font-bold text-base tracking-tight text-white flex items-center space-x-1.5">
              <span>Data Scraper</span>
              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-400 border border-blue-500/30">
                v2.1
              </span>
            </div>
            <p className="text-[11px] text-slate-400 font-medium">Product Research AI</p>
          </div>
        </div>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        <div className="px-3 pb-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">
          Navigation
        </div>
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = currentPage === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-lg text-xs font-semibold transition-all ${
                isActive
                  ? 'bg-blue-600 text-white shadow-sm shadow-blue-600/30 font-bold'
                  : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
              }`}
            >
              <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-400'}`} />
              <span className="truncate">{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* System Status Pill Footer */}
      <div className="p-4 border-t border-slate-800/80 bg-slate-950/40 space-y-3">
        <div className="flex items-center justify-between text-xs">
          <span className="text-[11px] font-medium text-slate-400">System Health</span>
          <button
            onClick={onRefreshHealth}
            title="Refresh backend status"
            className="p-1 text-slate-400 hover:text-white hover:bg-slate-800 rounded transition"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="p-2.5 rounded-lg bg-slate-800/70 border border-slate-700/50 space-y-1.5 text-[11px]">
          <div className="flex items-center justify-between">
            <span className="text-slate-400">FastAPI Backend:</span>
            <span className={`font-semibold flex items-center space-x-1 ${isHealthy ? 'text-emerald-400' : 'text-amber-400'}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${isHealthy ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
              <span>{isHealthy ? 'Online' : 'Offline'}</span>
            </span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-slate-400">Gemini AI:</span>
            <span className={`font-semibold flex items-center space-x-1 ${health?.gemini_available ? 'text-emerald-400' : 'text-slate-400'}`}>
              <Sparkles className="w-3 h-3" />
              <span>{health?.gemini_available ? 'Active' : 'Deterministic'}</span>
            </span>
          </div>
        </div>
      </div>
    </aside>
  );
};

