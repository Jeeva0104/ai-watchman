export interface Project {
  id: number
  name: string
  slug: string
  createdAt: Date
}

export interface Session {
  id: number
  sessionId: string
  projectId: number
  slug: string | null
  status: 'active' | 'stopped'
  startedAt: Date
  stoppedAt: Date | null
  metadata: Record<string, unknown>
  agentCount: number
}

export interface Agent {
  id: number
  agentId: string
  name: string
  description: string | null
  parentAgentId: string | null
  sessionId: string
  createdAt: Date
}

export interface WatchmanEvent {
  id: number
  eventId: string
  sessionId: string
  type: string
  action: string | null
  tool: string | null
  toolUseId: string | null
  agentId: string | null
  ownerAgentId: string | null
  subAgentType: string | null
  skillType: string | null
  timestamp: number
  summary: string | null
  prompt: string | null
  output: string | null
  inputData: Record<string, unknown> | null
  outputData: Record<string, unknown> | null
  metadata: Record<string, unknown>
  source: Record<string, unknown>
  createdAt: Date
}

export interface GlobalStats {
  totalProjects: number
  totalSessions: number
  totalEvents: number
  totalAgents: number
  activeSessions: number
  totalErrors: number
}

export interface SessionStats {
  sessionId: string
  totalEvents: number
  eventsByType: Record<string, number>
  agentCount: number
  duration: number | null
  toolCalls: number
  errorCount: number
}

export interface GetEventsOptions {
  limit?: number
  offset?: number
  types?: string[]      // Event types (tool, user, session, agent, system)
  actions?: string[]    // Event actions (tool.before, UserPromptSubmit, etc.)
  tools?: string[]      // Tool names (Bash, Read, Agent, mcp__*, etc.)
  agentIds?: string[]   // Agent IDs
  search?: string       // Text search in summary/prompt/output
  startTime?: number    // Unix timestamp ms
  endTime?: number      // Unix timestamp ms
  errorsOnly?: boolean  // Filter for error events only
}

export interface StorageAdapter {
  getOrCreateProject(name: string): Promise<Project>
  getProjects(): Promise<Project[]>

  createSession(
    sessionId: string,
    projectId: number,
    metadata: Record<string, unknown>
  ): Promise<void>
  getSession(sessionId: string): Promise<Session | null>
  getSessions(
    projectId?: number,
    filters?: {
      status?: 'active' | 'stopped'
      limit?: number
      offset?: number
      sortBy?: 'started_at' | 'stopped_at'
      sortOrder?: 'asc' | 'desc'
    }
  ): Promise<{ sessions: Session[]; total: number }>
  getAllSessions(): Promise<{ sessions: Session[]; total: number }>
  stopSession(sessionId: string): Promise<void>

  upsertAgent(agent: {
    agentId: string
    name: string
    description: string | null
    parentAgentId: string | null
    sessionId: string
  }): Promise<void>
  getAgent(agentId: string): Promise<Agent | null>
  getAgentsForSession(sessionId: string): Promise<Agent[]>

  insertEvent(event: {
    eventId: string
    sessionId: string
    type: string
    action: string | null
    tool: string | null
    toolUseId: string | null
    agentId: string | null
    ownerAgentId: string | null
    subAgentType: string | null
    skillType: string | null
    timestamp: number
    summary: string | null
    prompt: string | null
    output: string | null
    inputData: Record<string, unknown> | null
    outputData: Record<string, unknown> | null
    metadata: Record<string, unknown>
    source: Record<string, unknown>
  }): Promise<number>
  getEvents(sessionId: string, options?: GetEventsOptions): Promise<WatchmanEvent[]>
  getSessionEvents(sessionId: string, limit: number, offset: number): Promise<WatchmanEvent[]>
  getEventCount(sessionId: string): Promise<number>
  getSessionEventCount(sessionId: string): Promise<number>

  getStats(): Promise<GlobalStats>
  getGlobalStats(): Promise<GlobalStats>
  getSessionStats(sessionId: string): Promise<SessionStats | null>
  healthCheck(): Promise<boolean>
}
