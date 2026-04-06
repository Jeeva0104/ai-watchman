import type { WatchmanEvent } from '../types';

// ============================================================================
// Primary Category Interface & Definitions
// ============================================================================

export interface PrimaryCategory {
  label: string;
  type?: string;  // Event type to match (system, tool, agent, user, session)
  match?: (event: WatchmanEvent) => boolean;  // Custom matcher for MCP, Errors
}

/**
 * Check if an event is agent-related.
 * Agent-related events include:
 * - SubagentStart, SubagentStop hook events
 * - Agent tool invocations
 * - Events with agent in the action/subtype
 */
function isAgentRelatedEvent(event: WatchmanEvent): boolean {
  // Check subtype for agent-related events
  if (event.subtype === 'SubagentStart') return true;  // Legacy support
  if (event.subtype === 'SubagentStop') return true;   // Legacy support
  if (event.subtype === 'agent.start') return true;    // NEW
  if (event.subtype === 'agent.complete') return true; // NEW

  // Check if it's an Agent tool use
  const data = event.data as { tool?: string };
  if (data?.tool === 'Agent') return true;

  // Check subtype for agent-related indicators
  if (event.subtype?.includes('agent')) return true;

  return false;
}

/**
 * Check if an event represents an error.
 * An event is an error if:
 * 1. It's a tool failure (subtype === 'tool.failure')
 * 2. It's a stop failure (subtype === 'StopFailure')
 * 3. It has an error field in data
 */
export function isErrorEvent(event: WatchmanEvent): boolean {
  // Tool failure subtype
  if (event.subtype === 'tool.failure') return true;

  // Stop failure subtype
  if (event.subtype === 'StopFailure') return true;

  // Has error field in data
  const data = event.data as { error?: string | { message?: string } };
  if (data?.error) {
    if (typeof data.error === 'string' && data.error !== '') return true;
    if (typeof data.error === 'object' && data.error.message) return true;
  }

  return false;
}

/**
 * Primary categories for Level 1 filtering.
 * Each category maps to either an event type or a custom matcher.
 */
export const PRIMARY_CATEGORIES: PrimaryCategory[] = [
  { label: 'System', type: 'system' },
  { label: 'Tool', type: 'tool' },
  { label: 'Agent', type: 'agent' },
  { label: 'User', type: 'user' },
  { label: 'Session', type: 'session' },
  {
    label: 'MCP',
    match: (e) => {
      const data = e.data as { tool?: string };
      return !!data.tool?.startsWith('mcp__');
    },
  },
  { label: 'Errors', match: (e) => isErrorEvent(e) },
];

// ============================================================================
// Legacy Static Filters (kept for backward compatibility during migration)
// ============================================================================

export interface StaticFilter {
  label: string;
  subtypes?: string[];
  match?: (event: WatchmanEvent) => boolean;
}

export const STATIC_FILTERS: StaticFilter[] = [
  { label: 'Prompts', subtypes: ['user.input'] },
  {
    label: 'Tools',
    subtypes: ['tool.before', 'tool.after', 'tool.failure'],
    match: (e) => {
      const isToolEvent =
        e.subtype === 'tool.before' ||
        e.subtype === 'tool.after' ||
        e.subtype === 'tool.failure';
      if (!isToolEvent) return false;
      const data = e.data as { tool?: string };
      return !!data.tool && !data.tool.startsWith('mcp__');
    },
  },
  {
    label: 'MCP',
    subtypes: ['Elicitation', 'ElicitationResult'],
    match: (e) => {
      const data = e.data as { tool?: string };
      return !!data.tool?.startsWith('mcp__');
    },
  },
  { label: 'Session', subtypes: ['SessionStart', 'SessionEnd'] },
  {
    label: 'Errors',
    match: (e) => isErrorEvent(e),
  },
];

// ============================================================================
// Secondary Filter Extraction
// ============================================================================

// Normalize MCP tool names: mcp__chrome-devtools__click → mcp__chrome-devtools
function normalizeMcpName(name: string): string {
  const match = name.match(/^(mcp__[^_]+(?:_[^_]+)*?)__/);
  return match ? match[1] : name;
}

// ============================================================================
// Primary-Secondary Mapping
// ============================================================================

/**
 * Check if a secondary filter string is semantically valid for a given primary.
 * This prevents cross-category filter leakage (e.g., "Bash" tool name matching
 * a System event that happens to have subtype="Bash").
 */
function isValidSecondaryForPrimary(primary: string, secondary: string): boolean {
  switch (primary) {
    case 'Tool':
      // Tool names: start with uppercase, not MCP, not an action pattern
      return (
        /^[A-Z]/.test(secondary) &&
        !secondary.startsWith('mcp__') &&
        !secondary.startsWith('Session') &&
        !secondary.startsWith('agent.') &&
        secondary !== 'Agent'
      );

    case 'MCP':
      // MCP tool names: start with mcp__
      return secondary.startsWith('mcp__');

    case 'System':
      // System subtypes: lowercase start or specific patterns, not tool names
      return (
        !/^[A-Z]/.test(secondary) ||
        secondary.startsWith('Session') ||
        ['CwdChanged', 'FileChanged', 'InstructionsLoaded'].includes(secondary)
      );

    case 'Session':
      // Session subtypes: Session* pattern
      return secondary.startsWith('Session');

    case 'User':
      // User subtypes: user.* pattern or specific values
      return secondary.startsWith('user.') || secondary === 'user.input';

    case 'Agent':
      // Agent secondaries: specific values or agent.* pattern
      return (
        secondary === 'Agent' ||
        secondary === 'agent.start' ||
        secondary === 'agent.complete' ||
        secondary.startsWith('agent.')
      );

    case 'Errors':
      // Error secondaries: event types
      return ['system', 'tool', 'user', 'session', 'agent'].includes(secondary);

    default:
      return false;
  }
}

/**
 * Defines how secondary filters match and classify for each primary category.
 * This prevents cross-category filter leakage by ensuring secondaries only
 * match events from their associated primary.
 */
export const PRIMARY_TO_SECONDARY_MAP: Record<string, {
  /**
   * Check if an event matches a secondary filter for this primary.
   */
  match: (event: WatchmanEvent, secondary: string) => boolean;
  /**
   * Classify a secondary filter for API parameter building.
   * - 'tool': Secondary is a tool name → API tools[] parameter
   * - 'action': Secondary is a subtype/action → API actions[] parameter
   * - 'type': Secondary is an event type → API types[] parameter
   */
  classify: (secondary: string) => 'tool' | 'action' | 'type';
}> = {
  Tool: {
    match: (event, secondary) => {
      // First validate that this secondary is valid for Tool primary
      if (!isValidSecondaryForPrimary('Tool', secondary)) return false;
      const data = event.data as { tool?: string };
      // Direct tool name match (not MCP)
      return data.tool === secondary && !data.tool.startsWith('mcp__');
    },
    classify: () => 'tool',
  },
  MCP: {
    match: (event, secondary) => {
      // First validate that this secondary is valid for MCP primary
      if (!isValidSecondaryForPrimary('MCP', secondary)) return false;
      const data = event.data as { tool?: string };
      if (!data.tool?.startsWith('mcp__')) return false;
      const normalized = normalizeMcpName(data.tool);
      return normalized === secondary || data.tool === secondary;
    },
    classify: () => 'tool',
  },
  System: {
    match: (event, secondary) => {
      // First validate that this secondary is valid for System primary
      if (!isValidSecondaryForPrimary('System', secondary)) return false;
      return event.subtype === secondary;
    },
    classify: () => 'action',
  },
  Session: {
    match: (event, secondary) => {
      // First validate that this secondary is valid for Session primary
      if (!isValidSecondaryForPrimary('Session', secondary)) return false;
      return event.subtype === secondary;
    },
    classify: () => 'action',
  },
  User: {
    match: (event, secondary) => {
      // First validate that this secondary is valid for User primary
      if (!isValidSecondaryForPrimary('User', secondary)) return false;
      return event.subtype === secondary;
    },
    classify: () => 'action',
  },
  Agent: {
    match: (event, secondary) => {
      // First validate that this secondary is valid for Agent primary
      if (!isValidSecondaryForPrimary('Agent', secondary)) return false;

      // Handle normalized agent secondaries
      if (secondary === 'agent.start') {
        return event.subtype === 'agent.start' || event.subtype === 'SubagentStart';
      }
      if (secondary === 'agent.complete') {
        return event.subtype === 'agent.complete' || event.subtype === 'SubagentStop';
      }
      if (secondary === 'Agent') {
        const data = event.data as { tool?: string };
        return data.tool === 'Agent';
      }
      return event.subtype === secondary;
    },
    classify: (secondary) => secondary === 'Agent' ? 'tool' : 'action',
  },
  Errors: {
    match: (event, secondary) => {
      // First validate that this secondary is valid for Errors primary
      if (!isValidSecondaryForPrimary('Errors', secondary)) return false;
      return event.type === secondary;
    },
    classify: () => 'type',
  },
};

/**
 * Classify a secondary filter for API parameter building.
 * Uses the primary category to determine correct classification.
 *
 * @param primary - The primary category name
 * @param secondary - The secondary filter value
 * @returns 'tool' for tool names, 'action' for subtypes, 'type' for event types
 *          Falls back to 'action' for unknown primaries (safe default for API params)
 */
export function getSecondaryClassification(
  primary: string,
  secondary: string
): 'tool' | 'action' | 'type' {
  const mapper = PRIMARY_TO_SECONDARY_MAP[primary];
  // Fallback to 'action' for unknown primaries - this is a safe default
  // because most secondary filters are subtypes/actions, and the API will
  // still filter correctly even if misclassified
  return mapper ? mapper.classify(secondary) : 'action';
}

// ============================================================================
// Primary Category Matching
// ============================================================================

/**
 * Check if an event belongs to a primary category.
 */
export function belongsToPrimary(event: WatchmanEvent, primary: string): boolean {
  const category = PRIMARY_CATEGORIES.find(c => c.label === primary);
  if (!category) return false;

  // Special case: Tool primary should exclude MCP tools
  if (primary === 'Tool') {
    if (event.type !== 'tool') return false;
    const data = event.data as { tool?: string };
    return !data.tool?.startsWith('mcp__');
  }

  // Hybrid logic: Agent primary includes agent-related system/tool events
  if (primary === 'Agent') {
    // Direct type match
    if (event.type === 'agent') return true;
    // Hybrid: agent-related system/tool events
    return isAgentRelatedEvent(event);
  }

  if (category.type) {
    return event.type === category.type;
  }
  if (category.match) {
    return category.match(event);
  }
  return false;
}

/**
 * Extract secondary filter names for a specific primary category from events.
 */
function extractFiltersForPrimary(
  events: WatchmanEvent[],
  primary: string
): string[] {
  const names = new Set<string>();

  for (const e of events) {
    // Check if event belongs to this primary
    if (!belongsToPrimary(e, primary)) continue;

    // Extract secondary filter name based on primary type
    switch (primary) {
      case 'Tool':
      case 'MCP': {
        const data = e.data as { tool?: string };
        if (data.tool) {
          const name = data.tool.startsWith('mcp__')
            ? normalizeMcpName(data.tool)
            : data.tool;
          names.add(name);
        }
        break;
      }
      case 'System':
      case 'User':
      case 'Session': {
        // Use subtype as secondary filter
        if (e.subtype) names.add(e.subtype);
        break;
      }
      case 'Agent': {
        // Handle hybrid agent-related events with meaningful names
        // Map legacy and new agent events to consistent secondary filter names
        if (e.subtype === 'SubagentStart' || e.subtype === 'agent.start') {
          names.add('agent.start');
        } else if (e.subtype === 'SubagentStop' || e.subtype === 'agent.complete') {
          names.add('agent.complete');
        } else {
          const data = e.data as { tool?: string };
          if (data.tool === 'Agent') {
            names.add('Agent');
          } else if (e.subtype) {
            names.add(e.subtype);
          }
        }
        break;
      }
      case 'Errors': {
        // For errors, show the event type as secondary
        names.add(e.type);
        break;
      }
    }
  }

  return Array.from(names).sort();
}

/**
 * Get secondary filters grouped by primary category.
 * Returns a Map where keys are primary labels and values are arrays of secondary filter names.
 */
export function getSecondaryFilters(
  events: WatchmanEvent[],
  selectedPrimaries: string[]
): Map<string, string[]> {
  const secondaryMap = new Map<string, string[]>();

  for (const primary of selectedPrimaries) {
    const filters = extractFiltersForPrimary(events, primary);
    secondaryMap.set(primary, filters);
  }

  return secondaryMap;
}

// ============================================================================
// Event Matching
// ============================================================================

/**
 * Check if an event matches the active primary and secondary filters.
 *
 * Uses Correlated AND logic:
 * - Only primaries: OR logic across primaries (event matches ANY selected primary)
 * - Only secondaries: OR logic across secondaries (event matches ANY secondary)
 * - Both primaries AND secondaries: Event must belong to a selected primary AND
 *   match a secondary that is valid for THAT specific primary (correlated matching).
 *
 * This prevents cross-category filter leakage where a secondary like "Bash"
 * (extracted from Tool events) would incorrectly match a System event that
 * happens to have subtype="Bash".
 */
export function eventMatchesFilters(
  event: WatchmanEvent,
  activePrimaries: string[],
  activeSecondaries: string[],
): boolean {
  // No filters = show everything
  if (activePrimaries.length === 0 && activeSecondaries.length === 0) {
    return true;
  }

  // Only primaries selected = OR logic across primaries
  if (activeSecondaries.length === 0) {
    return activePrimaries.some((primary) => belongsToPrimary(event, primary));
  }

  // Only secondaries selected = match any event with that secondary
  // (legacy behavior - matches against any primary's secondary matcher)
  if (activePrimaries.length === 0) {
    return Object.values(PRIMARY_TO_SECONDARY_MAP).some((mapper) =>
      activeSecondaries.some((secondary) => mapper.match(event, secondary))
    );
  }

  // Both primaries AND secondaries: Correlated AND logic
  // Event must: belong to a selected primary AND match a secondary valid for THAT primary
  for (const primary of activePrimaries) {
    if (!belongsToPrimary(event, primary)) continue;

    const mapper = PRIMARY_TO_SECONDARY_MAP[primary];
    if (!mapper) continue;

    // Short-circuit on first match
    if (activeSecondaries.some((secondary) => mapper.match(event, secondary))) {
      return true;
    }
  }

  return false;
}

// ============================================================================
// Legacy Support Functions (for backward compatibility)
// ============================================================================

// Subtypes that produce dynamic (row 2) tool-name filters.
const DYNAMIC_SUBTYPES = new Set(['tool.before', 'tool.after', 'tool.failure']);

// All subtypes explicitly covered by at least one static filter.
const STATIC_COVERED_SUBTYPES = new Set(
  STATIC_FILTERS.flatMap((f) => f.subtypes ?? []),
);

// Display-name overrides for dynamic catchall subtypes.
const DYNAMIC_DISPLAY_NAMES: Record<string, string> = {
  CwdChanged: 'CWD',
  FileChanged: 'File',
};

/** Return a human-friendly label for a dynamic filter key. */
export function getDynamicDisplayName(key: string): string {
  return DYNAMIC_DISPLAY_NAMES[key] ?? key;
}

// Extract dynamic filter names from events (tool names + uncovered hook subtypes).
export function getDynamicFilterNames(events: WatchmanEvent[]): string[] {
  const names = new Set<string>();
  for (const e of events) {
    const data = e.data as { tool?: string };
    if (e.subtype && DYNAMIC_SUBTYPES.has(e.subtype) && data.tool) {
      const name = data.tool.startsWith('mcp__') ? normalizeMcpName(data.tool) : data.tool;
      names.add(name);
      continue;
    }
    if (e.subtype && !STATIC_COVERED_SUBTYPES.has(e.subtype)) {
      names.add(e.subtype);
    }
  }
  return Array.from(names).sort();
}

// Returns the set of static filter labels that have at least one matching event.
export function getFiltersWithMatches(events: WatchmanEvent[]): Set<string> {
  const matched = new Set<string>();
  for (const filter of STATIC_FILTERS) {
    if (matched.has(filter.label)) continue;
    for (const e of events) {
      if (filter.match && filter.match(e)) {
        matched.add(filter.label);
        break;
      }
      if (filter.subtypes && e.subtype && filter.subtypes.includes(e.subtype)) {
        matched.add(filter.label);
        break;
      }
    }
  }
  return matched;
}

/**
 * Get which primary categories have matching events.
 */
export function getPrimariesWithMatches(events: WatchmanEvent[]): Set<string> {
  const matched = new Set<string>();
  for (const category of PRIMARY_CATEGORIES) {
    const hasMatch = events.some(e => belongsToPrimary(e, category.label));
    if (hasMatch) matched.add(category.label);
  }
  return matched;
}