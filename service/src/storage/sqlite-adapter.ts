import Database from 'better-sqlite3'
import fs from 'node:fs'
import path from 'node:path'
import type {
  Agent,
  GetEventsOptions,
  GlobalStats,
  Project,
  Session,
  SessionStats,
  StorageAdapter,
  WatchmanEvent,
} from './types.js'

export class SQLiteAdapter implements StorageAdapter {
  private db: Database.Database

  constructor(dbPath: string) {
    const dir = path.dirname(dbPath)
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }
    this.db = new Database(dbPath)
    this.db.pragma('journal_mode = WAL')
    this.initTables()
    this.initStatements()
  }

  private initTables(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS projects (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        slug TEXT NOT NULL UNIQUE,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_projects_slug ON projects(slug);

      CREATE TABLE IF NOT EXISTS sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id TEXT NOT NULL UNIQUE,
        project_id INTEGER NOT NULL,
        slug TEXT,
        status TEXT NOT NULL DEFAULT 'active',
        started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        stopped_at DATETIME,
        metadata TEXT NOT NULL DEFAULT '{}',
        FOREIGN KEY (project_id) REFERENCES projects(id)
      );

      CREATE INDEX IF NOT EXISTS idx_sessions_session_id ON sessions(session_id);
      CREATE INDEX IF NOT EXISTS idx_sessions_project_id ON sessions(project_id);
      CREATE INDEX IF NOT EXISTS idx_sessions_status ON sessions(status);

      CREATE TABLE IF NOT EXISTS agents (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        agent_id TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        description TEXT,
        parent_agent_id TEXT,
        session_id TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (session_id) REFERENCES sessions(session_id)
      );

      CREATE INDEX IF NOT EXISTS idx_agents_agent_id ON agents(agent_id);
      CREATE INDEX IF NOT EXISTS idx_agents_session_id ON agents(session_id);

      CREATE TABLE IF NOT EXISTS events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        event_id TEXT NOT NULL UNIQUE,
        session_id TEXT NOT NULL,
        type TEXT NOT NULL,
        action TEXT,
        tool TEXT,
        tool_use_id TEXT,
        agent_id TEXT,
        owner_agent_id TEXT,
        sub_agent_type TEXT,
        skill_type TEXT,
        timestamp INTEGER NOT NULL,
        summary TEXT,
        prompt TEXT,
        output TEXT,
        input_data TEXT,
        output_data TEXT,
        metadata TEXT NOT NULL DEFAULT '{}',
        source TEXT NOT NULL DEFAULT '{}',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (session_id) REFERENCES sessions(session_id)
      );

      CREATE INDEX IF NOT EXISTS idx_events_event_id ON events(event_id);
      CREATE INDEX IF NOT EXISTS idx_events_session_id ON events(session_id);
      CREATE INDEX IF NOT EXISTS idx_events_type ON events(type);
      CREATE INDEX IF NOT EXISTS idx_events_agent_id ON events(agent_id);
      CREATE INDEX IF NOT EXISTS idx_events_timestamp ON events(timestamp);

      -- Additional indexes for server-side filtering
      CREATE INDEX IF NOT EXISTS idx_events_action ON events(action);
      CREATE INDEX IF NOT EXISTS idx_events_tool ON events(tool);
      CREATE INDEX IF NOT EXISTS idx_events_session_action ON events(session_id, action);
      CREATE INDEX IF NOT EXISTS idx_events_session_tool ON events(session_id, tool);
    `)

    // Run migrations for existing tables
    this.runMigrations()
  }

  /**
   * Run migrations to add new columns to existing tables.
   * SQLite doesn't support IF NOT EXISTS for ALTER TABLE ADD COLUMN,
   * so we check if the column exists first.
   */
  private runMigrations(): void {
    // Get existing columns in events table
    const columns = this.db.prepare(
      `SELECT name FROM pragma_table_info('events')`
    ).all() as { name: string }[]
    const columnNames = new Set(columns.map(c => c.name))

    // Add skill_type column if it doesn't exist
    if (!columnNames.has('skill_type')) {
      this.db.exec(`ALTER TABLE events ADD COLUMN skill_type TEXT`)
    }

    // Add sub_agent_type column if it doesn't exist
    if (!columnNames.has('sub_agent_type')) {
      this.db.exec(`ALTER TABLE events ADD COLUMN sub_agent_type TEXT`)
    }
  }

  private insertProjectStmt!: Database.Statement<[string, string]>
  private getProjectBySlugStmt!: Database.Statement<[string]>
  private getAllProjectsStmt!: Database.Statement<[]>

  private insertSessionStmt!: Database.Statement<[string, number, string | null, string]>
  private getSessionBySessionIdStmt!: Database.Statement<[string]>
  private getSessionsByProjectIdStmt!: Database.Statement<[number]>
  private getAllSessionsStmt!: Database.Statement<[]>
  private stopSessionStmt!: Database.Statement<[string]>

  private insertAgentStmt!: Database.Statement<
    [string, string, string | null, string | null, string]
  >
  private updateAgentStmt!: Database.Statement<
    [string, string | null, string | null, string]
  >
  private getAgentByAgentIdStmt!: Database.Statement<[string]>
  private getAgentsBySessionIdStmt!: Database.Statement<[string]>

  private insertEventStmt!: Database.Statement<
    [
      string,
      string,
      string,
      string | null,
      string | null,
      string | null,
      string | null,
      string | null,
      string | null,
      string | null,
      number,
      string | null,
      string | null,
      string | null,
      string | null,
      string | null,
      string,
      string,
    ]
  >
  private getEventsBySessionStmt!: Database.Statement<[string, number, number]>
  private getEventsBySessionAndTypeStmt!: Database.Statement<
    [string, string, number, number]
  >
  private getEventsBySessionAndAgentStmt!: Database.Statement<
    [string, string, number, number]
  >
  private getEventsBySessionTypeAndAgentStmt!: Database.Statement<
    [string, string, string, number, number]
  >
  private getEventCountBySessionStmt!: Database.Statement<[string]>

  private getStatsStmt!: Database.Statement<[]>
  private healthCheckStmt!: Database.Statement<[]>

  private initStatements(): void {
    this.insertProjectStmt = this.db.prepare(
      `INSERT INTO projects (name, slug) VALUES (?, ?) RETURNING id, name, slug, created_at`
    )

    this.getProjectBySlugStmt = this.db.prepare(
      `SELECT id, name, slug, created_at FROM projects WHERE slug = ?`
    )

    this.getAllProjectsStmt = this.db.prepare(
      `SELECT id, name, slug, created_at FROM projects ORDER BY created_at DESC`
    )

    this.insertSessionStmt = this.db.prepare(
      `INSERT INTO sessions (session_id, project_id, slug, metadata) VALUES (?, ?, ?, ?)`
    )

    this.getSessionBySessionIdStmt = this.db.prepare(
      `SELECT id, session_id, project_id, slug, status, started_at, stopped_at, metadata FROM sessions WHERE session_id = ?`
    )

    this.getSessionsByProjectIdStmt = this.db.prepare(
      `SELECT id, session_id, project_id, slug, status, started_at, stopped_at, metadata FROM sessions WHERE project_id = ? ORDER BY started_at DESC`
    )

    this.getAllSessionsStmt = this.db.prepare(
      `SELECT id, session_id, project_id, slug, status, started_at, stopped_at, metadata FROM sessions ORDER BY started_at DESC`
    )

    this.stopSessionStmt = this.db.prepare(
      `UPDATE sessions SET status = 'stopped', stopped_at = CURRENT_TIMESTAMP WHERE session_id = ?`
    )

    this.insertAgentStmt = this.db.prepare(
      `INSERT INTO agents (agent_id, name, description, parent_agent_id, session_id) VALUES (?, ?, ?, ?, ?)`
    )

    this.updateAgentStmt = this.db.prepare(
      `UPDATE agents SET name = ?, description = ?, parent_agent_id = ? WHERE agent_id = ?`
    )

    this.getAgentByAgentIdStmt = this.db.prepare(
      `SELECT id, agent_id, name, description, parent_agent_id, session_id, created_at FROM agents WHERE agent_id = ?`
    )

    this.getAgentsBySessionIdStmt = this.db.prepare(
      `SELECT id, agent_id, name, description, parent_agent_id, session_id, created_at FROM agents WHERE session_id = ? ORDER BY created_at ASC`
    )

    this.insertEventStmt = this.db.prepare(
      `INSERT INTO events (
        event_id, session_id, type, action, tool, tool_use_id,
        agent_id, owner_agent_id, sub_agent_type, skill_type, timestamp, summary, prompt, output,
        input_data, output_data, metadata, source
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )

    this.getEventsBySessionStmt = this.db.prepare(
      `SELECT id, event_id, session_id, type, action, tool, tool_use_id,
        agent_id, owner_agent_id, sub_agent_type, skill_type, timestamp, summary, prompt, output,
        input_data, output_data, metadata, source, created_at
      FROM events WHERE session_id = ? ORDER BY timestamp DESC LIMIT ? OFFSET ?`
    )

    this.getEventsBySessionAndTypeStmt = this.db.prepare(
      `SELECT id, event_id, session_id, type, action, tool, tool_use_id,
        agent_id, owner_agent_id, sub_agent_type, skill_type, timestamp, summary, prompt, output,
        input_data, output_data, metadata, source, created_at
      FROM events WHERE session_id = ? AND type = ? ORDER BY timestamp DESC LIMIT ? OFFSET ?`
    )

    this.getEventsBySessionAndAgentStmt = this.db.prepare(
      `SELECT id, event_id, session_id, type, action, tool, tool_use_id,
        agent_id, owner_agent_id, sub_agent_type, skill_type, timestamp, summary, prompt, output,
        input_data, output_data, metadata, source, created_at
      FROM events WHERE session_id = ? AND agent_id = ? ORDER BY timestamp DESC LIMIT ? OFFSET ?`
    )

    this.getEventsBySessionTypeAndAgentStmt = this.db.prepare(
      `SELECT id, event_id, session_id, type, action, tool, tool_use_id,
        agent_id, owner_agent_id, sub_agent_type, skill_type, timestamp, summary, prompt, output,
        input_data, output_data, metadata, source, created_at
      FROM events WHERE session_id = ? AND type = ? AND agent_id = ? ORDER BY timestamp DESC LIMIT ? OFFSET ?`
    )

    this.getEventCountBySessionStmt = this.db.prepare(
      `SELECT COUNT(*) as count FROM events WHERE session_id = ?`
    )

    this.getStatsStmt = this.db.prepare(`
      SELECT
        (SELECT COUNT(*) FROM projects) as total_projects,
        (SELECT COUNT(*) FROM sessions) as total_sessions,
        (SELECT COUNT(*) FROM events) as total_events,
        (SELECT COUNT(*) FROM events WHERE type = 'agent' AND action = 'agent.start') as total_agents,
        (SELECT COUNT(*) FROM sessions WHERE status = 'active') as active_sessions
    `)

    this.healthCheckStmt = this.db.prepare(`SELECT 1`)
  }

  async getOrCreateProject(name: string): Promise<Project> {
    const slug = this.slugify(name)

    const existing = this.getProjectBySlugStmt.get(slug) as
      | {
        id: number
        name: string
        slug: string
        created_at: string
      }
      | undefined

    if (existing) {
      return {
        id: existing.id,
        name: existing.name,
        slug: existing.slug,
        createdAt: new Date(existing.created_at),
      }
    }

    const result = this.insertProjectStmt.get(name, slug) as {
      id: number
      name: string
      slug: string
      created_at: string
    }

    return {
      id: result.id,
      name: result.name,
      slug: result.slug,
      createdAt: new Date(result.created_at),
    }
  }

  async getProjects(): Promise<Project[]> {
    const rows = this.getAllProjectsStmt.all() as Array<{
      id: number
      name: string
      slug: string
      created_at: string
    }>

    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      slug: row.slug,
      createdAt: new Date(row.created_at),
    }))
  }

  async createSession(
    sessionId: string,
    projectId: number,
    metadata: Record<string, unknown>
  ): Promise<void> {
    const slug = sessionId.slice(0, 8)
    const metadataJson = JSON.stringify(metadata)
    this.insertSessionStmt.run(sessionId, projectId, slug, metadataJson)
  }

  async getSession(sessionId: string): Promise<Session | null> {
    const row = this.getSessionBySessionIdStmt.get(sessionId) as
      | {
        id: number
        session_id: string
        project_id: number
        slug: string | null
        status: string
        started_at: string
        stopped_at: string | null
        metadata: string
      }
      | undefined

    if (!row) return null

    return {
      id: row.id,
      sessionId: row.session_id,
      projectId: row.project_id,
      slug: row.slug,
      status: row.status as 'active' | 'stopped',
      startedAt: new Date(row.started_at),
      stoppedAt: row.stopped_at ? new Date(row.stopped_at) : null,
      metadata: JSON.parse(row.metadata),
    }
  }

  async getSessions(
    projectId?: number,
    filters?: {
      status?: 'active' | 'stopped'
      limit?: number
      offset?: number
      sortBy?: 'started_at' | 'stopped_at'
      sortOrder?: 'asc' | 'desc'
      sessionId?: string
    }
  ): Promise<{ sessions: Session[]; total: number }> {
    const limit = filters?.limit ?? 1000
    const offset = filters?.offset ?? 0
    const sortBy = filters?.sortBy ?? 'started_at'
    const sortOrder = filters?.sortOrder ?? 'desc'

    // Build WHERE clause
    const conditions: string[] = []
    const params: (string | number)[] = []

    if (projectId !== undefined) {
      conditions.push('project_id = ?')
      params.push(projectId)
    }
    if (filters?.status) {
      conditions.push('status = ?')
      params.push(filters.status)
    }
    if (filters?.sessionId?.trim()) {
      conditions.push('session_id LIKE ?')
      params.push(`%${filters.sessionId.trim()}%`)
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

    // Get total count
    const countQuery = `SELECT COUNT(*) as count FROM sessions ${whereClause}`
    const countResult = this.db.prepare(countQuery).get(...params) as { count: number }
    const total = countResult.count

    // Get paginated results
    const orderColumn = sortBy === 'stopped_at' ? 'stopped_at' : 'started_at'
    const orderDirection = sortOrder.toUpperCase()

    const query = `
      SELECT s.id, s.session_id, s.project_id, s.slug, s.status, s.started_at, s.stopped_at, s.metadata,
        (SELECT COUNT(*) FROM agents a WHERE a.session_id = s.session_id) as agent_count
      FROM sessions s
      ${whereClause}
      ORDER BY ${orderColumn} ${orderDirection}
      LIMIT ? OFFSET ?
    `

    const rows = this.db.prepare(query).all(...params, limit, offset) as Array<{
      id: number
      session_id: string
      project_id: number
      slug: string | null
      status: string
      started_at: string
      stopped_at: string | null
      metadata: string
      agent_count: number
    }>

    const sessions = rows.map((row) => ({
      id: row.id,
      sessionId: row.session_id,
      projectId: row.project_id,
      slug: row.slug,
      status: row.status as 'active' | 'stopped',
      startedAt: new Date(row.started_at),
      stoppedAt: row.stopped_at ? new Date(row.stopped_at) : null,
      metadata: JSON.parse(row.metadata),
      agentCount: row.agent_count,
    }))

    return { sessions, total }
  }

  async stopSession(sessionId: string): Promise<void> {
    this.stopSessionStmt.run(sessionId)
  }

  async upsertAgent(agent: {
    agentId: string
    name: string
    description: string | null
    parentAgentId: string | null
    sessionId: string
  }): Promise<void> {
    const existing = this.getAgentByAgentIdStmt.get(agent.agentId) as
      | { id: number }
      | undefined

    if (existing) {
      this.updateAgentStmt.run(
        agent.name,
        agent.description,
        agent.parentAgentId,
        agent.agentId
      )
    } else {
      this.insertAgentStmt.run(
        agent.agentId,
        agent.name,
        agent.description,
        agent.parentAgentId,
        agent.sessionId
      )
    }
  }

  async getAgentsForSession(sessionId: string): Promise<Agent[]> {
    const rows = this.getAgentsBySessionIdStmt.all(sessionId) as Array<{
      id: number
      agent_id: string
      name: string
      description: string | null
      parent_agent_id: string | null
      session_id: string
      created_at: string
    }>

    return rows.map((row) => ({
      id: row.id,
      agentId: row.agent_id,
      name: row.name,
      description: row.description,
      parentAgentId: row.parent_agent_id,
      sessionId: row.session_id,
      createdAt: new Date(row.created_at),
    }))
  }

  async getAgent(agentId: string): Promise<Agent | null> {
    const row = this.getAgentByAgentIdStmt.get(agentId) as
      | {
        id: number
        agent_id: string
        name: string
        description: string | null
        parent_agent_id: string | null
        session_id: string
        created_at: string
      }
      | undefined

    if (!row) return null

    return {
      id: row.id,
      agentId: row.agent_id,
      name: row.name,
      description: row.description,
      parentAgentId: row.parent_agent_id,
      sessionId: row.session_id,
      createdAt: new Date(row.created_at),
    }
  }

  async getAllSessions(): Promise<{ sessions: Session[]; total: number }> {
    return this.getSessions()
  }

  async getSessionEvents(sessionId: string, limit: number, offset: number): Promise<WatchmanEvent[]> {
    return this.getEvents(sessionId, { limit, offset })
  }

  async getSessionEventCount(sessionId: string): Promise<number> {
    return this.getEventCount(sessionId)
  }

  async getGlobalStats(): Promise<GlobalStats> {
    return this.getStats()
  }

  async insertEvent(event: {
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
  }): Promise<number> {
    this.insertEventStmt.run(
      event.eventId,
      event.sessionId,
      event.type,
      event.action,
      event.tool,
      event.toolUseId,
      event.agentId,
      event.ownerAgentId,
      event.subAgentType,
      event.skillType,
      event.timestamp,
      event.summary,
      event.prompt,
      event.output,
      event.inputData ? JSON.stringify(event.inputData) : null,
      event.outputData ? JSON.stringify(event.outputData) : null,
      JSON.stringify(event.metadata),
      JSON.stringify(event.source)
    )
    return event.timestamp  // Return timestamp as the event ID
  }

  async getEvents(
    sessionId: string,
    options: GetEventsOptions = {}
  ): Promise<WatchmanEvent[]> {
    const limit = options.limit ?? 100
    const offset = options.offset ?? 0

    // Build dynamic query with conditions
    const conditions: string[] = ['session_id = ?']
    const params: (string | number)[] = [sessionId]

    // Types filter (event.type column)
    if (options.types?.length) {
      conditions.push(`type IN (${options.types.map(() => '?').join(',')})`)
      params.push(...options.types)
    }

    // Actions filter (event.action column)
    if (options.actions?.length) {
      conditions.push(`action IN (${options.actions.map(() => '?').join(',')})`)
      params.push(...options.actions)
    }

    // Tools filter (event.tool column)
    if (options.tools?.length) {
      conditions.push(`tool IN (${options.tools.map(() => '?').join(',')})`)
      params.push(...options.tools)
    }

    // Agent IDs filter
    if (options.agentIds?.length) {
      conditions.push(`agent_id IN (${options.agentIds.map(() => '?').join(',')})`)
      params.push(...options.agentIds)
    }

    // Time range filters
    if (options.startTime) {
      conditions.push('timestamp >= ?')
      params.push(options.startTime)
    }
    if (options.endTime) {
      conditions.push('timestamp <= ?')
      params.push(options.endTime)
    }

    // Text search (summary, prompt, output columns)
    if (options.search?.trim()) {
      conditions.push(`(summary LIKE ? OR prompt LIKE ? OR output LIKE ?)`)
      const pattern = `%${options.search.trim()}%`
      params.push(pattern, pattern, pattern)
    }

    // Errors only filter
    if (options.errorsOnly) {
      // Match events where:
      // 1. action LIKE '%failure%' (tool.failure, StopFailure)
      // 2. OR output_data contains error field (handle whitespace variations)
      conditions.push(`(
        action LIKE '%failure%'
        OR output_data LIKE '%"error"%'
        OR output_data LIKE '%"error" %'
        OR output_data LIKE '%"error":%'
        OR output_data LIKE '%"error" :%'
      )`)
    }

    const query = `
      SELECT id, event_id, session_id, type, action, tool, tool_use_id,
        agent_id, owner_agent_id, sub_agent_type, skill_type, timestamp, summary, prompt, output,
        input_data, output_data, metadata, source, created_at
      FROM events
      WHERE ${conditions.join(' AND ')}
      ORDER BY timestamp DESC
      LIMIT ? OFFSET ?
    `
    params.push(limit, offset)

    const rows = this.db.prepare(query).all(...params) as Array<{
      id: number
      event_id: string
      session_id: string
      type: string
      action: string | null
      tool: string | null
      tool_use_id: string | null
      agent_id: string | null
      owner_agent_id: string | null
      sub_agent_type: string | null
      skill_type: string | null
      timestamp: number
      summary: string | null
      prompt: string | null
      output: string | null
      input_data: string | null
      output_data: string | null
      metadata: string
      source: string
      created_at: string
    }>

    return rows.map((row) => ({
      id: row.id,
      eventId: row.event_id,
      sessionId: row.session_id,
      type: row.type,
      action: row.action,
      tool: row.tool,
      toolUseId: row.tool_use_id,
      agentId: row.agent_id,
      ownerAgentId: row.owner_agent_id,
      subAgentType: row.sub_agent_type,
      skillType: row.skill_type,
      timestamp: row.timestamp,
      summary: row.summary,
      prompt: row.prompt,
      output: row.output,
      inputData: row.input_data ? JSON.parse(row.input_data) : null,
      outputData: row.output_data ? JSON.parse(row.output_data) : null,
      metadata: JSON.parse(row.metadata),
      source: JSON.parse(row.source),
      createdAt: new Date(row.created_at),
    }))
  }

  async getEventCount(sessionId: string): Promise<number> {
    const result = this.getEventCountBySessionStmt.get(sessionId) as {
      count: number
    }
    return result.count
  }

  async getStats(): Promise<GlobalStats> {
    const row = this.getStatsStmt.get() as {
      total_projects: number
      total_sessions: number
      total_events: number
      total_agents: number
      active_sessions: number
    }

    return {
      totalProjects: row.total_projects,
      totalSessions: row.total_sessions,
      totalEvents: row.total_events,
      totalAgents: row.total_agents,
      activeSessions: row.active_sessions,
      totalErrors: 0, // TODO: Implement actual error counting in global stats
    }
  }

  async getSessionStats(sessionId: string): Promise<SessionStats | null> {
    const session = await this.getSession(sessionId)
    if (!session) return null

    const events = await this.getEvents(sessionId, { limit: 10000 })

    const eventsByType: Record<string, number> = {}
    for (const event of events) {
      eventsByType[event.type] = (eventsByType[event.type] || 0) + 1
    }

    // Count tool calls (events where type = 'tool')
    const toolCalls = events.filter(e => e.type === 'tool').length

    // Count errors (tool failures, stop failures, or events with error output)
    const errorCount = events.filter(e => {
      // Tool failures
      if (e.type === 'tool' && e.action?.includes('failure')) return true
      // Stop failures
      if (e.action?.includes('Failure')) return true
      // Events with error in output data
      if (e.outputData?.error) return true
      return false
    }).length

    const duration = session.stoppedAt
      ? session.stoppedAt.getTime() - session.startedAt.getTime()
      : null

    return {
      sessionId,
      totalEvents: events.length,
      eventsByType,
      agentCount: agents.length,
      duration,
      toolCalls,
      errorCount,
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      this.healthCheckStmt.get()
      return true
    } catch {
      return false
    }
  }

  private slugify(name: string): string {
    return name
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '')
      .replace(/[\s_-]+/g, '-')
      .replace(/^-+|-+$/g, '')
  }
}
