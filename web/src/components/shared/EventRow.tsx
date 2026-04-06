import type { WatchmanEvent } from '../../types';
import { useMemo } from 'react';
import { getEventIcon, getEventColor } from '../../config/event-icons';

interface EventRowProps {
  event: WatchmanEvent;
  isSelected: boolean;
  onClick: () => void;
}

const typeColors: Record<string, string> = {
  tool: 'text-accent-cyan',
  agent: 'text-accent-purple',
  user: 'text-accent-green',
  system: 'text-accent-orange',
  session: 'text-accent-yellow',
};

export function EventRow({ event, isSelected, onClick }: EventRowProps) {
  const formatTime = (timestamp: string): string => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }) + '.' + String(date.getMilliseconds()).padStart(3, '0');
  };

  const getSummary = (): string => {
    const data = event.data as { 
      input?: Record<string, unknown>; 
      content?: string; 
      message?: string;
      command?: string;
      path?: string;
    };
    if (data.input?.command) return String(data.input.command);
    if (data.input?.path) return String(data.input.path);
    if (data.command) return data.command;
    if (data.path) return data.path;
    if (data.content) return data.content;
    if (data.message) return data.message;
    return event.subtype || '';
  };

  // Get icon and color for the event
  // For tool events, use the tool name from data.tool
  // Pass eventType for proper agent/tool resolution
  const toolName = event.type === 'tool' ? (event.data as { tool?: string }).tool : undefined;
  
  // Detect if event has error
  const hasError = !!(event.data as { error?: string }).error || 
                   event.subtype === 'tool.failure' || 
                   event.subtype === 'StopFailure';
  
  // Use error icon key for errors to show XCircle/bomb icon
  const iconKey = hasError ? 'tool.failure' : (event.subtype || event.type);
  
  // Agent tool events should show as "AGENT" type, not "TOOL"
  const isAgentTool = toolName === 'Agent';
  const displayType = isAgentTool ? 'agent' : event.type;
  const displayTypeWithError = hasError ? `${displayType}(error)` : displayType;
  const displayTypeColor = hasError 
    ? 'text-accent-red' 
    : typeColors[displayType] || 'text-text-secondary';
  
  // Get subagent type and skill type from event
  const subAgentType = event.subAgentType;
  // Fallback: extract skill from input data for events stored before the fix
  const skillType = event.skillType ||
    (event.data as { input?: { skill?: string } })?.input?.skill;
  
  // Detect skill tool
  const isSkillTool = toolName === 'Skill';
  
  const IconComponent = useMemo(() => {
    return getEventIcon(iconKey, toolName, event.type);
  }, [iconKey, toolName, event.type]);

  const { iconColor } = useMemo(() => {
    return getEventColor(iconKey, toolName, event.type);
  }, [iconKey, toolName, event.type]);

  return (
    <div
      onClick={onClick}
      className={`grid grid-cols-[70px_24px_80px_80px_1fr] gap-3 px-3 py-3 border-b border-border cursor-pointer transition-colors text-xs font-mono items-center ${
        isSelected ? 'bg-bg-surface' : 'hover:bg-bg-surface/50'
      }`}
    >
      {/* Timestamp */}
      <div className="text-text-secondary text-[10px]">
        {formatTime(event.timestamp)}
      </div>

      {/* Icon */}
      <div className="flex items-center justify-center">
        <IconComponent className={`w-4 h-4 ${iconColor}`} />
      </div>

      {/* Type - colored text, uppercase */}
      <div className={`uppercase text-[10px] font-semibold tracking-wider ${displayTypeColor}`}>
        {displayTypeWithError}
      </div>

      {/* Tool - show subagent type for Agent (purple), skill type for Skill (yellow) */}
      <div className="text-text-secondary text-[10px] truncate">
        {isAgentTool ? (
          subAgentType ? (
            <span className="px-1.5 py-0.5 bg-accent-purple/20 text-accent-purple rounded text-[9px] font-medium">
              {subAgentType}
            </span>
          ) : ''
        ) : isSkillTool ? (
          skillType ? (
            <span className="px-1.5 py-0.5 bg-accent-yellow/20 text-accent-yellow rounded text-[9px] font-medium">
              {skillType}
            </span>
          ) : 'Skill'
        ) : (
          toolName
        )}
      </div>

      {/* Summary */}
      <div className="text-text-primary truncate">
        {getSummary()}
      </div>
    </div>
  );
}