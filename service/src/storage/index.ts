import { SQLiteAdapter } from './sqlite-adapter.js'
import type { StorageAdapter } from './types.js'

export * from './types.js'
export { SQLiteAdapter } from './sqlite-adapter.js'

export function createStorageAdapter(type: 'sqlite', dbPath?: string): StorageAdapter {
  if (type === 'sqlite') {
    const path = dbPath || process.env.DATABASE_PATH || './data/watchman.db'
    return new SQLiteAdapter(path)
  }
  throw new Error(`Unsupported storage type: ${type}`)
}

// Create singleton storage instance
export const storage = createStorageAdapter('sqlite')
