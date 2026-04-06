import type { LucideIcon } from 'lucide-react'
import {
  Flag,
  Square,
  Bomb,
  MessageSquare,
  MessageCircle,
  Wrench,
  Terminal,
  FileText,
  FilePlus,
  FileEdit,
  UserCircle,
  FolderSearch,
  FileSearch,
  Globe,
  Download,
  CheckCircle,
  XCircle,
  Moon,
  ClipboardList,
  Lock,
  Bell,
  Settings,
  FolderOpen,
  Minimize2,
  HelpCircle,
  GitBranch,
  Trash2,
  Hourglass,
  User,
  Pin,
  Play,
  Sliders,
} from 'lucide-react'

export const eventIcons: Record<string, LucideIcon> = {
  // Event types (ai-watchman style)
  tool: Wrench,
  agent: UserCircle,
  user: User,
  system: Settings,
  session: Play,

  // Session lifecycle
  SessionStart: Play,
  SessionEnd: Flag,
  Stop: Square,
  StopFailure: Bomb,

  // User input
  UserPromptSubmit: MessageSquare,
  UserPromptSubmitResponse: MessageCircle,

  // Tool use — logical keys by tool name (each tool has a unique icon)
  Bash: Terminal,
  Read: FileText,
  Write: FilePlus,
  Edit: FileEdit,
  Agent: UserCircle,
  Glob: FolderSearch,
  Grep: FileSearch,
  WebSearch: Globe,
  WebFetch: Download,

  // Generic tool fallbacks
  _ToolDefault: Wrench,
  _ToolSuccess: CheckCircle,
  _ToolFailure: XCircle,

  // Agents & teams - use purple (agent colors)
  SubagentStart: UserCircle,
  SubagentStop: UserCircle,
  TeammateIdle: Moon,

  // Tasks
  TaskCreated: ClipboardList,
  TaskCompleted: CheckCircle,

  // Permissions
  PermissionRequest: Lock,

  // Notifications
  Notification: Bell,

  // Config & files
  InstructionsLoaded: FileText,
  ConfigChange: Sliders,
  CwdChanged: FolderOpen,
  FileChanged: FileEdit,

  // Compaction
  PreCompact: Minimize2,
  PostCompact: Minimize2,

  // MCP
  Elicitation: HelpCircle,
  ElicitationResult: MessageSquare,

  // Worktrees
  WorktreeCreate: GitBranch,
  WorktreeRemove: Trash2,

  // Legacy / transcript format
  progress: Hourglass,
  agent_progress: UserCircle,
  stop_hook_summary: Square,
  assistant: UserCircle,
}

export const defaultEventIcon: LucideIcon = Pin

// Color classes for event icons: [stream icon color, solid bg for timeline dots]
// Using semantic colors to group related event types
export const eventColors: Record<string, [string, string]> = {
  // Event types (ai-watchman style)
  tool: ['text-blue-600 dark:text-blue-400', 'bg-blue-600 dark:bg-blue-500'],
  agent: ['text-purple-600 dark:text-purple-400', 'bg-purple-600 dark:bg-purple-500'],
  user: ['text-green-600 dark:text-green-400', 'bg-green-600 dark:bg-green-500'],
  system: ['text-orange-600 dark:text-orange-400', 'bg-orange-600 dark:bg-orange-500'],
  session: ['text-yellow-600 dark:text-yellow-400', 'bg-yellow-600 dark:bg-yellow-500'],

  // Session lifecycle — yellow
  SessionStart: ['text-yellow-600 dark:text-yellow-400', 'bg-yellow-600 dark:bg-yellow-500'],
  SessionEnd: ['text-yellow-600 dark:text-yellow-400', 'bg-yellow-600 dark:bg-yellow-500'],
  Stop: ['text-yellow-600 dark:text-yellow-400', 'bg-yellow-600 dark:bg-yellow-500'],
  StopFailure: ['text-red-600 dark:text-red-400', 'bg-red-600 dark:bg-red-500'],
  stop_hook_summary: ['text-yellow-600 dark:text-yellow-400', 'bg-yellow-600 dark:bg-yellow-500'],

  // User input — green
  UserPromptSubmit: ['text-green-600 dark:text-green-400', 'bg-green-600 dark:bg-green-500'],
  UserPromptSubmitResponse: ['text-green-600 dark:text-green-400', 'bg-green-600 dark:bg-green-500'],

  // Tool use — blue (by tool name)
  Bash: ['text-blue-600 dark:text-blue-400', 'bg-blue-600 dark:bg-blue-500'],
  Read: ['text-blue-600 dark:text-blue-400', 'bg-blue-600 dark:bg-blue-500'],
  Write: ['text-blue-600 dark:text-blue-400', 'bg-blue-600 dark:bg-blue-500'],
  Edit: ['text-blue-600 dark:text-blue-400', 'bg-blue-600 dark:bg-blue-500'],
  Glob: ['text-blue-600 dark:text-blue-400', 'bg-blue-600 dark:bg-blue-500'],
  Grep: ['text-blue-600 dark:text-blue-400', 'bg-blue-600 dark:bg-blue-500'],
  WebSearch: ['text-blue-600 dark:text-blue-400', 'bg-blue-600 dark:bg-blue-500'],
  WebFetch: ['text-blue-600 dark:text-blue-400', 'bg-blue-600 dark:bg-blue-500'],

  // Generic tool fallbacks
  _ToolDefault: ['text-blue-600 dark:text-blue-400', 'bg-blue-600 dark:bg-blue-500'],
  _ToolSuccess: ['text-blue-600 dark:text-blue-400', 'bg-blue-600 dark:bg-blue-500'],
  _ToolFailure: ['text-red-600 dark:text-red-400', 'bg-red-600 dark:bg-red-500'],

  // Agents — purple
  Agent: ['text-purple-600 dark:text-purple-400', 'bg-purple-600 dark:bg-purple-500'],
  SubagentStart: ['text-purple-600 dark:text-purple-400', 'bg-purple-600 dark:bg-purple-500'],
  SubagentStop: ['text-purple-600 dark:text-purple-400', 'bg-purple-600 dark:bg-purple-500'],
  TeammateIdle: ['text-purple-600 dark:text-purple-400', 'bg-purple-600 dark:bg-purple-500'],
  assistant: ['text-purple-600 dark:text-purple-400', 'bg-purple-600 dark:bg-purple-500'],
  agent_progress: ['text-purple-600 dark:text-purple-400', 'bg-purple-600 dark:bg-purple-500'],

  // Tasks — cyan
  TaskCreated: ['text-cyan-600 dark:text-cyan-400', 'bg-cyan-600 dark:bg-cyan-500'],
  TaskCompleted: ['text-cyan-600 dark:text-cyan-400', 'bg-cyan-600 dark:bg-cyan-500'],

  // Permissions — rose
  PermissionRequest: ['text-rose-600 dark:text-rose-400', 'bg-rose-600 dark:bg-rose-500'],

  // Notifications — sky
  Notification: ['text-sky-600 dark:text-sky-400', 'bg-sky-600 dark:bg-sky-500'],

  // Config & files — slate/gray
  InstructionsLoaded: ['text-slate-600 dark:text-slate-400', 'bg-slate-600 dark:bg-slate-500'],
  ConfigChange: ['text-slate-600 dark:text-slate-400', 'bg-slate-600 dark:bg-slate-500'],
  CwdChanged: ['text-slate-600 dark:text-slate-400', 'bg-slate-600 dark:bg-slate-500'],
  FileChanged: ['text-slate-600 dark:text-slate-400', 'bg-slate-600 dark:bg-slate-500'],

  // Compaction — gray
  PreCompact: ['text-gray-500 dark:text-gray-400', 'bg-gray-500 dark:bg-gray-400'],
  PostCompact: ['text-gray-500 dark:text-gray-400', 'bg-gray-500 dark:bg-gray-400'],

  // MCP — indigo
  Elicitation: ['text-indigo-600 dark:text-indigo-400', 'bg-indigo-600 dark:bg-indigo-500'],
  ElicitationResult: ['text-indigo-600 dark:text-indigo-400', 'bg-indigo-600 dark:bg-indigo-500'],

  // Worktrees — teal
  WorktreeCreate: ['text-teal-600 dark:text-teal-400', 'bg-teal-600 dark:bg-teal-500'],
  WorktreeRemove: ['text-teal-600 dark:text-teal-400', 'bg-teal-600 dark:bg-teal-500'],

  // Progress — amber
  progress: ['text-amber-600 dark:text-amber-400', 'bg-amber-600 dark:bg-amber-500'],
}

const defaultEventColor: [string, string] = ['text-muted-foreground', 'bg-muted-foreground']

/**
 * Resolve an event to its logical icon/color key.
 * Tool events resolve by toolName (e.g., "Bash", "Edit").
 * Agent events resolve to 'agent' for proper icon/color lookup.
 * Non-tool events resolve by subtype (e.g., "SessionStart").
 */
export function resolveEventKey(subtype: string | null, toolName?: string | null, eventType?: string | null): string {
  const isTool = subtype === 'PreToolUse' || subtype === 'PostToolUse' || subtype === 'PostToolUseFailure' ||
                 subtype === 'tool.before' || subtype === 'tool.after' || subtype === 'tool.failure'
  if (isTool && toolName) return toolName
  
  // Agent events: resolve to 'agent' key for proper icon/color
  if (eventType === 'agent') {
    return 'agent'
  }
  
  return subtype || 'unknown'
}

/**
 * Determine the tool fallback key based on the event subtype.
 */
function toolFallbackKey(subtype: string | null): string {
  if (subtype === 'PostToolUseFailure' || subtype === 'tool.failure') return '_ToolFailure'
  if (subtype === 'PostToolUse' || subtype === 'tool.after') return '_ToolSuccess'
  return '_ToolDefault'
}

export function getEventColor(subtype: string | null, toolName?: string | null, eventType?: string | null): { iconColor: string; dotColor: string } {
  const key = resolveEventKey(subtype, toolName, eventType)
  const isTool = subtype === 'PreToolUse' || subtype === 'PostToolUse' || subtype === 'PostToolUseFailure' ||
                 subtype === 'tool.before' || subtype === 'tool.after' || subtype === 'tool.failure'

  // Fall back to defaults
  let color = eventColors[key]
  if (!color && isTool) {
    color = eventColors[toolFallbackKey(subtype)]
  }
  const [iconColor, dotColor] = color || defaultEventColor
  return { iconColor, dotColor }
}

export function getEventIcon(subtype: string | null, toolName?: string | null, eventType?: string | null): LucideIcon {
  const key = resolveEventKey(subtype, toolName, eventType)
  const isTool = subtype === 'PreToolUse' || subtype === 'PostToolUse' || subtype === 'PostToolUseFailure' ||
                 subtype === 'tool.before' || subtype === 'tool.after' || subtype === 'tool.failure'

  // Fall back to defaults
  if (eventIcons[key]) {
    return eventIcons[key]
  }
  if (isTool) {
    return eventIcons[toolFallbackKey(subtype)] || defaultEventIcon
  }
  return defaultEventIcon
}
