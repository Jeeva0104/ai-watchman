export const settings = {
  name: 'ai-watchman',
  version: '1.0.0',
  port: parseInt(process.env.AI_WATCHMAN_PORT || '4990', 10),
  logLevel: (process.env.AI_WATCHMAN_LEVEL || 'verbose').toLowerCase(),
  verbose: (process.env.AI_WATCHMAN_LEVEL || 'verbose').toLowerCase() === 'verbose',
}