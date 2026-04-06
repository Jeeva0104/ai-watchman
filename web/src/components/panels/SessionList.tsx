import { useEffect, useState, useMemo, useRef } from 'react';
import { useAppStore } from '../../stores/app-store';
import type { Session } from '../../types';
import { Loader2, ChevronDown, Play, Square, ArrowUp, ArrowDown, Folder, Search, X } from 'lucide-react';

// Helper to format relative time
function formatRelativeTime(timestamp: string): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSecs < 60) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

// Helper to format absolute time for tooltip
function formatAbsoluteTime(timestamp: string): string {
  return new Date(timestamp).toLocaleString();
}

// Helper to shorten path (replace home directory with ~)
function shortenPath(path: string): string {
  // Replace /home/username or /Users/username with ~
  return path.replace(/^\/(?:Users|home)\/[^/]+/, '~');
}

// Helper to get workspace from session metadata
function getWorkspace(session: Session): string | null {
  const cwd = session.metadata?.cwd as string | undefined;
  return cwd ? shortenPath(cwd) : null;
}

// Sort sessions by timestamp
function sortSessions(sessions: Session[], order: 'asc' | 'desc', field: 'startedAt' | 'stoppedAt'): Session[] {
  return [...sessions].sort((a, b) => {
    const aTime = new Date(a[field] || 0).getTime();
    const bTime = new Date(b[field] || 0).getTime();
    return order === 'asc' ? aTime - bTime : bTime - aTime;
  });
}

// Session item subcomponent
interface SessionItemProps {
  session: Session;
  isSelected: boolean;
  onClick: () => void;
  showEndedAt?: boolean;
}

function SessionItem({ session, isSelected, onClick, showEndedAt }: SessionItemProps) {
  const isRunning = session.status === 'running';
  const workspace = getWorkspace(session);
  const timestamp = showEndedAt && session.stoppedAt 
    ? session.stoppedAt 
    : session.startedAt;
  const timeLabel = showEndedAt && session.stoppedAt ? 'Ended' : 'Started';

  return (
    <button
      onClick={onClick}
      className={`w-full text-left p-3 rounded border transition-all cursor-pointer ${
        isSelected
          ? 'bg-bg-surface border-accent-cyan shadow-[0_0_0_1px_#00f0ff,inset_0_0_20px_rgba(0,240,255,0.05)]'
          : 'bg-bg-surface border-border hover:border-accent-cyan/50'
      }`}
    >
      {/* Row 1: Session ID - cyan, truncated + Status badge */}
      <div className="flex items-center justify-between mb-1">
        <span className="font-mono text-[11px] text-accent-cyan">
          {session.id.slice(0, 8)}..{session.id.slice(-4)}
        </span>
        {isRunning ? (
          <span className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-accent-green/10 text-accent-green text-[10px] font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-accent-green animate-pulse" />
            LIVE
          </span>
        ) : showEndedAt && session.stoppedAt ? (
          <span 
            className="text-[10px] text-text-secondary"
            title={formatAbsoluteTime(session.stoppedAt)}
          >
            Ended {formatRelativeTime(session.stoppedAt)}
          </span>
        ) : (
          <span className="text-[10px] text-text-secondary">Stopped</span>
        )}
      </div>

      {/* Row 2: Agent count + Workspace + Timestamp */}
      <div className="flex items-center gap-2 text-[10px] text-text-secondary">
        {/* Agent count */}
        {/* <span className="text-text-primary font-medium min-w-[16px]">
          {session.agentCount ?? 0}
        </span> */}
        
        {/* Workspace path */}
        {workspace && (
          <span className="flex items-center gap-1 truncate flex-1 min-w-0">
            <Folder className="h-3 w-3 shrink-0 opacity-60" />
            <span className="truncate">{workspace}</span>
          </span>
        )}
        
        {/* Timestamp - right aligned */}
        {!showEndedAt && (
          <span 
            className="ml-auto shrink-0"
            title={formatAbsoluteTime(timestamp)}
          >
            {timeLabel} {formatRelativeTime(timestamp)}
          </span>
        )}
      </div>
    </button>
  );
}

// Section header component
interface SectionHeaderProps {
  title: string;
  count: number;
  icon: 'play' | 'square';
  sortOrder: 'asc' | 'desc';
  onSortToggle: () => void;
  isActive?: boolean;
}

function SectionHeader({ title, count, icon, sortOrder, onSortToggle, isActive }: SectionHeaderProps) {
  const Icon = icon === 'play' ? Play : Square;
  
  return (
    <div 
      className={`flex items-center justify-between px-2 py-2.5 mb-4 rounded ${
        isActive 
          ? 'bg-accent-green/5 border-l-2 border-accent-green' 
          : 'bg-bg-surface border-l-2 border-border'
      }`}
    >
      <div className="flex items-center gap-2">
        <Icon className={`h-3.5 w-3.5 ${isActive ? 'text-accent-green' : 'text-text-secondary'}`} />
        <span className={`text-[11px] uppercase tracking-wider font-semibold ${
          isActive ? 'text-accent-green' : 'text-text-secondary'
        }`}>
          {title}
        </span>
      </div>
      
      <div className="flex items-center gap-2">
        <span className={`text-[11px] ${isActive ? 'text-accent-cyan' : 'text-text-secondary'}`}>
          {count}
        </span>
        
        {/* Sort toggle button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onSortToggle();
          }}
          className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] text-text-secondary hover:text-text-primary hover:bg-accent-cyan/10 transition-colors cursor-pointer"
          title={sortOrder === 'desc' ? 'Newest first' : 'Oldest first'}
        >
          {sortOrder === 'desc' ? (
            <ArrowDown className="h-3 w-3" />
          ) : (
            <ArrowUp className="h-3 w-3" />
          )}
        </button>
      </div>
    </div>
  );
}

export function SessionList() {
  const activeSessions = useAppStore((state) => state.activeSessions);
  const closedSessions = useAppStore((state) => state.closedSessions);
  const closedSessionsPagination = useAppStore((state) => state.closedSessionsPagination);
  const selectedSessionId = useAppStore((state) => state.selectedSessionId);
  const isLoadingActive = useAppStore((state) => state.isLoadingActiveSessions);
  const isLoadingClosed = useAppStore((state) => state.isLoadingClosedSessions);
  const isLoadingMore = useAppStore((state) => state.isLoadingMoreClosedSessions);
  const sessionSearch = useAppStore((state) => state.sessionSearch);
  const fetchSessions = useAppStore((state) => state.fetchSessions);
  const loadMoreClosedSessions = useAppStore((state) => state.loadMoreClosedSessions);
  const selectSession = useAppStore((state) => state.selectSession);
  const setSessionSearch = useAppStore((state) => state.setSessionSearch);

  // Local search state for immediate UI feedback
  const [localSearch, setLocalSearch] = useState(sessionSearch);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounce search input (300ms)
  useEffect(() => {
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }

    debounceTimer.current = setTimeout(() => {
      if (localSearch !== sessionSearch) {
        setSessionSearch(localSearch);
      }
    }, 300);

    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
    };
  }, [localSearch, sessionSearch, setSessionSearch]);

  // Sort order state for each section
  const [activeSortOrder, setActiveSortOrder] = useState<'asc' | 'desc'>('desc');
  const [closedSortOrder, setClosedSortOrder] = useState<'asc' | 'desc'>('desc');

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  // Sort sessions
  const sortedActiveSessions = useMemo(() => {
    return sortSessions(activeSessions, activeSortOrder, 'startedAt');
  }, [activeSessions, activeSortOrder]);

  const sortedClosedSessions = useMemo(() => {
    return sortSessions(closedSessions, closedSortOrder, 'stoppedAt');
  }, [closedSessions, closedSortOrder]);

  const totalSessions = activeSessions.length + closedSessionsPagination.total;

  const isLoading = isLoadingActive || isLoadingClosed;

  return (
    <div className="h-full flex flex-col bg-bg-primary">
      {/* Panel Header - 40px height */}
      <div className="px-4 py-3 bg-bg-surface border-b border-border flex items-center justify-between h-[40px] shrink-0">
        <span className="text-[11px] uppercase tracking-wider text-text-secondary">
          Sessions
        </span>
        <div className="flex items-center gap-2">
          {/* Search Input */}
          <div className="flex items-center gap-1.5 bg-bg-primary border border-border rounded px-2 py-1.5 focus-within:border-accent-cyan transition-colors">
            <Search size={10} className="text-text-secondary" />
            <input
              type="text"
              value={localSearch}
              onChange={(e) => setLocalSearch(e.target.value)}
              placeholder="Search ID..."
              className="bg-transparent border-none text-[10px] text-text-primary placeholder:text-text-secondary outline-none w-24"
            />
            {localSearch && (
              <button
                onClick={() => setLocalSearch('')}
                className="text-text-secondary hover:text-text-primary transition-colors"
              >
                <X size={10} />
              </button>
            )}
          </div>
          <span className="text-[11px] text-accent-cyan">
            {totalSessions}
          </span>
        </div>
      </div>

      {/* Session List */}
      <div className="flex-1 overflow-y-auto p-2">
        {isLoading ? (
          <div className="flex items-center justify-center py-8 text-text-secondary">
            <Loader2 size={16} className="animate-spin mr-2" />
            <span className="text-xs">Loading sessions...</span>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Active Section */}
            <div className="px-4">
              {/* Active Header */}
              <SectionHeader
                title="Active"
                count={activeSessions.length}
                icon="play"
                sortOrder={activeSortOrder}
                onSortToggle={() => setActiveSortOrder(prev => prev === 'desc' ? 'asc' : 'desc')}
                isActive={true}
              />

              {/* Active Sessions */}
              {sortedActiveSessions.length === 0 ? (
                <div className="text-center py-4 text-text-secondary text-xs">
                  {localSearch ? `No active sessions match "${localSearch}"` : 'No active sessions'}
                </div>
              ) : (
                <div className="space-y-2">
                  {sortedActiveSessions.map((session) => (
                    <SessionItem
                      key={session.id}
                      session={session}
                      isSelected={selectedSessionId === session.id}
                      onClick={() => selectSession(session.id)}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Divider - only show if there are closed sessions */}
            {sortedClosedSessions.length > 0 && (
              <div className="border-t border-border my-2" />
            )}

            {/* Closed Section */}
            <div className="px-4">
              {/* Closed Header */}
              <SectionHeader
                title="Closed"
                count={closedSessionsPagination.total}
                icon="square"
                sortOrder={closedSortOrder}
                onSortToggle={() => setClosedSortOrder(prev => prev === 'desc' ? 'asc' : 'desc')}
                isActive={false}
              />

              {/* Closed Sessions */}
              {sortedClosedSessions.length === 0 ? (
                <div className="text-center py-4 text-text-secondary text-xs">
                  {localSearch ? `No closed sessions match "${localSearch}"` : 'No closed sessions'}
                </div>
              ) : (
                <div className="space-y-2">
                  {sortedClosedSessions.map((session) => (
                    <SessionItem
                      key={session.id}
                      session={session}
                      isSelected={selectedSessionId === session.id}
                      onClick={() => selectSession(session.id)}
                      showEndedAt
                    />
                  ))}

                  {/* View More Button */}
                  {closedSessionsPagination.hasMore && (
                    <button
                      onClick={() => loadMoreClosedSessions()}
                      disabled={isLoadingMore}
                      className="w-full py-2 px-4 mt-2 text-[10px] uppercase tracking-wider text-text-secondary hover:text-text-primary border border-border hover:border-accent-cyan/50 rounded transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      {isLoadingMore ? (
                        <>
                          <Loader2 size={12} className="animate-spin" />
                          Loading...
                        </>
                      ) : (
                        <>
                          View More
                          <ChevronDown size={12} />
                        </>
                      )}
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}