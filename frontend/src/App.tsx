import React, { useState, useEffect } from 'react';
import { Sidebar } from './components/Sidebar';
import { DashboardPage } from './pages/DashboardPage';
import { UploadPage } from './pages/UploadPage';
import { ResultsPage } from './pages/ResultsPage';
import { HistoryPage } from './pages/HistoryPage';
import { SettingsPage } from './pages/SettingsPage';
import { BackendStatusPage } from './pages/BackendStatusPage';
import { HelpSupportPage } from './pages/HelpSupportPage';
import { HealthStatus } from './types';
import { api } from './services/api';

export const App: React.FC = () => {
  const [currentPage, setCurrentPage] = useState<string>('dashboard');
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [health, setHealth] = useState<HealthStatus | null>(null);

  const fetchHealth = async () => {
    try {
      const data = await api.getHealth();
      setHealth(data);
    } catch {
      setHealth({
        status: 'error',
        gemini_available: false,
        search_available: false,
        database_connected: false,
        version: 'offline',
      });
    }
  };

  useEffect(() => {
    fetchHealth();
    const interval = setInterval(fetchHealth, 15000);
    return () => clearInterval(interval);
  }, []);

  const handleJobStarted = (jobId: string) => {
    setSelectedJobId(jobId);
    setCurrentPage('dashboard');
  };

  return (
    <div className="min-h-screen flex bg-slate-50 text-slate-900">
      {/* Dark Navy Sidebar on Left */}
      <Sidebar
        currentPage={currentPage}
        onNavigate={setCurrentPage}
        health={health}
        onRefreshHealth={fetchHealth}
      />

      {/* Light Main Workspace on Right */}
      <main className="flex-1 min-w-0 overflow-y-auto min-h-screen pb-16">
        {currentPage === 'dashboard' && (
          <DashboardPage
            onNavigate={setCurrentPage}
            onSelectJob={setSelectedJobId}
          />
        )}

        {currentPage === 'upload' && (
          <UploadPage
            onJobStarted={handleJobStarted}
            geminiAvailable={health?.gemini_available || false}
          />
        )}

        {currentPage === 'results' && (
          <ResultsPage
            selectedJobId={selectedJobId}
            onSelectJob={setSelectedJobId}
          />
        )}

        {currentPage === 'history' && (
          <HistoryPage
            selectedJobId={selectedJobId}
            onSelectJob={setSelectedJobId}
            onNavigate={setCurrentPage}
          />
        )}

        {currentPage === 'settings' && (
          <SettingsPage
            health={health}
            onRefreshHealth={fetchHealth}
          />
        )}

        {currentPage === 'status' && (
          <BackendStatusPage
            health={health}
            onRefreshHealth={fetchHealth}
          />
        )}

        {currentPage === 'help' && (
          <HelpSupportPage />
        )}
      </main>
    </div>
  );
};

export default App;
