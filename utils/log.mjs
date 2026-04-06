// utils/log.mjs
// Logging utility for AI Watchman CLI

import { appendFileSync, statSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { join, sep, resolve, basename, dirname } from 'node:path'

const MAX_SIZE = 1_048_576 // 1MB
const PRUNE_TO = 524_288    // 500KB

export function createLogWriter(filename, config) {
  const verbose = config.logLevel === 'verbose'
  const full = resolve(config.logDir, filename)
  const safeDir = resolve(config.logDir) + sep
  const logFile = full.startsWith(safeDir) ? full : join(config.logDir, basename(filename))

  let dirCreated = false

  function ensureDir() {
    if (!dirCreated) {
      mkdirSync(dirname(logFile), { recursive: true })
      dirCreated = true
    }
  }

  function pruneIfNeeded() {
    try {
      const stat = statSync(logFile)
      if (stat.size > MAX_SIZE) {
        const content = readFileSync(logFile, 'utf8')
        const tail = content.slice(-PRUNE_TO)
        const firstNewline = tail.indexOf('\n')
        const pruned = firstNewline >= 0 ? tail.slice(firstNewline + 1) : tail
        writeFileSync(logFile, pruned)
      }
    } catch {
      // File doesn't exist yet
    }
  }

  function write(level, msg) {
    ensureDir()
    pruneIfNeeded()
    const timestamp = new Date().toISOString()
    appendFileSync(logFile, `${timestamp} [${level}] ${msg}\n`)
  }

  return {
    error(msg) {
      write('ERROR', msg)
      console.error(`[ai-watchman] ${msg}`)
    },
    alert(msg) {
      write('ALERT', msg)
      console.error(`[ai-watchman] ${msg}`)
    },
    info(msg) {
      if (verbose) write('INFO', msg)
      console.error(`[ai-watchman] ${msg}`)
    },
    verbose(msg) {
      if (!verbose) return
      write('VERBOSE', msg)
      console.error(`[ai-watchman] ${msg}`)
    },
    trace(msg) {
      if (!verbose) return
      write('TRACE', msg)
      console.error(`[ai-watchman] ${msg}`)
    },
  }
}