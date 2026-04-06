import { describe, it, expect } from 'vitest';
import {
  eventMatchesFilters,
  belongsToPrimary,
  getSecondaryClassification,
  PRIMARY_TO_SECONDARY_MAP,
} from './filters';
import type { WatchmanEvent, EventData } from '../types';

// Helper to create mock events with proper typing
function createMockEvent(overrides: Partial<WatchmanEvent> = {}): WatchmanEvent {
  return {
    id: 'test-id',
    sessionId: 'test-session',
    projectId: 'test-project',
    type: 'system',
    subtype: 'test.subtype',
    data: { level: 'info', message: 'test' } as EventData,
    timestamp: new Date().toISOString(),
    ...overrides,
  };
}

// Helper for tool event data
function createToolEventData(tool: string, action: 'call' | 'result' | 'error' = 'call', extra: Record<string, unknown> = {}): EventData {
  return { tool, action, ...extra } as EventData;
}

describe('PRIMARY_TO_SECONDARY_MAP', () => {
  it('has entries for all primary categories', () => {
    const expectedPrimaries = ['Tool', 'MCP', 'System', 'Session', 'User', 'Agent', 'Errors'];
    expect(Object.keys(PRIMARY_TO_SECONDARY_MAP).sort()).toEqual(expectedPrimaries.sort());
  });

  it('each entry has match and classify functions', () => {
    for (const [_primary, mapper] of Object.entries(PRIMARY_TO_SECONDARY_MAP)) {
      expect(typeof mapper.match).toBe('function');
      expect(typeof mapper.classify).toBe('function');
    }
  });
});

describe('getSecondaryClassification', () => {
  it('classifies tool names as tool for Tool primary', () => {
    expect(getSecondaryClassification('Tool', 'Bash')).toBe('tool');
    expect(getSecondaryClassification('Tool', 'Read')).toBe('tool');
    expect(getSecondaryClassification('Tool', 'Edit')).toBe('tool');
  });

  it('classifies MCP tool names as tool for MCP primary', () => {
    expect(getSecondaryClassification('MCP', 'mcp__chrome-devtools')).toBe('tool');
    expect(getSecondaryClassification('MCP', 'mcp__filesystem')).toBe('tool');
  });

  it('classifies subtypes as action for System primary', () => {
    expect(getSecondaryClassification('System', 'CwdChanged')).toBe('action');
    expect(getSecondaryClassification('System', 'InstructionsLoaded')).toBe('action');
  });

  it('classifies subtypes as action for Session primary', () => {
    expect(getSecondaryClassification('Session', 'SessionStart')).toBe('action');
    expect(getSecondaryClassification('Session', 'SessionEnd')).toBe('action');
  });

  it('classifies Agent secondary correctly', () => {
    expect(getSecondaryClassification('Agent', 'Agent')).toBe('tool');
    expect(getSecondaryClassification('Agent', 'agent.start')).toBe('action');
    expect(getSecondaryClassification('Agent', 'agent.complete')).toBe('action');
  });

  it('classifies event types as type for Errors primary', () => {
    expect(getSecondaryClassification('Errors', 'system')).toBe('type');
    expect(getSecondaryClassification('Errors', 'tool')).toBe('type');
    expect(getSecondaryClassification('Errors', 'user')).toBe('type');
  });
});

describe('belongsToPrimary', () => {
  it('matches Tool events that are not MCP', () => {
    const toolEvent = createMockEvent({ type: 'tool', data: createToolEventData('Bash') });
    expect(belongsToPrimary(toolEvent, 'Tool')).toBe(true);

    const mcpEvent = createMockEvent({ type: 'tool', data: createToolEventData('mcp__something') });
    expect(belongsToPrimary(mcpEvent, 'Tool')).toBe(false);
  });

  it('matches MCP events', () => {
    const mcpEvent = createMockEvent({ type: 'tool', data: createToolEventData('mcp__chrome-devtools') });
    expect(belongsToPrimary(mcpEvent, 'MCP')).toBe(true);

    const toolEvent = createMockEvent({ type: 'tool', data: createToolEventData('Bash') });
    expect(belongsToPrimary(toolEvent, 'MCP')).toBe(false);
  });

  it('matches System events', () => {
    const systemEvent = createMockEvent({ type: 'system' });
    expect(belongsToPrimary(systemEvent, 'System')).toBe(true);

    const toolEvent = createMockEvent({ type: 'tool' });
    expect(belongsToPrimary(toolEvent, 'System')).toBe(false);
  });

  it('matches Session events', () => {
    const sessionEvent = createMockEvent({ type: 'session' });
    expect(belongsToPrimary(sessionEvent, 'Session')).toBe(true);
  });

  it('matches User events', () => {
    const userEvent = createMockEvent({ type: 'user' });
    expect(belongsToPrimary(userEvent, 'User')).toBe(true);
  });

  it('matches Agent events including hybrid events', () => {
    // Direct agent type
    const agentEvent = createMockEvent({ type: 'agent' });
    expect(belongsToPrimary(agentEvent, 'Agent')).toBe(true);

    // Agent tool invocation
    const agentToolEvent = createMockEvent({ type: 'tool', data: createToolEventData('Agent') });
    expect(belongsToPrimary(agentToolEvent, 'Agent')).toBe(true);

    // Legacy SubagentStart
    const subagentStartEvent = createMockEvent({ type: 'system', subtype: 'SubagentStart' });
    expect(belongsToPrimary(subagentStartEvent, 'Agent')).toBe(true);

    // New agent.start
    const agentStartEvent = createMockEvent({ type: 'system', subtype: 'agent.start' });
    expect(belongsToPrimary(agentStartEvent, 'Agent')).toBe(true);
  });
});

describe('eventMatchesFilters', () => {
  describe('no filters', () => {
    it('matches all events when no filters are active', () => {
      const event = createMockEvent();
      expect(eventMatchesFilters(event, [], [])).toBe(true);
    });
  });

  describe('only primaries', () => {
    it('matches events that belong to any selected primary', () => {
      const toolEvent = createMockEvent({ type: 'tool', data: createToolEventData('Bash') });
      expect(eventMatchesFilters(toolEvent, ['Tool'], [])).toBe(true);
      expect(eventMatchesFilters(toolEvent, ['System'], [])).toBe(false);
      expect(eventMatchesFilters(toolEvent, ['Tool', 'System'], [])).toBe(true);
    });
  });

  describe('only secondaries', () => {
    it('matches events with matching secondary', () => {
      const toolEvent = createMockEvent({ type: 'tool', data: createToolEventData('Bash') });
      expect(eventMatchesFilters(toolEvent, [], ['Bash'])).toBe(true);
      expect(eventMatchesFilters(toolEvent, [], ['Read'])).toBe(false);
    });
  });

  describe('correlated AND logic (primary + secondary)', () => {
    it('matches Tool event with correct secondary', () => {
      const event = createMockEvent({ type: 'tool', data: createToolEventData('Bash') });
      expect(eventMatchesFilters(event, ['Tool'], ['Bash'])).toBe(true);
    });

    it('rejects Tool event with wrong secondary', () => {
      const event = createMockEvent({ type: 'tool', data: createToolEventData('Read') });
      expect(eventMatchesFilters(event, ['Tool'], ['Bash'])).toBe(false);
    });

    it('rejects cross-category leakage: System event with Tool secondary', () => {
      // A System event with subtype 'Bash' should NOT match 'Bash' secondary
      // because 'Bash' is a Tool secondary (tool name), not a System secondary
      const event = createMockEvent({ type: 'system', subtype: 'Bash' });
      expect(eventMatchesFilters(event, ['System'], ['Bash'])).toBe(false);
    });

    it('rejects cross-category leakage: Tool event with System secondary', () => {
      // A Tool event with tool='Bash' should NOT match 'CwdChanged' secondary
      // because 'CwdChanged' is a System secondary (subtype), not a Tool secondary
      // Note: 'CwdChanged' is validated as a System secondary by isValidSecondaryForPrimary
      const event = createMockEvent({ type: 'tool', data: createToolEventData('Bash') });
      expect(eventMatchesFilters(event, ['Tool'], ['CwdChanged'])).toBe(false);
    });

    it('handles multiple primaries with different secondaries', () => {
      const toolEvent = createMockEvent({ type: 'tool', data: createToolEventData('Bash') });
      const systemEvent = createMockEvent({ type: 'system', subtype: 'CwdChanged' });

      expect(eventMatchesFilters(toolEvent, ['Tool', 'System'], ['Bash', 'CwdChanged'])).toBe(true);
      expect(eventMatchesFilters(systemEvent, ['Tool', 'System'], ['Bash', 'CwdChanged'])).toBe(true);
    });

    it('rejects System event when only Tool secondary is selected', () => {
      const systemEvent = createMockEvent({ type: 'system', subtype: 'Something' });
      expect(eventMatchesFilters(systemEvent, ['Tool', 'System'], ['Bash'])).toBe(false);
    });

    it('rejects Tool event when only System secondary is selected', () => {
      const toolEvent = createMockEvent({ type: 'tool', data: createToolEventData('Something') });
      expect(eventMatchesFilters(toolEvent, ['Tool', 'System'], ['CwdChanged'])).toBe(false);
    });

    it('correctly matches MCP events with MCP secondary', () => {
      const mcpEvent = createMockEvent({ type: 'tool', data: createToolEventData('mcp__chrome-devtools') });
      expect(eventMatchesFilters(mcpEvent, ['MCP'], ['mcp__chrome-devtools'])).toBe(true);
      expect(eventMatchesFilters(mcpEvent, ['Tool'], ['mcp__chrome-devtools'])).toBe(false);
    });

    it('correctly matches Session events', () => {
      const sessionStart = createMockEvent({ type: 'session', subtype: 'SessionStart' });
      expect(eventMatchesFilters(sessionStart, ['Session'], ['SessionStart'])).toBe(true);
      expect(eventMatchesFilters(sessionStart, ['Session'], ['SessionEnd'])).toBe(false);
    });

    it('correctly matches Agent events with agent.start', () => {
      const agentStart = createMockEvent({ type: 'system', subtype: 'agent.start' });
      expect(eventMatchesFilters(agentStart, ['Agent'], ['agent.start'])).toBe(true);

      // Also matches legacy SubagentStart
      const legacyStart = createMockEvent({ type: 'system', subtype: 'SubagentStart' });
      expect(eventMatchesFilters(legacyStart, ['Agent'], ['agent.start'])).toBe(true);
    });

    it('correctly matches Agent events with Agent tool', () => {
      const agentTool = createMockEvent({ type: 'tool', data: createToolEventData('Agent') });
      expect(eventMatchesFilters(agentTool, ['Agent'], ['Agent'])).toBe(true);
    });

    it('correctly matches Errors events', () => {
      const errorEvent = createMockEvent({
        type: 'tool',
        subtype: 'tool.failure',
        data: createToolEventData('Bash', 'error', { error: 'Something went wrong' })
      });
      expect(eventMatchesFilters(errorEvent, ['Errors'], ['tool'])).toBe(true);
    });
  });

  describe('edge cases', () => {
    it('handles empty secondary array with primaries', () => {
      const event = createMockEvent({ type: 'tool', data: createToolEventData('Bash') });
      expect(eventMatchesFilters(event, ['Tool'], [])).toBe(true);
    });

    it('handles empty primary array with secondaries', () => {
      const event = createMockEvent({ type: 'tool', data: createToolEventData('Bash') });
      expect(eventMatchesFilters(event, [], ['Bash'])).toBe(true);
    });

    it('handles event not matching any filter', () => {
      const event = createMockEvent({ type: 'user', subtype: 'user.input' });
      expect(eventMatchesFilters(event, ['Tool'], ['Bash'])).toBe(false);
    });
  });
});
