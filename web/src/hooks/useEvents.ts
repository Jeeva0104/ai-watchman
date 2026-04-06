import { useCallback, useEffect } from 'react';
import { useAppStore } from '../stores/app-store';

interface UseEventsOptions {
  autoFetch?: boolean;
}

export function useEvents(options: UseEventsOptions = {}) {
  const { autoFetch = true } = options;

  // Select state from store
  const activeSessions = useAppStore((state) => state.activeSessions);
  const closedSessions = useAppStore((state) => state.closedSessions);
  const selectedSessionId = useAppStore((state) => state.selectedSessionId);
  const events = useAppStore((state) => state.events);
  const hasMore = useAppStore((state) => state.hasMore);
  const eventFilters = useAppStore((state) => state.eventFilters);
  const selectedEventId = useAppStore((state) => state.selectedEventId);
  const isConnected = useAppStore((state) => state.isConnected);
  const isLoadingActiveSessions = useAppStore((state) => state.isLoadingActiveSessions);
  const isLoadingClosedSessions = useAppStore((state) => state.isLoadingClosedSessions);
  const isLoadingEvents = useAppStore((state) => state.isLoadingEvents);
  const error = useAppStore((state) => state.error);

  // Combine sessions for backward compatibility
  const sessions = [...activeSessions, ...closedSessions];
  const isLoadingSessions = isLoadingActiveSessions || isLoadingClosedSessions;

  // Select actions from store
  const fetchSessions = useAppStore((state) => state.fetchSessions);
  const selectSession = useAppStore((state) => state.selectSession);
  const fetchEvents = useAppStore((state) => state.fetchEvents);
  const loadMore = useAppStore((state) => state.loadMore);
  const setFilters = useAppStore((state) => state.setFilters);
  const getFilteredEvents = useAppStore((state) => state.getFilteredEvents);
  const selectEvent = useAppStore((state) => state.selectEvent);
  const clearError = useAppStore((state) => state.clearError);

  // Get filtered events
  const filteredEvents = getFilteredEvents();

  // Get selected session
  const selectedSession = sessions.find((s: { id: string }) => s.id === selectedSessionId) || null;

  // Get selected event
  const selectedEvent = events.find((e) => e.id === selectedEventId) || null;

  // Auto-fetch sessions on mount
  useEffect(() => {
    if (autoFetch) {
      fetchSessions();
    }
  }, [autoFetch, fetchSessions]);

  // Handle session selection
  const handleSelectSession = useCallback(
    async (sessionId: string | null) => {
      await selectSession(sessionId);
    },
    [selectSession]
  );

  // Handle loading more events
  const handleLoadMore = useCallback(async () => {
    await loadMore();
  }, [loadMore]);

  // Handle filter changes
  const handleSetFilters = useCallback(
    (filters: Parameters<typeof setFilters>[0]) => {
      setFilters(filters);
    },
    [setFilters]
  );

  // Handle event selection
  const handleSelectEvent = useCallback(
    (eventId: string | null) => {
      selectEvent(eventId);
    },
    [selectEvent]
  );

  // Handle error clearing
  const handleClearError = useCallback(() => {
    clearError();
  }, [clearError]);

  // Refresh sessions
  const refreshSessions = useCallback(async () => {
    await fetchSessions();
  }, [fetchSessions]);

  // Refresh events for current session
  const refreshEvents = useCallback(async () => {
    if (selectedSessionId) {
      await fetchEvents(selectedSessionId, true);
    }
  }, [selectedSessionId, fetchEvents]);

  return {
    // State
    sessions,
    selectedSession,
    selectedSessionId,
    events,
    filteredEvents,
    hasMore,
    eventFilters,
    selectedEvent,
    selectedEventId,
    isConnected,
    isLoadingSessions,
    isLoadingEvents,
    error,

    // Actions
    selectSession: handleSelectSession,
    loadMore: handleLoadMore,
    setFilters: handleSetFilters,
    selectEvent: handleSelectEvent,
    clearError: handleClearError,
    refreshSessions,
    refreshEvents,
  };
}
