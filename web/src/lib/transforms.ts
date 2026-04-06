import type {
  Session,
  WatchmanEvent,
  EventData,
  EventType,
  ToolEventData,
  UserEventData,
  SessionEventData,
  SystemEventData,
} from '../types';

// Backend response types (match what server returns)
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

export function transformSession(b: BackendSession): Session {
  return {
    id: b.sessionId,
    projectId: String(b.projectId),
    agentId: '',
    status: b.status === 'active' ? 'running' : 'completed',
    startedAt: new Date(b.startedAt).toISOString(),
    endedAt: b.stoppedAt ? new Date(b.stoppedAt).toISOString() : undefined,
    stoppedAt: b.stoppedAt ? new Date(b.stoppedAt).toISOString() : undefined,
    taskCount: 0,
    metadata: b.metadata,
  };
}

export function transformEvent(b: BackendEvent): WatchmanEvent {
  return {
    id: String(b.id),
    sessionId: b.sessionId,
    projectId: '',
    agentId: b.agentId || undefined,
    subAgentType: b.subAgentType || undefined,
    skillType: b.skillType || undefined,
    type: b.type as EventType,
    subtype: b.action || '',
    data: buildEventData(b),
    timestamp: new Date(b.timestamp).toISOString(),
    metadata: { source: JSON.stringify(b.source) },
  };
}

function buildEventData(b: BackendEvent): EventData {
  // Map backend event type to frontend EventData
  if (b.type === 'tool') {
    const hasError = b.action?.includes('failure') || !!b.outputData?.error;
    return {
      tool: b.tool || '',
      action: b.action?.includes('before') ? 'call' : hasError ? 'error' : 'result',
      input: b.inputData || undefined,
      output: b.outputData || undefined,
      error: hasError ? (b.summary || (b.outputData?.error as string) || undefined) : undefined,
    } as ToolEventData;
  }

  if (b.type === 'user') {
    return {
      action: 'message',
      content: b.summary || '',
    } as UserEventData;
  }

  if (b.type === 'session') {
    return {
      action: b.action?.includes('begin') ? 'started' : 'ended',
      sessionId: b.sessionId,
    } as SessionEventData;
  }

  if (b.type === 'agent') {
    return {
      action: b.action?.includes('complete') ? 'stopped' : 'started',
      agentId: b.agentId || '',
      message: b.summary || undefined,
    };
  }

  // Default to system event
  return {
    level: 'info',
    message: b.summary || '',
    details: b.source,
  } as SystemEventData;
}
