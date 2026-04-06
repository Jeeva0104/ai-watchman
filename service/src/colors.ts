// ANSI color codes for event type styling

export const colors = {
  session: '\x1b[32m',    // Green
  user: '\x1b[33m',       // Yellow  
  tool: '\x1b[36m',       // Cyan
  system: '\x1b[35m',     // Magenta
  progress: '\x1b[34m',   // Blue
  assistant: '\x1b[35m',  // Magenta (same as system)
  unknown: '\x1b[90m',    // Gray
  reset: '\x1b[0m',       // Reset to default
}

export function colorize(type: string): string {
  const colorMap: Record<string, string> = colors
  return colorMap[type] || colors.unknown
}

export function formatWithColor(type: string, text: string): string {
  const color = colorize(type)
  const reset = colors.reset
  return `${color}${text}${reset}`
}