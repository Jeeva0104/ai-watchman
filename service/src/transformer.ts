import type { TransformedPayload } from './types.js'
import { computeSummary } from './summarize.js'

export function transformPayload(source: Record<string, unknown>): TransformedPayload {
  const projectName = (source.project_name as string) || null
  const session = (source.session_id as string) || (source.sessionId as string) || 'unknown'
  const slug = (source.slug as string) || null
  const transcriptPath = (source.transcript_path as string) || null
  const ts = parseTime(source.ts || source.timestamp)
  const toolUseId = (source.tool_use_id as string) || null
  const ownerAgentId = (source.agent_id as string) || null

  let type: string
  let action: string | null = null
  let tool: string | null = null
  let subAgentId: string | null = null
  let subAgentName: string | null = null
  let subAgentDescription: string | null = null
  let subAgentType: string | null = null
  let skillType: string | null = null

  const hookName = source.hook_event_name as string | undefined

  if (hookName) {
    const hookTool = source.tool_name as string | undefined
    const toolInput = source.tool_input as Record<string, unknown> | undefined

    switch (hookName) {
      case 'SessionStart':
        type = 'session'
        action = 'session.begin'
        break
      case 'SessionEnd':
        type = 'session'
        action = 'session.end'
        break
      case 'UserPromptSubmit':
        type = 'user'
        action = 'user.input'
        break
      case 'PreToolUse':
        type = 'tool'
        action = 'tool.before'
        tool = hookTool || null
        if (tool === 'Agent') {
          subAgentName = (toolInput?.name as string) || null
          subAgentDescription = (toolInput?.description as string) || null
          subAgentType = (toolInput?.subagent_type as string) || null
        } else if (tool === 'Skill') {
          skillType = (toolInput?.skill_type as string) || (toolInput?.skill as string) || null
        }
        break
      case 'PostToolUse':
        type = 'tool'
        action = 'tool.after'
        tool = hookTool || null
        if (tool === 'Agent') {
          const toolResponse = source.tool_response as Record<string, unknown> | undefined
          if (toolResponse) {
            subAgentId = (toolResponse.agentId as string) || null
            subAgentName = (toolInput?.name as string) || null
            subAgentDescription = (toolInput?.description as string) || null
            subAgentType = (toolInput?.subagent_type as string) || null
          }
        } else if (tool === 'Skill') {
          skillType = (toolInput?.skill_type as string) || (toolInput?.skill as string) || null
        }
        break
      case 'Stop':
        type = 'system'
        action = 'system.halt'
        break
      case 'SubagentStop':
        type = 'agent'
        action = 'agent.complete'
        subAgentId = (source.agent_id as string) || null
        break
      case 'SubagentStart':
        type = 'agent'
        action = 'agent.start'
        subAgentId = (source.agent_id as string) || null
        break
      case 'PostToolUseFailure':
        type = 'tool'
        action = 'tool.failure'
        tool = hookTool || null
        break
      case 'Notification':
        type = 'system'
        action = 'system.notify'
        break
      default:
        type = 'system'
        action = hookName
        break
    }
  } else {
    type = (source.type as string) || 'unknown'
    action = (source.subtype as string) || null

    const data = source.data as Record<string, unknown> | undefined
    const message = source.message as Record<string, unknown> | undefined
    const toolUseResult = source.toolUseResult as Record<string, unknown> | undefined

    if (type === 'progress' && data) {
      const dataType = data.type as string
      if (dataType === 'hook_progress') {
        action = (data.hookEvent as string) || null
        const hookName = data.hookName as string
        if (hookName?.includes(':')) {
          tool = hookName.split(':').slice(1).join(':')
        }
      }
      if (dataType === 'agent_progress') {
        action = 'agent.progress'
        subAgentId = (data.agentId as string) || null
      }
    }

    if (type === 'assistant' && message) {
      const content = message.content as unknown[]
      if (Array.isArray(content)) {
        const toolUse = content.find((c: any) => c.type === 'tool_use') as Record<string, unknown> | undefined
        if (toolUse) {
          tool = (toolUse.name as string) || null
          if (tool === 'Agent') {
            const input = toolUse.input as Record<string, unknown> | undefined
            subAgentName = (input?.name as string) || null
            subAgentDescription = (input?.description as string) || null
            subAgentType = (input?.subagent_type as string) || null
          } else if (tool === 'Skill') {
            const input = toolUse.input as Record<string, unknown> | undefined
            skillType = (input?.skill_type as string) || (input?.skill as string) || null
          }
        }
      }
    }

    if (toolUseResult) {
      subAgentId = (toolUseResult.agentId as string) || subAgentId
    }
  }

  const metadata: Record<string, unknown> = {}
  for (const key of ['version', 'gitBranch', 'cwd', 'entrypoint', 'permissionMode', 'userType', 'permission_mode']) {
    if (source[key] !== undefined) metadata[key] = source[key]
  }

  const summary = computeSummary(source, type, action, tool)

  return {
    projectName,
    session,
    slug,
    transcriptPath,
    type,
    action,
    tool,
    toolUseId,
    ts,
    ownerAgentId,
    subAgentId,
    subAgentName,
    subAgentDescription,
    subAgentType,
    skillType,
    metadata,
    source,
    summary,
  }
}

function parseTime(val: unknown): number {
  if (typeof val === 'number') return val
  if (typeof val === 'string') {
    const parsed = new Date(val).getTime()
    return isNaN(parsed) ? Date.now() : parsed
  }
  return Date.now()
}