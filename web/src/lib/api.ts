import type {
  Session,
  WatchmanEvent,
  PaginatedResponse,
  DashboardStats,
  FetchSessionsOptions,
  SessionStats,
} from '../types';
import { transformSession, transformEvent } from './transforms';

const API_BASE_URL = '/api';

interface ApiError {
  message: string;
  code?: string;
}

class ApiClientError extends Error {
  code?: string;

  constructor(message: string, code?: string) {
    super(message);
    this.name = 'ApiClientError';
    this.code = code;
  }
}

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    let errorData: ApiError;
    try {
      errorData = await response.json();
    } catch {
      errorData = { message: `HTTP ${response.status}: ${response.statusText}` };
    }
    throw new ApiClientError(
      errorData.message || `Request failed with status ${response.status}`,
      errorData.code
    );
  }

  try {
    return await response.json();
  } catch {
    throw new ApiClientError('Invalid JSON response from server');
  }
}

async function get<T>(path: string): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: 'GET',
    headers: {
      'Accept': 'application/json',
    },
  });
  return handleResponse<T>(response);
}

export interface GetEventsOptions {
  page?: number;
  limit?: number;
  types?: string[];
  actions?: string[];
  tools?: string[];
  agentIds?: string[];
  search?: string;
  startTime?: number;
  endTime?: number;
  errorsOnly?: boolean;
}

export interface EventsResponse {
  events: WatchmanEvent[];
  hasMore: boolean;
  total: number;
}

// Backend response types
interface BackendSession {
  id: number;
  sessionId: string;
  projectId: number;
  slug: string | null;
  status: 'active' | 'stopped';
  startedAt: string;
  stoppedAt: string | null;
  metadata: Record<string, unknown>;
}

interface BackendEvent {
  id: number;
  eventId: string;
  sessionId: string;
  type: string;
  action: string | null;
  tool: string | null;
  toolUseId: string | null;
  agentId: string | null;
  ownerAgentId: string | null;
  subAgentType: string | null;
  skillType: string | null;
  timestamp: number;
  summary: string | null;
  prompt: string | null;
  output: string | null;
  inputData: Record<string, unknown> | null;
  outputData: Record<string, unknown> | null;
  metadata: Record<string, unknown>;
  source: Record<string, unknown>;
}

export interface SessionsResponse {
  sessions: Session[];
  pagination: {
    total: number;
    hasMore: boolean;
  };
}

export const api = {
  /**
   * Fetch sessions with optional filtering and pagination
   */
  async fetchSessions(options?: FetchSessionsOptions): Promise<SessionsResponse> {
    const params = new URLSearchParams();
    if (options?.status) params.append('status', options.status);
    if (options?.limit) params.append('limit', options.limit.toString());
    if (options?.offset) params.append('offset', options.offset.toString());
    if (options?.sortBy) params.append('sortBy', options.sortBy === 'stoppedAt' ? 'stopped_at' : 'started_at');
    if (options?.sortOrder) params.append('sortOrder', options.sortOrder);

    const queryString = params.toString();
    const path = queryString ? `/sessions?${queryString}` : '/sessions';

    const response = await get<PaginatedResponse<BackendSession>>(path);

    if (!response.success) {
      throw new ApiClientError(response.error || 'Failed to fetch sessions');
    }

    return {
      sessions: response.data.map(transformSession),
      pagination: {
        total: response.pagination.total,
        hasMore: response.pagination.hasNext,
      },
    };
  },

  /**
   * Get events for a specific session with pagination and filtering
   */
  async getEvents(sessionId: string, options: GetEventsOptions = {}): Promise<EventsResponse> {
    const { page = 1, limit = 50 } = options;

    // Calculate offset from page (backend uses offset, not page)
    const offset = (page - 1) * limit;

    const params = new URLSearchParams();
    params.append('offset', offset.toString());
    params.append('limit', limit.toString());

    // Add filter params
    if (options.types?.length) params.append('types', options.types.join(','));
    if (options.actions?.length) params.append('actions', options.actions.join(','));
    if (options.tools?.length) params.append('tools', options.tools.join(','));
    if (options.agentIds?.length) params.append('agentIds', options.agentIds.join(','));
    if (options.search?.trim()) params.append('search', options.search.trim());
    if (options.startTime) params.append('startTime', options.startTime.toString());
    if (options.endTime) params.append('endTime', options.endTime.toString());
    if (options.errorsOnly) params.append('errorsOnly', 'true');

    const response = await get<PaginatedResponse<BackendEvent>>(
      `/sessions/${encodeURIComponent(sessionId)}/events?${params.toString()}`
    );

    if (!response.success) {
      throw new ApiClientError(response.error || 'Failed to fetch events');
    }

    return {
      events: response.data.map(transformEvent),
      hasMore: response.pagination.hasNext,
      total: response.pagination.total,
    };
  },

  /**
   * Get global statistics
   */
  async getStats(): Promise<DashboardStats> {
    interface BackendStats {
      totalProjects: number;
      totalSessions: number;
      totalEvents: number;
      totalAgents: number;
      activeSessions: number;
      totalErrors: number;
    }

    const response = await get<{ success: boolean; data: BackendStats; error?: string }>('/stats');

    if (!response.success) {
      throw new ApiClientError(response.error || 'Failed to fetch stats');
    }

    // Map backend stats to frontend DashboardStats
    return {
      totalProjects: response.data.totalProjects,
      activeSessions: response.data.activeSessions,
      totalAgents: response.data.totalAgents,
      eventsToday: response.data.totalEvents, // Using totalEvents as approximation
      eventsPerHour: [], // Backend doesn't track this yet
      totalErrors: response.data.totalErrors ?? 0,
    };
  },

  /**
   * Get session-specific statistics
   */
  async getSessionStats(sessionId: string): Promise<SessionStats> {
    interface BackendSessionStats {
      sessionId: string;
      totalEvents: number;
      eventsByType: Record<string, number>;
      agentCount: number;
      duration: number | null;
      toolCalls: number;
      errorCount: number;
    }

    const response = await get<{ success: boolean; data: BackendSessionStats; error?: string }>(
      `/sessions/${encodeURIComponent(sessionId)}/stats`
    );

    if (!response.success) {
      throw new ApiClientError(response.error || 'Failed to fetch session stats');
    }

    return response.data;
  },
};

// Re-export for convenience
export { ApiClientError };