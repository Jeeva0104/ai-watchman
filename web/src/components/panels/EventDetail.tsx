import { useState } from 'react';
import { useAppStore } from '../../stores/app-store';
import { Copy, Check, ChevronDown, ChevronRight } from 'lucide-react';

export function EventDetail() {
  const selectedEventId = useAppStore((state) => state.selectedEventId);
  const events = useAppStore((state) => state.events);

  const selectedEvent = events.find((e) => e.id === selectedEventId);
  const [showRawPayload, setShowRawPayload] = useState(false);
  const [copied, setCopied] = useState(false);

  if (!selectedEvent) {
    return (
      <div className="h-full flex flex-col bg-bg-primary">
        <div className="px-4 py-3 bg-bg-surface border-b border-border flex items-center justify-between h-[40px] shrink-0">
          <span className="text-[11px] uppercase tracking-wider text-text-secondary">
            Event Detail
          </span>
          <span className="text-[11px] text-text-secondary">-</span>
        </div>
        <div className="flex-1 flex items-center justify-center text-text-secondary px-6">
          <p className="text-sm">Select an event to view details</p>
        </div>
      </div>
    );
  }

  const formatTimestamp = (timestamp: string): string => {
    const date = new Date(timestamp);
    return date.toISOString();
  };

  // Extract data from event
  const data = selectedEvent.data as unknown as Record<string, unknown>;

  const getCwd = (): string | null => {
    return (data?.cwd as string) || null;
  };

  const getPermissionMode = (): string | null => {
    return (data?.permission_mode as string) || null;
  };

  const getTranscriptPath = (): string | null => {
    return (data?.transcript_path as string) || null;
  };

  const getToolResponse = (): unknown => {
    return data?.tool_response;
  };

  const getHookEventName = (): string | null => {
    return (data?.hook_event_name as string) || null;
  };

  const getPrompt = (): string | null => {
    const d = data as {
      content?: string;
      message?: string;
      prompt?: string;
      last_assistant_message?: string;
    };
    return d?.last_assistant_message
      || d?.content
      || d?.message
      || d?.prompt
      || null;
  };

  const getToolInput = (): Record<string, unknown> | null => {
    return (data?.input as Record<string, unknown>) || null;
  };

  const getToolName = (): string | null => {
    const name = data?.tool_name;
    if (typeof name === 'string') {
      return String(name);
    }
    const tool = data?.tool;
    if (typeof tool === 'string') {
      return String(tool);
    }
    return null;
  };

  // Format tool response for display
  const formatToolResponse = (response: unknown): string => {
    if (!response) return '';
    if (typeof response === 'string') return response;

    // Handle Bash format: { stdout, stderr }
    const r = response as Record<string, unknown>;
    if (r.stdout !== undefined || r.stderr !== undefined) {
      const parts = [];
      if (r.stdout) parts.push(String(r.stdout));
      if (r.stderr) parts.push(`stderr: ${String(r.stderr)}`);
      return parts.join('\n') || '';
    }

    // Handle MCP format: array of content blocks
    if (Array.isArray(response)) {
      return response.map((item) => {
        if (typeof item === 'string') return item;
        if (typeof item === 'object' && item !== null && 'type' in item && item.type === 'text' && 'text' in item) {
          return String(item.text);
        }
        return JSON.stringify(item);
      }).join('\n');
    }

    return JSON.stringify(response, null, 2);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(JSON.stringify(data, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const prompt = getPrompt();
  const cwd = getCwd();
  const permissionMode = getPermissionMode();
  const transcriptPath = getTranscriptPath();
  const toolResponse = getToolResponse();
  const hookEventName = getHookEventName();
  const toolInput = getToolInput();
  const resolvedToolName = getToolName();

  return (
    <div className="h-full flex flex-col bg-bg-primary">

      <div className="px-4 py-3 bg-bg-surface border-b border-border flex items-center justify-between h-[40px] shrink-0">
        <span className="text-[11px] uppercase tracking-wider text-text-secondary">
          Event Detail
        </span>
        <span className="text-[11px] text-accent-cyan">#{selectedEvent.id.slice(0, 4)}</span>
      </div>


      <div className="flex-1 overflow-y-auto p-4 space-y-5">

        <div className="space-y-1.5">
          <div className="text-[10px] uppercase tracking-wider text-text-secondary">
            Session ID
          </div>
          <div className="text-xs text-accent-cyan font-mono break-all">
            {selectedEvent.sessionId}
          </div>
        </div>


        <div className="space-y-1.5">
          <div className="text-[10px] uppercase tracking-wider text-text-secondary">
            Timestamp
          </div>
          <div className="text-xs text-text-primary font-mono">
            {formatTimestamp(selectedEvent.timestamp)}
          </div>
        </div>


        {hookEventName && (
          <div className="space-y-1.5">
            <div className="text-[10px] uppercase tracking-wider text-text-secondary">
              Hook Event
            </div>
            <div className="text-xs text-accent-yellow font-mono">
              {hookEventName}
            </div>
          </div>
        )}


        <div className="space-y-1.5">
          <div className="text-[10px] uppercase tracking-wider text-text-secondary">
            Type / Action
          </div>
          <div className="text-xs font-mono">
            <span className="text-accent-cyan">{selectedEvent.type}</span>
            <span className="text-text-secondary"> / </span>
            <span className="text-accent-cyan">{selectedEvent.subtype || '-'}</span>
          </div>
        </div>


        {resolvedToolName && (
          <div className="space-y-1.5">
            <div className="text-[10px] uppercase tracking-wider text-text-secondary">
              Tool
            </div>
            <div className="text-xs text-accent-purple font-mono">
              {resolvedToolName}
            </div>
          </div>
        )}

        {selectedEvent.subAgentType && (
          <div className="space-y-1.5">
            <div className="text-[10px] uppercase tracking-wider text-text-secondary">
              Subagent Type
            </div>
            <div className="text-xs text-accent-purple font-medium">
              {selectedEvent.subAgentType}
            </div>
          </div>
        )}

        {selectedEvent.skillType && (
          <div className="space-y-1.5">
            <div className="text-[10px] uppercase tracking-wider text-text-secondary">
              Skill Type
            </div>
            <div className="text-xs text-accent-yellow font-medium">
              {selectedEvent.skillType}
            </div>
          </div>
        )}

        {cwd && (
          <div className="space-y-1.5">
            <div className="text-[10px] uppercase tracking-wider text-text-secondary">
              Working Directory
            </div>
            <div className="text-xs text-text-primary font-mono break-all">
              {cwd}
            </div>
          </div>
        )}


        {permissionMode && (
          <div className="space-y-1.5">
            <div className="text-[10px] uppercase tracking-wider text-text-secondary">
              Permission Mode
            </div>
            <div className={`text-xs font-mono uppercase ${permissionMode === 'plan' ? 'text-accent-yellow' : 'text-accent-green'
              }`}>
              {permissionMode}
            </div>
          </div>
        )}


        {transcriptPath && (
          <div className="space-y-1.5">
            <div className="text-[10px] uppercase tracking-wider text-text-secondary">
              Transcript Path
            </div>
            <div className="text-xs text-text-secondary font-mono break-all">
              {transcriptPath}
            </div>
          </div>
        )}


        {toolInput && (
          <div className="space-y-1.5">
            <div className="text-[10px] uppercase tracking-wider text-text-secondary">
              Tool Input
            </div>
            <pre className="text-[10px] text-text-primary font-mono bg-bg-surface border border-border rounded p-3 overflow-x-auto border-l-2 border-l-accent-cyan">
              {JSON.stringify(toolInput, null, 2)}
            </pre>
          </div>
        )}


        {toolResponse !== null && toolResponse !== undefined ? (
          <div className="space-y-1.5">
            <div className="text-[10px] uppercase tracking-wider text-text-secondary">
              Tool Response
            </div>
            <pre className="text-[10px] text-text-primary font-mono bg-bg-surface border border-border rounded p-3 overflow-x-auto border-l-2 border-l-accent-green max-h-60 overflow-y-auto">
              {formatToolResponse(toolResponse)}
            </pre>
          </div>
        ) : null}


        {prompt && (
          <div className="space-y-1.5">
            <div className="text-[10px] uppercase tracking-wider text-text-secondary">
              Prompt
            </div>
            <div className="text-xs text-text-primary leading-relaxed bg-bg-surface border border-border rounded p-3 border-l-2 border-l-accent-cyan">
              {prompt}
            </div>
          </div>
        )}


        <div className="space-y-1.5">
          <div className="text-[10px] uppercase tracking-wider text-text-secondary">
            Agent ID
          </div>
          <div className="text-xs text-text-primary font-mono">
            {selectedEvent.agentId || '-'}
          </div>
        </div>


        <div className="space-y-1.5">
          <div className="text-[10px] uppercase tracking-wider text-text-secondary">
            Project
          </div>
          <div className="text-xs text-accent-cyan uppercase tracking-wide">
            {selectedEvent.projectId || 'GLOBAL'}
          </div>
        </div>


        <div className="space-y-1.5">
          <div
            className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-text-secondary cursor-pointer hover:text-text-primary transition-colors"
            onClick={() => setShowRawPayload(!showRawPayload)}
          >
            {showRawPayload ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            <span>Raw Payload</span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleCopy();
              }}
              className="ml-2 p-1 hover:bg-bg-surface rounded transition-colors"
            >
              {copied ? <Check size={12} className="text-accent-green" /> : <Copy size={12} />}
            </button>
          </div>

          {showRawPayload && (
            <pre className="text-[10px] text-text-primary font-mono bg-bg-surface border border-border rounded p-3 overflow-x-auto max-h-80 overflow-y-auto">
              {JSON.stringify(data, null, 2)}
            </pre>
          )}
        </div>
      </div>
    </div>
  );
}