// utils/request.mjs
// HTTP utilities for AI Watchman CLI

import { request } from 'node:http'
import { request as httpsRequest } from 'node:https'

const DEFAULT_TIMEOUT = 5000

export function makeRequest(url, options, body) {
  const parsed = new URL(url)
  const transport = parsed.protocol === 'https:' ? httpsRequest : request
  const fireAndForget = options.fireAndForget || false
  const log = options.log

  log?.trace(`HTTP ${options.method} to ${url}`)

  return new Promise((resolve) => {
    const req = transport(
      {
        hostname: parsed.hostname,
        port: parsed.port,
        path: parsed.pathname + parsed.search,
        method: options.method || 'GET',
        headers: options.headers || {},
        timeout: DEFAULT_TIMEOUT,
      },
      (res) => {
        let data = ''
        res.on('data', (chunk) => { data += chunk })
        res.on('end', () => {
          try {
            resolve({ status: res.statusCode, body: JSON.parse(data) })
          } catch {
            resolve({ status: res.statusCode, body: data })
          }
        })
      },
    )

    if (fireAndForget) {
      req.on('socket', (socket) => { socket.unref() })
    }

    req.on('error', (err) => {
      log?.error(`Request failed: ${err}`)
      resolve({ status: 0, body: null, error: err.message })
    })

    req.on('timeout', () => {
      log?.warn(`Request timeout: ${url}`)
      req.destroy()
      resolve({ status: 0, body: null, error: 'timeout' })
    })

    if (body) req.write(body)
    req.end()
  })
}

export function sendRequest(url, data, { fireAndForget = false, log } = {}) {
  const body = JSON.stringify(data)
  return makeRequest(
    url,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
      },
      fireAndForget,
      log,
    },
    body,
  )
}

export function fetchStatus(url, { log } = {}) {
  return makeRequest(url, { method: 'GET', log }, null)
}