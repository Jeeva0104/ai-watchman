import { useEffect } from 'react';
import { useAppStore } from '../../stores/app-store';

export function StatsBar() {
  const stats = useAppStore((state) => state.stats);
  const sessionStats = useAppStore((state) => state.sessionStats);
  const selectedSessionId = useAppStore((state) => state.selectedSessionId);
  const fetchStats = useAppStore((state) => state.fetchStats);
  const fetchSessionStats = useAppStore((state) => state.fetchSessionStats);

  // Fetch global stats on mount and periodically
  useEffect(() => {
    fetchStats();
    const interval = setInterval(fetchStats, 5000);
    return () => clearInterval(interval);
  }, [fetchStats]);

  // Fetch session stats when a session is selected
  useEffect(() => {
    if (selectedSessionId) {
      fetchSessionStats(selectedSessionId);
    }
  }, [selectedSessionId, fetchSessionStats]);

  // Determine if we're showing session stats or global stats
  const isSessionView = !!selectedSessionId && !!sessionStats;

  return (
    <div className="grid grid-cols-4 gap-px bg-border border-b border-border shrink-0 h-[60px]">
      {/* Stat 1: Events/Total Events - Cyan */}
      <div className="bg-bg-primary px-5 py-3 flex flex-col justify-center">
        <div className="text-2xl font-bold text-accent-cyan text-glow-cyan">
          {isSessionView
            ? (sessionStats?.totalEvents ?? 0).toLocaleString()
            : (stats?.eventsToday ?? 0).toLocaleString()}
        </div>
        <div className="text-[10px] uppercase tracking-wider text-text-secondary mt-0.5">
          {isSessionView ? 'Events' : 'Total Events'}
        </div>
      </div>

      {/* Stat 2: Agents/Total Agents - Green */}
      <div className="bg-bg-primary px-5 py-3 flex flex-col justify-center">
        <div className="text-2xl font-bold text-accent-green">
          {isSessionView
            ? (sessionStats?.agentCount ?? 0).toLocaleString()
            : (stats?.totalAgents ?? 0).toLocaleString()}
        </div>
        <div className="text-[10px] uppercase tracking-wider text-text-secondary mt-0.5">
          {isSessionView ? 'Agents' : 'Total Agents'}
        </div>
      </div>



      {/* Stat 3: Errors - Red */}
      <div className="bg-bg-primary px-5 py-3 flex flex-col justify-center">
        <div className="text-2xl font-bold text-accent-red">
          {isSessionView
            ? (sessionStats?.errorCount ?? 0).toLocaleString()
            : (stats?.totalErrors ?? 0).toLocaleString()}
        </div>
        <div className="text-[10px] uppercase tracking-wider text-text-secondary mt-0.5">
          Errors
        </div>
      </div>
    </div>
  );
}
