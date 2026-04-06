import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { httpRequestDurationSeconds } from './index.js'

// WeakMap for type-safe request metadata
const requestStartTimes = new WeakMap<FastifyRequest, number>()

/**
 * Middleware to track HTTP request duration
 */
export function metricsMiddleware(fastify: FastifyInstance): void {
  // Record start time on each request
  fastify.addHook('onRequest', async (request: FastifyRequest) => {
    requestStartTimes.set(request, Date.now())
  })

  // Record duration on each response
  fastify.addHook('onResponse', async (request: FastifyRequest, reply: FastifyReply) => {
    const startTime = requestStartTimes.get(request)
    const duration = (Date.now() - (startTime || Date.now())) / 1000
    const route = (request as any).routeOptions?.url || request.url.split('?')[0]

    // Skip metrics endpoint to avoid recursion
    if (route === '/metrics') {
      return
    }

    httpRequestDurationSeconds.observe(
      {
        method: request.method,
        route: route || 'unknown',
        status_code: reply.statusCode.toString(),
      },
      duration
    )

    // Cleanup
    requestStartTimes.delete(request)
  })
}
