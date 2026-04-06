import { useState } from 'react';
import { Header } from './Header';
import { StatsBar } from './StatsBar';
import { Dashboard } from '../pages/Dashboard';
import { SessionsPage } from '../pages/SessionsPage';
import { ToolsPage } from '../pages/ToolsPage';
import { AgentsPage } from '../pages/AgentsPage';
import { LogsPage } from '../pages/LogsPage';

export type ViewType = 'dashboard' | 'sessions' | 'tools' | 'agents' | 'logs';

export function RootLayout() {
  const [currentView, setCurrentView] = useState<ViewType>('dashboard');

  const renderContent = () => {
    switch (currentView) {
      case 'dashboard':
        return <Dashboard />;
      case 'sessions':
        return <SessionsPage />;
      case 'tools':
        return <ToolsPage />;
      case 'agents':
        return <AgentsPage />;
      case 'logs':
        return <LogsPage />;
      default:
        return <Dashboard />;
    }
  };

  return (
    <div className="h-screen flex flex-col bg-bg-primary text-text-primary font-mono overflow-hidden">
      <Header currentView={currentView} onViewChange={setCurrentView} />
      {/* <StatsBar /> */}
      <main className="flex-1 overflow-hidden">
        {renderContent()}
      </main>
    </div>
  );
}