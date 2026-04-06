export interface Project {
  id: string;
  name: string;
  path: string;
  config: ProjectConfig;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectConfig {
  description?: string;
  agentCount: number;
  autoStart: boolean;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
}

export interface Session {
  id: string;
  projectId: string;
  agentId: string;
  status: 'running' | 'paused' | 'completed' | 'error';
  startedAt: string;
  endedAt?: string;
  stoppedAt?: string;
  taskCount: number;
  metadata?: Record<string, unknown>;
  agentCount: number;
}

export interface FetchSessionsOptions {
  status?: 'active' | 'stopped';
  limit?: number;
  offset?: number;
  sortBy?: 'startedAt' | 'stoppedAt';
  sortOrder?: 'asc' | 'desc';
}

export interface Agent {
  id: string;
  projectId: string;
  name: string;
  type: string;
  status: 'idle' | 'active' | 'error' | 'offline';
  capabilities: string[];
  createdAt: string;
  lastSeenAt?: string;
}

export type EventType = 'session' | 'user' | 'tool' | 'agent' | 'system';

export interface WatchmanEvent {
  id: string;
  sessionId: string;
  projectId: string;
  agentId?: string;
  subAgentType?: string;
  skillType?: string;
  type: EventType;
  subtype: string;
  data: EventData;
  timestamp: string;
  metadata?: EventMetadata;
}

export type EventData =
  | SessionEventData
  | UserEventData
  | ToolEventData
  | AgentEventData
  | SystemEventData;

export interface SessionEventData {
  action: 'started' | 'ended' | 'paused' | 'resumed';
  sessionId: string;
  duration?: number;
}

export interface UserEventData {
  action: 'message' | 'command';
  content: string;
  context?: string;
}

export interface ToolEventData {
  tool: string;
  action: 'call' | 'result' | 'error';
  input?: Record<string, unknown>;
  output?: unknown;
  error?: string;
  duration?: number;
}

export interface AgentEventData {
  action: 'created' | 'started' | 'stopped' | 'error' | 'heartbeat';
  agentId: string;
  message?: string;
}

export interface SystemEventData {
  level: 'info' | 'warn' | 'error' | 'debug';
  message: string;
  details?: Record<string, unknown>;
}

export interface EventMetadata {
  source?: string;
  correlationId?: string;
  parentId?: string;
  tags?: string[];
}

export interface EventFilters {
  projectId?: string;
  sessionId?: string;
  agentId?: string;
  types?: EventType[];
  subtypes?: string[];
  startTime?: string;
  endTime?: string;
  search?: string;
  tags?: string[];
}

export interface PaginatedResponse<T> {
  success: boolean;
  data: T[];
  pagination: PaginationInfo;
  error?: string;
}

export interface SingleResponse<T> {
  success: boolean;
  data: T | null;
  error?: string;
}

export interface PaginationInfo {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export interface ApiError {
  success: false;
  data: null;
  error: string;
  code?: string;
}

export interface WebSocketMessage {
  type: 'event' | 'status' | 'ping' | 'pong' | 'connected';
  payload?: unknown;
  timestamp?: string;
  session?: string;
  ts?: number;
}

export interface DashboardStats {
  totalProjects: number;
  activeSessions: number;
  totalAgents: number;
  eventsToday: number;
  eventsPerHour: number[];
  totalErrors: number;
}

export interface SessionStats {
  sessionId: string;
  totalEvents: number;
  eventsByType: Record<string, number>;
  agentCount: number;
  duration: number | null;
  toolCalls: number;
  errorCount: number;
}
