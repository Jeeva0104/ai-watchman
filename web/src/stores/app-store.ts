import { create } from 'zustand';
import type {
  Session,
  WatchmanEvent,
  DashboardStats,
  SessionStats,
} from '../types';
import { api } from '../lib/api';
import {
  eventMatchesFilters,
  isErrorEvent,
  belongsToPrimary,
  getSecondaryClassification,
} from '../config/filters';

// ============================================================================
// Event Filters Interface
// ============================================================================

export interface EventFilters {
  primaryFilters: string[];      // Selected primary categories (System, Tool, etc.)
  secondaryFilters: string[];    // Selected secondary filters (Bash, Read, etc.)
  search: string;
}

// ============================================================================
// Event Pagination Types
// ============================================================================

export type EventLimitPreference = 50 | 100 | 200 | 500 | 'all';

export interface EventPagination {
  total: number;
  hasMore: boolean;
  offset: number;
  limit: number;
}

// ============================================================================
// Local Storage Helpers
// ============================================================================

const EVENT_LIMIT_STORAGE_KEY = 'ai-watchman:event-limit';

function loadEventLimitPreference(): EventLimitPreference {
  try {
    const stored = localStorage.getItem(EVENT_LIMIT_STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if ([50, 100, 200, 500, 'all'].includes(parsed)) {
        return parsed as EventLimitPreference;
      }
    }
  } catch {
    // Ignore localStorage errors
  }
  return 50;
}

function saveEventLimitPreference(limit: EventLimitPreference): void {
  try {
    localStorage.setItem(EVENT_LIMIT_STORAGE_KEY, JSON.stringify(limit));
  } catch {
    // Ignore localStorage errors
  }
}

// ============================================================================
// API Filter Parameter Builder
// ============================================================================

/**
 * Build API filter parameters from frontend filter state.
 * Maps primary/secondary filters to backend types/actions/tools parameters.
 *
 * Note: Agent primary filter requires hybrid matching that the backend doesn't support.
 * Agent-related events can have:
 *   - type = 'agent' (new records)
 *   - type = 'tool' AND tool = 'Agent' (Agent tool invocations)
 *   - type = 'system' AND action IN ('SubagentStart', 'agent.complete') (legacy records)
 *
 * Since backend uses AND logic between filter categories, we can't express this with
 * a single API call. Agent filtering is handled client-side via getFilteredEvents().
 */
function buildAPIFilterParams(filters: EventFilters): {
  types?: string[];
  actions?: string[];
  tools?: string[];
  errorsOnly?: boolean;
  skipServerFilter?: boolean; // Signal that client-side filtering should be used
} {
  const types: string[] = [];
  const actions: string[] = [];
  const tools: string[] = [];
  let skipServerFilter = false;

  // Map primary filters to API parameters
  for (const primary of filters.primaryFilters) {
    switch (primary) {
      case 'System':
        types.push('system');
        break;
      case 'Tool':
        types.push('tool');
        break;
      case 'Agent':
        // Agent filter needs hybrid OR-based matching across type/action/tool columns.
        // Backend only supports AND logic, so we skip server-side filtering and
        // handle it entirely client-side via isAgentRelatedEvent() in filters.ts.
        skipServerFilter = true;
        break;
      case 'User':
        types.push('user');
        break;
      case 'Session':
        types.push('session');
        break;
      case 'MCP':
        types.push('tool'); // MCP is tool type, filtered client-side for mcp__ prefix
        break;
      // Errors handled via errorsOnly flag below
    }
  }

  // Map secondary filters using primary context for correct classification
  // This fixes the issue where "SessionStart" was incorrectly classified as a tool
  for (const secondary of filters.secondaryFilters) {
    // Find the primary that this secondary belongs to
    // Use the first selected primary that can classify this secondary
    let classified = false;
    for (const primary of filters.primaryFilters) {
      const classification = getSecondaryClassification(primary, secondary);

      if (classification === 'tool') {
        tools.push(secondary);
        classified = true;
        break;
      } else if (classification === 'action') {
        actions.push(secondary);
        classified = true;
        break;
      }
      // 'type' classification means it's an event type (for Errors), already in types[]
      // from primary mapping, so we skip it
    }

    // Fallback for secondaries without a matching primary (shouldn't happen in normal flow)
    if (!classified && filters.primaryFilters.length === 0) {
      // Legacy heuristic as fallback
      if (/^[A-Z]/.test(secondary) || secondary.startsWith('mcp__')) {
        tools.push(secondary);
      } else {
        actions.push(secondary);
      }
    }
  }

  // Remove duplicates
  const uniqueTypes = [...new Set(types)];
  const uniqueActions = [...new Set(actions)];
  const uniqueTools = [...new Set(tools)];

  return {
    ...(uniqueTypes.length > 0 && !skipServerFilter && { types: uniqueTypes }),
    // Secondary filters are always returned for client-side filtering when skipServerFilter is true
    ...(uniqueActions.length > 0 && { actions: uniqueActions }),
    ...(uniqueTools.length > 0 && { tools: uniqueTools }),
    // Use backend errorsOnly parameter when Errors filter is active
    ...(filters.primaryFilters.includes('Errors') && { errorsOnly: true }),
    ...(skipServerFilter && { skipServerFilter }),
  };
}

// ============================================================================
// App State Interface
// ============================================================================

interface AppState {
  // Active sessions
  activeSessions: Session[];

  // Closed sessions
  closedSessions: Session[];
  closedSessionsPagination: {
    total: number;
    hasMore: boolean;
    offset: number;
    limit: number;
  };

  selectedSessionId: string | null;

  // Events
  allEvents: WatchmanEvent[];      // Unfiltered events for filter discovery
  events: WatchmanEvent[];         // Filtered events for display
  hasMore: boolean;
  eventFilters: EventFilters;
  selectedEventId: string | null;

  // Event pagination
  eventPagination: EventPagination;
  eventLimitPreference: EventLimitPreference;

  // Stats
  stats: DashboardStats | null;
  sessionStats: SessionStats | null;

  // Connection
  isConnected: boolean;

  // Pagination
  currentPage: number;
  eventsPerPage: number;

  // Loading states
  isLoadingActiveSessions: boolean;
  isLoadingClosedSessions: boolean;
  isLoadingMoreClosedSessions: boolean;
  isLoadingEvents: boolean;
  error: string | null;
}

interface AppActions {
  fetchSessions: () => Promise<void>;
  loadMoreClosedSessions: () => Promise<void>;
  selectSession: (id: string | null) => Promise<void>;
  fetchEvents: (sessionId: string, reset?: boolean) => Promise<void>;
  loadMore: () => Promise<void>;
  setFilters: (filters: Partial<EventFilters>) => void;
  getFilteredEvents: () => WatchmanEvent[];
  addRealtimeEvent: (event: WatchmanEvent) => void;
  selectEvent: (id: string | null) => void;
  setConnected: (status: boolean) => void;
  fetchStats: () => Promise<void>;
  fetchSessionStats: (sessionId: string) => Promise<void>;
  clearError: () => void;
  setEventLimitPreference: (limit: EventLimitPreference) => Promise<void>;
}

type AppStore = AppState & AppActions;

// ============================================================================
// Default State
// ============================================================================

const defaultFilters: EventFilters = {
  primaryFilters: [],
  secondaryFilters: [],
  search: '',
};

const initialState: AppState = {
  activeSessions: [],
  closedSessions: [],
  closedSessionsPagination: {
    total: 0,
    hasMore: false,
    offset: 0,
    limit: 5,
  },
  selectedSessionId: null,
  allEvents: [],
  events: [],
  hasMore: false,
  eventFilters: { ...defaultFilters },
  selectedEventId: null,
  eventPagination: {
    total: 0,
    hasMore: false,
    offset: 0,
    limit: 50,
  },
  eventLimitPreference: loadEventLimitPreference(),
  stats: null,
  sessionStats: null,
  isConnected: false,
  currentPage: 1,
  eventsPerPage: 50,
  isLoadingActiveSessions: false,
  isLoadingClosedSessions: false,
  isLoadingMoreClosedSessions: false,
  isLoadingEvents: false,
  error: null,
};

// ============================================================================
// App Store
// ============================================================================

export const useAppStore = create<AppStore>((set, get) => ({
  ...initialState,

  fetchSessions: async () => {
    set({
      isLoadingActiveSessions: true,
      isLoadingClosedSessions: true,
      error: null
    });

    try {
      // Fetch active and closed sessions in parallel
      const [activeResult, closedResult] = await Promise.all([
        api.fetchSessions({ status: 'active' }),
        api.fetchSessions({
          status: 'stopped',
          limit: 5,
          sortBy: 'stoppedAt',
          sortOrder: 'desc'
        }),
      ]);

      set({
        activeSessions: activeResult.sessions,
        closedSessions: closedResult.sessions,
        closedSessionsPagination: {
          total: closedResult.pagination.total,
          hasMore: closedResult.pagination.hasMore,
          offset: closedResult.sessions.length,
          limit: 5,
        },
        isLoadingActiveSessions: false,
        isLoadingClosedSessions: false,
      });

      // Auto-select first active session if none selected
      const { selectedSessionId } = get();
      if (activeResult.sessions.length > 0 && !selectedSessionId) {
        get().selectSession(activeResult.sessions[0].id);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch sessions';
      set({
        error: errorMessage,
        isLoadingActiveSessions: false,
        isLoadingClosedSessions: false,
      });
    }
  },

  loadMoreClosedSessions: async () => {
    const { closedSessionsPagination, isLoadingMoreClosedSessions } = get();

    if (isLoadingMoreClosedSessions || !closedSessionsPagination.hasMore) {
      return;
    }

    set({ isLoadingMoreClosedSessions: true, error: null });

    try {
      const result = await api.fetchSessions({
        status: 'stopped',
        limit: 10,
        offset: closedSessionsPagination.offset,
        sortBy: 'stoppedAt',
        sortOrder: 'desc',
      });

      set((state) => ({
        closedSessions: [...state.closedSessions, ...result.sessions],
        closedSessionsPagination: {
          total: result.pagination.total,
          hasMore: result.pagination.hasMore,
          offset: state.closedSessionsPagination.offset + result.sessions.length,
          limit: 10,
        },
        isLoadingMoreClosedSessions: false,
      }));
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load more sessions';
      set({ error: errorMessage, isLoadingMoreClosedSessions: false });
    }
  },

  selectSession: async (id: string | null) => {
    set({ selectedSessionId: id, selectedEventId: null, sessionStats: null, allEvents: [], eventPagination: { total: 0, hasMore: false, offset: 0, limit: 50 } });

    if (id) {
      await get().fetchEvents(id, true);
      await get().fetchSessionStats(id);
    } else {
      set({ events: [], hasMore: false, currentPage: 1 });
    }
  },

  fetchEvents: async (sessionId: string, reset = false) => {
    set({ isLoadingEvents: true, error: null });

    try {
      const page = reset ? 1 : get().currentPage;
      const { eventLimitPreference } = get();
      const limit = eventLimitPreference === 'all' ? 1000 : eventLimitPreference;
      const { eventFilters } = get();

      // Build filter params for API
      const filterParams = buildAPIFilterParams(eventFilters);

      // When skipServerFilter is true (Agent primary), fetch all events and filter client-side
      const { skipServerFilter, ...apiParams } = filterParams;
      const effectiveParams = skipServerFilter
        ? { page, limit, search: eventFilters.search || undefined }
        : { page, limit, ...apiParams, search: eventFilters.search || undefined };

      const response = await api.getEvents(sessionId, effectiveParams);

      // Also fetch unfiltered events for filter discovery (on reset with no secondary filters)
      const hasSecondaryFilters = eventFilters.secondaryFilters.length > 0;
      if (reset && !hasSecondaryFilters) {
        const allResponse = await api.getEvents(sessionId, {
          page: 1,
          limit: 1000, // Fetch more for filter discovery
          search: eventFilters.search || undefined,
        });
        set({ allEvents: allResponse.events });
      }

      // Update pagination with total from API
      const newOffset = (page - 1) * limit + response.events.length;
      const newPagination: EventPagination = {
        total: response.total ?? 0,
        hasMore: response.hasMore,
        offset: newOffset,
        limit,
      };

      if (reset) {
        set({
          events: response.events,
          hasMore: response.hasMore,
          currentPage: 2,
          isLoadingEvents: false,
          eventPagination: newPagination,
        });
      } else {
        set({
          events: [...get().events, ...response.events],
          hasMore: response.hasMore,
          isLoadingEvents: false,
          eventPagination: newPagination,
        });
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch events';
      set({ error: errorMessage, isLoadingEvents: false });
    }
  },

  loadMore: async () => {
    const { selectedSessionId, hasMore, isLoadingEvents } = get();

    if (!selectedSessionId || !hasMore || isLoadingEvents) {
      return;
    }

    set((state) => ({ currentPage: state.currentPage + 1 }));
    await get().fetchEvents(selectedSessionId, false);
  },

  setFilters: (filters: Partial<EventFilters>) => {
    set((state) => ({
      eventFilters: { ...state.eventFilters, ...filters },
    }));
    // Trigger refetch with new filters
    const { selectedSessionId } = get();
    if (selectedSessionId) {
      get().fetchEvents(selectedSessionId, true);
    }
  },

  getFilteredEvents: () => {
    // Server-side filtering handles most cases
    // Additional client-side filtering for MCP, Errors, and Agent
    const { events, eventFilters } = get();

    return events.filter((event) => {
      // Agent filter needs hybrid client-side filtering
      // (see buildAPIFilterParams for explanation)
      if (eventFilters.primaryFilters.includes('Agent')) {
        if (!belongsToPrimary(event, 'Agent')) return false;
      }

      // MCP filter needs client-side filtering since backend returns all tool events
      if (eventFilters.primaryFilters.includes('MCP') &&
          !eventFilters.primaryFilters.includes('Tool')) {
        const data = event.data as { tool?: string };
        if (!data.tool?.startsWith('mcp__')) return false;
      }

      // Errors filter client-side check for real-time events
      if (eventFilters.primaryFilters.includes('Errors')) {
        if (!isErrorEvent(event)) return false;
      }

      return true;
    });
  },

  addRealtimeEvent: (event: WatchmanEvent) => {
    const { selectedSessionId, eventFilters, events } = get();

    // Only add if it belongs to the current session
    if (event.sessionId !== selectedSessionId) {
      return;
    }

    // Check if event matches current primary/secondary filters
    const matchesFilters = eventMatchesFilters(
      event,
      eventFilters.primaryFilters,
      eventFilters.secondaryFilters,
    );
    if (!matchesFilters) return;

    // Agent filter needs client-side filtering (hybrid matching across columns)
    if (eventFilters.primaryFilters.includes('Agent')) {
      if (!belongsToPrimary(event, 'Agent')) return;
    }

    // Additional MCP filter check
    if (eventFilters.primaryFilters.includes('MCP') &&
        !eventFilters.primaryFilters.includes('Tool')) {
      const data = event.data as { tool?: string };
      if (!data.tool?.startsWith('mcp__')) return;
    }

    // Check errors filter for real-time events
    if (eventFilters.primaryFilters.includes('Errors') && !isErrorEvent(event)) {
      return;
    }

    // Search filter
    if (eventFilters.search) {
      const searchLower = eventFilters.search.toLowerCase();
      const searchFields = [
        event.subtype,
        JSON.stringify(event.data),
        event.metadata?.source,
      ].join(' ').toLowerCase();

      if (!searchFields.includes(searchLower)) {
        return;
      }
    }

    // Prepend event to the list
    set({ events: [event, ...events] });
  },

  selectEvent: (id: string | null) => {
    set({ selectedEventId: id });
  },

  setConnected: (status: boolean) => {
    set({ isConnected: status });
  },

  fetchStats: async () => {
    try {
      const stats = await api.getStats();
      set({ stats });
    } catch (err) {
      console.error('Failed to fetch stats:', err);
    }
  },

  fetchSessionStats: async (sessionId: string) => {
    try {
      const sessionStats = await api.getSessionStats(sessionId);
      set({ sessionStats });
    } catch (err) {
      console.error('Failed to fetch session stats:', err);
      set({ sessionStats: null });
    }
  },

  clearError: () => {
    set({ error: null });
  },

  setEventLimitPreference: async (limit: EventLimitPreference) => {
    // Persist to localStorage
    saveEventLimitPreference(limit);

    // Update state
    const effectiveLimit = limit === 'all' ? 1000 : limit;
    set({
      eventLimitPreference: limit,
      eventPagination: { ...get().eventPagination, limit: effectiveLimit },
    });

    // Refetch current session with new limit
    const { selectedSessionId } = get();
    if (selectedSessionId) {
      await get().fetchEvents(selectedSessionId, true);
    }
  },
}));
