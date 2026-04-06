import { useRef, useState, useEffect } from 'react';
import { useAppStore, type EventLimitPreference } from '../../stores/app-store';
import { useWebSocket } from '../../hooks/useWebSocket';
import { FilterBar } from '../shared/FilterBar';
import { EventRow } from '../shared/EventRow';
import { Loader2, ChevronDown, RefreshCw } from 'lucide-react';

// ============================================================================
// Sub-components
// ============================================================================

function EventCountDisplay({ showing, total }: { showing: number; total: number }) {
  if (total === 0) return null;
  return (
    <span className="text-[11px] text-text-secondary">
      {showing.toLocaleString()} / {total.toLocaleString()} events
    </span>
  );
}

function LoadMoreOptions({
  currentLimit,
  onChange,
  disabled,
}: {
  currentLimit: EventLimitPreference;
  onChange: (limit: EventLimitPreference) => void;
  disabled?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const options: { value: EventLimitPreference; label: string }[] = [
    { value: 50, label: '50' },
    { value: 100, label: '100' },
    { value: 200, label: '200' },
    { value: 500, label: '500' },
    { value: 'all', label: 'All' },
  ];

  return (
    <div ref={containerRef} className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        disabled={disabled}
        className="flex items-center gap-1 px-2 py-1 text-[11px] text-text-secondary hover:text-text-primary transition-colors border border-border rounded disabled:opacity-50"
        title="Events per page"
      >
        <span>{options.find(o => o.value === currentLimit)?.label}</span>
        <ChevronDown size={12} />
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-1 bg-bg-surface border border-border rounded shadow-lg z-50 min-w-[80px]">
          {options.map((option) => (
            <button
              key={String(option.value)}
              onClick={() => {
                onChange(option.value);
                setIsOpen(false);
              }}
              className={`w-full px-3 py-1.5 text-left text-[11px] hover:bg-bg-primary transition-colors first:rounded-t last:rounded-b ${
                currentLimit === option.value ? 'text-accent-cyan' : 'text-text-secondary'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function LoadMoreSection({
  hasMore,
  isLoading,
  onLoadMore,
  showing,
  total,
}: {
  hasMore: boolean;
  isLoading: boolean;
  onLoadMore: () => void;
  showing: number;
  total: number;
}) {
  if (isLoading) {
    return (
      <div className="py-4 flex items-center justify-center text-text-secondary border-t border-border">
        <Loader2 size={16} className="animate-spin mr-2" />
        <span className="text-xs">Loading more...</span>
      </div>
    );
  }

  if (hasMore) {
    return (
      <div className="py-4 flex flex-col items-center gap-2 border-t border-border">
        <button
          onClick={onLoadMore}
          className="flex items-center gap-2 px-4 py-2 bg-bg-surface border border-border rounded text-xs text-text-secondary hover:text-text-primary hover:border-text-secondary transition-colors"
        >
          <RefreshCw size={14} />
          Load More
        </button>
        <span className="text-[10px] text-text-muted">
          {showing.toLocaleString()} of {total.toLocaleString()} loaded
        </span>
      </div>
    );
  }

  if (total > 0) {
    return (
      <div className="py-4 text-center border-t border-border">
        <span className="text-xs text-text-secondary">
          All {total.toLocaleString()} events loaded
        </span>
      </div>
    );
  }

  return null;
}

export function EventStream() {
  const scrollRef = useRef<HTMLDivElement>(null);
  const selectedSessionId = useAppStore((state) => state.selectedSessionId);
  const filteredEvents = useAppStore((state) => state.getFilteredEvents());
  const hasMore = useAppStore((state) => state.hasMore);
  const isLoading = useAppStore((state) => state.isLoadingEvents);
  const loadMore = useAppStore((state) => state.loadMore);
  const selectedEventId = useAppStore((state) => state.selectedEventId);
  const selectEvent = useAppStore((state) => state.selectEvent);
  const isConnected = useAppStore((state) => state.isConnected);
  const eventPagination = useAppStore((state) => state.eventPagination);
  const eventLimitPreference = useAppStore((state) => state.eventLimitPreference);
  const setEventLimitPreference = useAppStore((state) => state.setEventLimitPreference);

  // Connect WebSocket for real-time events
  useWebSocket(selectedSessionId);

  const handleScroll = () => {
    if (!scrollRef.current || !hasMore || isLoading) return;

    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
    if (scrollHeight - scrollTop - clientHeight < 100) {
      loadMore();
    }
  };

  return (
    <div className="h-full flex flex-col bg-bg-primary">
      {/* Panel Header - 40px height */}
      <div className="px-4 py-3 bg-bg-surface border-b border-border flex items-center justify-between h-[40px] shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-[11px] uppercase tracking-wider text-text-secondary">
            Event Stream
          </span>
          {/* Connection status indicator */}
          <span
            className={`w-2 h-2 rounded-full ${isConnected ? 'bg-accent-green' : 'bg-accent-red'}`}
            title={isConnected ? 'WebSocket connected' : 'WebSocket disconnected'}
          />
        </div>
        <div className="flex items-center gap-3">
          <EventCountDisplay
            showing={filteredEvents.length}
            total={eventPagination.total}
          />
          <LoadMoreOptions
            currentLimit={eventLimitPreference}
            onChange={setEventLimitPreference}
            disabled={isLoading}
          />
        </div>
      </div>

      {/* Filter Bar */}
      <FilterBar />

      {/* Event List */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto"
      >
        {filteredEvents.length === 0 ? (
          <div className="h-full flex items-center justify-center text-text-secondary text-sm p-8 text-center">
            {selectedSessionId
              ? 'No events match your filters'
              : 'Select a session from the panel on the left to view events'}
          </div>
        ) : (
          <>
            {filteredEvents.map((event) => (
              <EventRow
                key={event.id}
                event={event}
                isSelected={event.id === selectedEventId}
                onClick={() => selectEvent(event.id)}
              />
            ))}

            <LoadMoreSection
              hasMore={hasMore}
              isLoading={isLoading}
              onLoadMore={loadMore}
              showing={filteredEvents.length}
              total={eventPagination.total}
            />
          </>
        )}
      </div>
    </div>
  );
}