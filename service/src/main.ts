import Fastify, { FastifyRequest, FastifyReply } from 'fastify'
import cors from '@fastify/cors'
import websocket from '@fastify/websocket'
import { settings } from './settings.js'
import { transformPayload } from './transformer.js'
import type { TransformedPayload } from './types.js'
import { colorize, colors } from './colors.js'
import { storage } from './storage/index.js'
import {
  register,
  recordEvent,
  recordToolCall,
  recordError,
  recordAgentSpawned,
  recordSessionStart,
  recordSessionEnd,
  recordIngestRequest,
  incrementWebSocketConnections,
  decrementWebSocketConnections,
  incrementActiveAgents,
  decrementActiveAgents,
  ingestDurationSeconds,
  sessionDurationSeconds,
} from './metrics/index.js'
import { metricsMiddleware } from './metrics/middleware.js'

const server = Fastify({
  logger: settings.verbose,
})

// Register CORS plugin
await server.register(cors, {
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
})

// Register WebSocket plugin
await server.register(websocket)

// Apply metrics middleware
metricsMiddleware(server)

let itemCount = 0

// In-memory subscription manager for WebSocket connections
// Maps sessionId -> Set of WebSocket connections
const sessionSubscriptions = new Map<string, Set<WebSocket>>()

/**
 * Subscribe a WebSocket connection to a session
 */
function subscribeToSession(sessionId: string, ws: WebSocket): void {
  if (!sessionSubscriptions.has(sessionId)) {
    sessionSubscriptions.set(sessionId, new Set())
  }
  sessionSubscriptions.get(sessionId)!.add(ws)
  console.log(`[WS] Subscribed to session ${sessionId}, total subscribers: ${sessionSubscriptions.get(sessionId)!.size}`)
}

/**
 * Unsubscribe a WebSocket connection from a session
 */
function unsubscribeFromSession(sessionId: string, ws: WebSocket): void {
  const subscribers = sessionSubscriptions.get(sessionId)
  if (subscribers) {
    subscribers.delete(ws)
    if (subscribers.size === 0) {
      sessionSubscriptions.delete(sessionId)
    }
  }
}

/**
 * Unsubscribe a WebSocket connection from all sessions
 */
function unsubscribeFromAllSessions(ws: WebSocket): void {
  for (const [sessionId, subscribers] of sessionSubscriptions) {
    subscribers.delete(ws)
    if (subscribers.size === 0) {
      sessionSubscriptions.delete(sessionId)
    }
  }
}

/**
 * Broadcast an event to all WebSocket subscribers for a session
 */
function broadcastToSession(sessionId: string, event: unknown): void {
  const subscribers = sessionSubscriptions.get(sessionId)
  console.log(`[WS] Broadcasting to session ${sessionId}, subscribers: ${subscribers?.size || 0}`)
  if (subscribers) {
    const message = JSON.stringify(event)
    for (const ws of subscribers) {
      console.log(`[WS] Subscriber readyState: ${ws?.readyState}`)
      if (ws && ws.readyState === 1) { // WebSocket.OPEN with null check
        ws.send(message)
        console.log(`[WS] Sent message to subscriber`)
      }
    }
  }
}

/**
 * Wrap API responses in standard format for frontend compatibility
 */
function wrapResponse<T>(data: T, pagination?: { total: number; page: number; limit: number; totalPages: number; hasNext: boolean; hasPrev: boolean }) {
  return {
    success: true,
    data,
    ...(pagination && { pagination }),
  }
}

/**
 * Build EventData for WebSocket broadcast (matches frontend WatchmanEvent interface)
 */
function buildWsEventData(transformed: TransformedPayload): Record<string, unknown> {
  if (transformed.type === 'tool') {
    return {
      tool: transformed.tool || '',
      action: transformed.action?.includes('before') ? 'call' :
             transformed.action?.includes('failure') ? 'error' : 'result',
      input: transformed.source.tool_input || undefined,
      output: transformed.source.tool_response || undefined,
      error: transformed.action?.includes('failure') ? transformed.summary || undefined : undefined,
    }
  }

  if (transformed.type === 'user') {
    return {
      action: 'message',
      content: transformed.summary || '',
    }
  }

  if (transformed.type === 'session') {
    return {
      action: transformed.action?.includes('begin') ? 'started' : 'ended',
      sessionId: transformed.session,
    }
  }

  if (transformed.type === 'agent') {
    return {
      action: transformed.action?.includes('complete') ? 'stopped' : 'started',
      agentId: transformed.subAgentId || '',
      message: transformed.summary || undefined,
    }
  }

  // Default to system event
  return {
    level: 'info',
    message: transformed.summary || '',
    details: transformed.source,
  }
}

// POST /ingest - Receive trigger events
server.post('/ingest', async (request: FastifyRequest, reply: FastifyReply) => {
  const ingestStart = Date.now()

  try {
    const body = request.body as {
      data?: Record<string, unknown>
      context?: Record<string, string>
    }

    const payload = body.data || (body as Record<string, unknown>)
    const transformed = transformPayload(payload)

    itemCount++
    const now = new Date().toISOString()
    const tool = transformed.tool ? ` | ${transformed.tool}` : ''
    const subAgentName = transformed.subAgentName || transformed.subAgentId
    const subAgent = subAgentName ? ` | ${subAgentName}` : ''
    const typeColor = colorize(transformed.type)

    console.log(`${now} | ${itemCount} | ${typeColor}${transformed.type}${colors.reset} | ${transformed.session}${tool}${subAgent}`)

    if (transformed.summary) {
      console.log(`  ${transformed.summary.slice(0, 100)}${transformed.summary.length > 100 ? '...' : ''}`)
    }

    if (settings.verbose) {
      console.log(`  action: ${transformed.action}`)
      console.log(`  source keys: ${Object.keys(payload).join(', ')}`)
    }

    // Record event metrics
    recordEvent(transformed.type, transformed.action)

    // Auto-create session if it doesn't exist (prevents FOREIGN KEY constraint failure)
    const existingSession = await storage.getSession(transformed.session)
    if (!existingSession) {
      const projectName = transformed.projectName || 'default'
      const project = await storage.getOrCreateProject(projectName)
      await storage.createSession(transformed.session, project.id, {
        transcriptPath: transformed.transcriptPath,
      })
      recordSessionStart(transformed.session)
    }

    // Handle session lifecycle: end session when SessionEnd event is received
    if (transformed.action === 'session.end') {
      await storage.stopSession(transformed.session)
      recordSessionEnd(transformed.session)
    }

    // Track tool calls
    if (transformed.type === 'tool' && transformed.tool) {
      const isFailure = transformed.action?.includes('failure')
      recordToolCall(transformed.tool, isFailure ? 'failure' : 'success')
      if (isFailure) {
        recordError('tool_failure', transformed.tool)
      }
    }

    // Track agent spawns
    if (transformed.type === 'agent') {
      if (transformed.action?.includes('start')) {
        recordAgentSpawned(transformed.subAgentType || 'unknown')
        incrementActiveAgents()

        // Persist agent to database
        if (transformed.subAgentId && transformed.subAgentName) {
          try {
            await storage.upsertAgent({
              agentId: transformed.subAgentId,
              name: transformed.subAgentName,
              description: transformed.subAgentDescription,
              parentAgentId: transformed.ownerAgentId,
              sessionId: transformed.session,
            })
          } catch (error) {
            console.error('Failed to persist agent to database:', error)
          }
        }
      } else if (transformed.action?.includes('complete')) {
        decrementActiveAgents()
      }
    }

    // Track errors
    if (transformed.type === 'system' && transformed.action?.includes('halt')) {
      recordError('system_halt', null)
    }

    // Extract prompt from various possible fields
    const prompt = (transformed.source.last_assistant_message as string) 
      || (transformed.source.prompt as string)
      || (transformed.source.message as string)
      || null

    // Store event in SQLite
    const eventId = crypto.randomUUID()
    await storage.insertEvent({
      eventId,
      sessionId: transformed.session,
      type: transformed.type,
      action: transformed.action,
      tool: transformed.tool,
      toolUseId: transformed.toolUseId,
      agentId: transformed.subAgentId,
      ownerAgentId: transformed.ownerAgentId,
      subAgentType: transformed.subAgentType,
      skillType: transformed.skillType,
      timestamp: transformed.ts,
      summary: transformed.summary,
      prompt: prompt,
      output: null,
      inputData: (transformed.source.tool_input as Record<string, unknown>) || null,
      outputData: (transformed.source.tool_response as Record<string, unknown>) || null,
      metadata: transformed.metadata,
      source: transformed.source,
    })

    // Broadcast to WebSocket subscribers for this session
    const wsEventData = buildWsEventData(transformed)
    const projectName = transformed.projectName || 'default'

    const watchmanEvent = {
      id: eventId,
      sessionId: transformed.session,
      projectId: projectName,
      agentId: transformed.subAgentId || undefined,
      subAgentType: transformed.subAgentType || undefined,
      skillType: transformed.skillType || undefined,
      type: transformed.type,
      subtype: transformed.action || '',
      data: wsEventData,
      timestamp: new Date(transformed.ts).toISOString(),
      metadata: { source: JSON.stringify(transformed.source) },
    }

    broadcastToSession(transformed.session, {
      type: 'event',
      payload: watchmanEvent,
      timestamp: new Date().toISOString(),
    })

    // Record successful ingest
    recordIngestRequest('success')
    ingestDurationSeconds.observe((Date.now() - ingestStart) / 1000)

    return reply.status(201).send({
      received: true,
      eventId,
      ts: Date.now(),
    })
  } catch (error) {
    server.log.error(`Ingest error: ${error}`)
    recordIngestRequest('failure')
    ingestDurationSeconds.observe((Date.now() - ingestStart) / 1000)
    return reply.status(422).send({ failed: true, reason: 'Invalid payload' })
  }
})

// GET /status - Health check
server.get('/status', async () => {
  return {
    alive: true,
    uptime: process.uptime(),
    count: itemCount,
    version: settings.version,
  }
})

// GET /metrics - Prometheus metrics endpoint
server.get('/metrics', async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const metrics = await register.metrics()
    reply
      .type('text/plain; version=0.0.4; charset=utf-8')
      .send(metrics)
  } catch (error) {
    server.log.error(`Metrics error: ${error}`)
    return reply.status(500).send({ error: 'Failed to collect metrics' })
  }
})

// GET /api/stats - Global statistics
server.get('/api/stats', async () => {
  const stats = await storage.getStats()
  return wrapResponse(stats)
})

// GET /api/sessions - List all sessions with filtering and pagination
server.get('/api/sessions', async (
  request: FastifyRequest<{
    Querystring: {
      status?: 'active' | 'stopped'
      limit?: string
      offset?: string
      sortBy?: 'started_at' | 'stopped_at'
      sortOrder?: 'asc' | 'desc'
    }
  }>
) => {
  const status = request.query.status
  const limit = Math.min(parseInt(request.query.limit || '50', 10), 1000)
  const offset = parseInt(request.query.offset || '0', 10)
  const sortBy = request.query.sortBy || 'started_at'
  const sortOrder = request.query.sortOrder || 'desc'

  const result = await storage.getSessions(undefined, {
    status,
    limit,
    offset,
    sortBy,
    sortOrder,
  })

  const hasMore = offset + result.sessions.length < result.total

  return wrapResponse(result.sessions, {
    total: result.total,
    page: Math.floor(offset / limit) + 1,
    limit,
    totalPages: Math.ceil(result.total / limit),
    hasNext: hasMore,
    hasPrev: offset > 0,
  })
})

// GET /api/sessions/:id/events - Get paginated events for a session with filtering
server.get('/api/sessions/:id/events', async (
  request: FastifyRequest<{
    Params: { id: string }
    Querystring: {
      limit?: string;
      offset?: string;
      types?: string;
      actions?: string;
      tools?: string;
      agentIds?: string;
      search?: string;
      startTime?: string;
      endTime?: string;
      errorsOnly?: string;
    }
  }>,
  reply: FastifyReply
) => {
  const sessionId = request.params.id
  const limit = Math.min(parseInt(request.query.limit || '100', 10), 1000)
  const offset = parseInt(request.query.offset || '0', 10)

  if (isNaN(limit) || isNaN(offset) || limit < 0 || offset < 0) {
    return reply.status(400).send({ error: 'Invalid limit or offset' })
  }

  // Parse comma-separated params into arrays
  const types = request.query.types?.split(',').filter(Boolean)
  const actions = request.query.actions?.split(',').filter(Boolean)
  const tools = request.query.tools?.split(',').filter(Boolean)
  const agentIds = request.query.agentIds?.split(',').filter(Boolean)
  const errorsOnly = request.query.errorsOnly === 'true'

  const events = await storage.getEvents(sessionId, {
    limit,
    offset,
    types,
    actions,
    tools,
    agentIds,
    search: request.query.search,
    startTime: request.query.startTime ? parseInt(request.query.startTime, 10) : undefined,
    endTime: request.query.endTime ? parseInt(request.query.endTime, 10) : undefined,
    errorsOnly,
  })

  const total = await storage.getEventCount(sessionId)
  const totalPages = Math.ceil(total / limit)
  const page = Math.floor(offset / limit) + 1

  return wrapResponse(events, {
    total,
    page,
    limit,
    totalPages,
    hasNext: offset + limit < total,
    hasPrev: offset > 0,
  })
})

// GET /api/sessions/:id/stats - Get session-specific stats
server.get('/api/sessions/:id/stats', async (
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply
) => {
  const sessionId = request.params.id
  const stats = await storage.getSessionStats(sessionId)

  if (!stats) {
    return reply.status(404).send({ success: false, error: 'Session not found' })
  }

  return wrapResponse(stats)
})

// WebSocket endpoint: /events?session=<sessionId>
server.get('/events', { websocket: true }, (socket /* WebSocket */, req /* FastifyRequest */) => {
  const url = new URL(req.url || '', `http://localhost:${settings.port}`)
  const sessionId = url.searchParams.get('session')

  if (!sessionId) {
    socket.close(1008, 'Missing session parameter')
    return
  }

  console.log(`WebSocket connected for session: ${sessionId}`)

  // Track WebSocket connections
  incrementWebSocketConnections()

  // Subscribe the WebSocket to this session
  subscribeToSession(sessionId, socket)

  socket.on('message', (message: Buffer) => {
    try {
      const data = JSON.parse(message.toString())
      // Echo back for ping/pong or handle client messages
      if (data.type === 'ping') {
        socket.send(JSON.stringify({ type: 'pong', ts: Date.now() }))
      }
    } catch {
      // Ignore invalid messages
    }
  })

  socket.on('close', () => {
    console.log(`WebSocket disconnected for session: ${sessionId}`)
    decrementWebSocketConnections()
    unsubscribeFromAllSessions(socket)
  })

  socket.on('error', (error: Error) => {
    console.error(`WebSocket error for session ${sessionId}:`, error)
    decrementWebSocketConnections()
    unsubscribeFromAllSessions(socket)
  })

  // Send initial connection confirmation
  socket.send(JSON.stringify({
    type: 'connected',
    session: sessionId,
    ts: Date.now(),
  }))
})

// Start server on port 4990
const PORT = parseInt(process.env.PORT || '4990', 10)
const HOST = process.env.HOST || '127.0.0.1'

server.listen({ port: PORT, host: HOST }, (err: Error | null) => {
  if (err) {
    server.log.error(err)
    process.exit(1)
  }
  console.log(`Watchman listening at http://${HOST}:${PORT}`)
  console.log(`  Ingest:    http://${HOST}:${PORT}/ingest`)
  console.log(`  Status:    http://${HOST}:${PORT}/status`)
  console.log(`  Stats:     http://${HOST}:${PORT}/api/stats`)
  console.log(`  Metrics:   http://${HOST}:${PORT}/metrics`)
  console.log(`  Sessions:  http://${HOST}:${PORT}/api/sessions`)
  console.log(`  Events WS: ws://${HOST}:${PORT}/events?session=<sessionId>`)
})