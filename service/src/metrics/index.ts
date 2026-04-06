import client, { Registry, Counter, Gauge, Histogram } from 'prom-client'
import { storage } from '../storage/index.js'
import { stat } from 'fs/promises'

// Create a custom registry
export const register = new Registry()

// Collect default Node.js metrics (memory, CPU, event loop)
client.collectDefaultMetrics({ register })

// Track session start times for duration calculation
const sessionStartTimes = new Map<string, number>()

// Prefix for all metrics
const PREFIX = 'watchman_'

// ============================================
// COUNTER METRICS
// ============================================

export const eventsIngestedTotal = new Counter({
  name: `${PREFIX}events_ingested_total`,
  help: 'Total number of events ingested',
  labelNames: ['type', 'action'],
  registers: [register],
})

export const sessionsTotal = new Counter({
  name: `${PREFIX}sessions_total`,
  help: 'Total number of sessions by status',
  labelNames: ['status'],
  registers: [register],
})

export const toolsCallsTotal = new Counter({
  name: `${PREFIX}tools_calls_total`,
  help: 'Total number of tool calls',
  labelNames: ['tool', 'status'],
  registers: [register],
})

export const agentsSpawnedTotal = new Counter({
  name: `${PREFIX}agents_spawned_total`,
  help: 'Total number of agents spawned',
  labelNames: ['agent_type'],
  registers: [register],
})

export const errorsTotal = new Counter({
  name: `${PREFIX}errors_total`,
  help: 'Total number of errors',
  labelNames: ['type', 'tool'],
  registers: [register],
})

export const ingestRequestsTotal = new Counter({
  name: `${PREFIX}ingest_requests_total`,
  help: 'Total number of ingest requests',
  labelNames: ['status'],
  registers: [register],
})

// ============================================
// GAUGE METRICS
// ============================================

export const sessionsActive = new Gauge({
  name: `${PREFIX}sessions_active`,
  help: 'Number of currently active sessions',
  registers: [register],
})

export const agentsActive = new Gauge({
  name: `${PREFIX}agents_active`,
  help: 'Number of currently active agents',
  registers: [register],
})

export const websocketConnections = new Gauge({
  name: `${PREFIX}websocket_connections_active`,
  help: 'Number of active WebSocket connections',
  registers: [register],
})

export const databaseSizeBytes = new Gauge({
  name: `${PREFIX}database_size_bytes`,
  help: 'Size of the SQLite database in bytes',
  registers: [register],
})

// ============================================
// HISTOGRAM METRICS
// ============================================

export const sessionDurationSeconds = new Histogram({
  name: `${PREFIX}session_duration_seconds`,
  help: 'Duration of completed sessions in seconds',
  buckets: [60, 300, 600, 1800, 3600, 7200, 14400, 28800, 86400],
  registers: [register],
})

export const toolsDurationSeconds = new Histogram({
  name: `${PREFIX}tools_duration_seconds`,
  help: 'Duration of tool executions in seconds',
  labelNames: ['tool'],
  buckets: [0.1, 0.5, 1, 2, 5, 10, 30, 60, 120],
  registers: [register],
})

export const httpRequestDurationSeconds = new Histogram({
  name: `${PREFIX}http_request_duration_seconds`,
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5],
  registers: [register],
})

export const ingestDurationSeconds = new Histogram({
  name: `${PREFIX}ingest_duration_seconds`,
  help: 'Duration of event ingestion in seconds',
  buckets: [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1],
  registers: [register],
})

export const dbQueryDurationSeconds = new Histogram({
  name: `${PREFIX}db_query_duration_seconds`,
  help: 'Duration of database queries in seconds',
  labelNames: ['operation'],
  buckets: [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5],
  registers: [register],
})

// ============================================
// BUILD INFO
// ============================================

export const buildInfo = new Gauge({
  name: `${PREFIX}build_info`,
  help: 'Build information',
  labelNames: ['version', 'node_version'],
  registers: [register],
})

// Initialize build info
buildInfo.set({ version: '1.0.0', node_version: process.version }, 1)

// ============================================
// HELPER FUNCTIONS
// ============================================

export function recordEvent(type: string, action: string | null): void {
  eventsIngestedTotal.inc({ type, action: action || 'unknown' })
}

export function recordToolCall(tool: string, status: 'success' | 'failure'): void {
  toolsCallsTotal.inc({ tool, status })
}

export function recordError(type: string, tool: string | null): void {
  errorsTotal.inc({ type, tool: tool || 'unknown' })
}

export function recordAgentSpawned(agentType: string): void {
  agentsSpawnedTotal.inc({ agent_type: agentType })
}

export function recordSessionStart(sessionId?: string): void {
  sessionsTotal.inc({ status: 'started' })
  if (sessionId) {
    sessionStartTimes.set(sessionId, Date.now())
  }
}

export function recordSessionEnd(sessionId?: string): void {
  sessionsTotal.inc({ status: 'ended' })
  if (sessionId) {
    const startTime = sessionStartTimes.get(sessionId)
    if (startTime) {
      const duration = (Date.now() - startTime) / 1000
      sessionDurationSeconds.observe(duration)
      sessionStartTimes.delete(sessionId)
    }
  }
}

export function recordIngestRequest(status: 'success' | 'failure'): void {
  ingestRequestsTotal.inc({ status })
}

export function incrementWebSocketConnections(): void {
  websocketConnections.inc()
}

export function decrementWebSocketConnections(): void {
  websocketConnections.dec()
}

export async function updateGlobalMetrics(): Promise<void> {
  try {
    const stats = await storage.getStats()
    sessionsActive.set(stats.activeSessions)

    // Update database size
    const dbPath = process.env.DATABASE_PATH || '/data/watchman.db'
    try {
      const dbStats = await stat(dbPath)
      databaseSizeBytes.set(dbStats.size)
    } catch {
      // Database file may not exist yet
    }
  } catch {
    // Storage may not be ready during startup
  }
}

// Track active agents based on agent events
let activeAgentsCount = 0

export function incrementActiveAgents(): void {
  activeAgentsCount++
  agentsActive.set(activeAgentsCount)
}

export function decrementActiveAgents(): void {
  if (activeAgentsCount > 0) {
    activeAgentsCount--
    agentsActive.set(activeAgentsCount)
  }
}
