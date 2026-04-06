// utils/settings.mjs
// Configuration loader for AI Watchman CLI

import { resolve } from 'node:path'

export function loadSettings(overrides = {}) {
  const port = process.env.AI_WATCHMAN_PORT || '4990'
  const apiUrl = overrides.endpoint || process.env.AI_WATCHMAN_URL || `http://127.0.0.1:${port}`
  const origin = new URL(apiUrl).origin

  return {
    port,
    apiUrl,
    origin,
    logLevel: (process.env.AI_WATCHMAN_LEVEL || 'alert').toLowerCase(),
    logDir: resolve(process.env.HOME || '.', '.ai-watchman/logs'),
    project: overrides.project || process.env.AI_WATCHMAN_PROJECT || null,
  }
}