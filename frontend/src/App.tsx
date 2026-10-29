import React, { useState, useEffect } from 'react';
import { Navbar } from './components/Navbar';
import { DashboardPage } from './pages/DashboardPage';
import { UploadPage } from './pages/UploadPage';
import { JobsPage } from './pages/JobsPage';
import { ResultsPage } from './pages/ResultsPage';
import { SettingsPage } from './pages/SettingsPage';
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
    setCurrentPage('jobs');
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900">
      <Navbar
        currentPage={currentPage}
        onNavigate={setCurrentPage}
        health={health}
        onRefreshHealth={fetchHealth}
      />

      <main className="flex-1 pb-16">
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
        {currentPage === 'jobs' && (
          <JobsPage
            selectedJobId={selectedJobId}
            onSelectJob={setSelectedJobId}
            onNavigate={setCurrentPage}
          />
        )}
        {currentPage === 'results' && (
          <ResultsPage
            selectedJobId={selectedJobId}
            onSelectJob={setSelectedJobId}
          />
        )}
        {currentPage === 'settings' && (
          <SettingsPage health={health} />
        )}
      </main>
    </div>
  );
};

export default App;

