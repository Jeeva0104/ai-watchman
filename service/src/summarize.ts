import type { TransformedPayload } from './types.js'

export function computeSummary(source: Record<string, unknown>, type: string, action: string | null, tool: string | null): string {
  switch (action) {
    case 'user.input':
      return (source.prompt as string) || (source.message as any)?.content || ''

    case 'tool.before':
    case 'tool.after':
    case 'tool.failure':
      return getToolSummary(tool, source.tool_input as Record<string, unknown>)

    case 'system.halt':
      return (source.last_assistant_message as string) || 'Session stopped'

    case 'agent.complete':
      return (source.last_assistant_message as string) || 'Agent stopped'

    case 'system.notify':
      return (source.message as string) || (source.title as string) || 'Notification'

    case 'session.begin':
      return (source.source as string) ? `Session ${source.source}` : 'New session'

    default:
      return ''
  }
}

function getToolSummary(toolName: string | null, toolInput: Record<string, unknown> | undefined): string {
  if (!toolInput) return ''

  switch (toolName) {
    case 'Bash': {
      const desc = toolInput.description as string
      const cmd = toolInput.command as string
      return desc || (cmd ? cmd.replace(/\s*\n\s*/g, ' ').trim() : '')
    }

    case 'Read':
    case 'Write':
      return (toolInput.file_path as string) || ''

    case 'Edit': {
      const fp = toolInput.file_path as string
      return fp || ''
    }

    case 'Grep': {
      const pattern = toolInput.pattern as string
      const path = toolInput.path as string
      if (pattern && path) return `/${pattern}/ in ${path}`
      if (pattern) return `/${pattern}/`
      return ''
    }

    case 'Glob':
      return (toolInput.pattern as string) || ''

    case 'Agent':
      return (toolInput.description as string) || (toolInput.prompt as string) || ''

    case 'Skill':
      return (toolInput.skill as string) || ''

    case 'WebSearch':
    case 'WebFetch':
      return (toolInput.query as string) || (toolInput.url as string) || ''

    case 'NotebookEdit':
      return (toolInput.notebook_path as string) || ''

    default:
      return (toolInput.description as string) || (toolInput.command as string) || (toolInput.query as string) || ''
  }
}