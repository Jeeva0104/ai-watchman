import { useMemo, useEffect, useState, useRef } from 'react';
import { useAppStore } from '../../stores/app-store';
import {
  PRIMARY_CATEGORIES,
  getSecondaryFilters,
  getPrimariesWithMatches,
} from '../../config/filters';
import { X, Search, Loader2, AlertTriangle } from 'lucide-react';

export function FilterBar() {
  const allEvents = useAppStore((state) => state.allEvents);
  const events = useAppStore((state) => state.events);
  const eventFilters = useAppStore((state) => state.eventFilters);
  const setFilters = useAppStore((state) => state.setFilters);
  const isLoadingEvents = useAppStore((state) => state.isLoadingEvents);

  // Local search state for immediate UI feedback
  const [localSearch, setLocalSearch] = useState(eventFilters.search);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounce search input (300ms)
  useEffect(() => {
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }

    debounceTimer.current = setTimeout(() => {
      if (localSearch !== eventFilters.search) {
        setFilters({ search: localSearch });
      }
    }, 300);

    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
    };
  }, [localSearch]);

  // Sync local state if external filter changes
  useEffect(() => {
    setLocalSearch(eventFilters.search);
  }, [eventFilters.search]);

  const hasActiveFilters =
    eventFilters.primaryFilters.length > 0 ||
    eventFilters.secondaryFilters.length > 0 ||
    eventFilters.search.length > 0;

  // Compute secondary filters based on selected primaries
  // Use allEvents (unfiltered) so secondary options don't disappear when filtering
  const secondaryFilters = useMemo(
    () => getSecondaryFilters(allEvents, eventFilters.primaryFilters),
    [allEvents, eventFilters.primaryFilters]
  );

  // Compute which primaries have matching events
  const primariesWithMatches = useMemo(
    () => getPrimariesWithMatches(events),
    [events]
  );

  const togglePrimaryFilter = (label: string) => {
    const current = eventFilters.primaryFilters;
    const isSelected = current.includes(label);

    let newPrimaries: string[];
    if (isSelected) {
      // Deselect: remove from primaries
      newPrimaries = current.filter((p) => p !== label);
    } else {
      // Select: add to primaries
      newPrimaries = [...current, label];
    }

    // Clean up secondary filters that no longer have their primary selected
    const validSecondaries = eventFilters.secondaryFilters.filter((sf) => {
      // Keep secondary if its primary is still selected
      return newPrimaries.some((primary) => {
        const secondariesForPrimary = secondaryFilters.get(primary) || [];
        return secondariesForPrimary.includes(sf);
      });
    });

    setFilters({
      primaryFilters: newPrimaries,
      secondaryFilters: validSecondaries,
    });
  };

  const toggleSecondaryFilter = (filter: string) => {
    const current = eventFilters.secondaryFilters;
    const newFilters = current.includes(filter)
      ? current.filter((f) => f !== filter)
      : [...current, filter];
    setFilters({ secondaryFilters: newFilters });
  };

  const clearFilters = () => {
    setLocalSearch('');
    setFilters({ primaryFilters: [], secondaryFilters: [], search: '' });
  };

  return (
    <div className="flex flex-col gap-1 px-3 py-2 bg-bg-surface border-b border-border shrink-0">
      {/* Row 1: Search + Primary categories */}
      <div className="flex items-center gap-2 flex-wrap">
        {/* Search Input */}
        <div className="flex items-center gap-2 bg-bg-primary border border-border rounded px-2 py-1 focus-within:border-accent-cyan transition-colors shrink-0">
          {isLoadingEvents ? (
            <Loader2 size={12} className="text-text-secondary animate-spin" />
          ) : (
            <Search size={12} className="text-text-secondary" />
          )}
          <input
            type="text"
            value={localSearch}
            onChange={(e) => setLocalSearch(e.target.value)}
            placeholder="Search..."
            className="bg-transparent border-none text-xs text-text-primary placeholder:text-text-secondary outline-none w-24"
          />
        </div>

        {/* Divider */}
        <div className="w-px h-4 bg-border shrink-0" />

        {/* All button */}
        <button
          onClick={clearFilters}
          className={`px-2 py-0.5 text-[11px] rounded border transition-all duration-200 ${
            !hasActiveFilters
              ? 'bg-accent-cyan border-accent-cyan text-bg-primary'
              : 'bg-bg-primary border-border text-text-secondary hover:border-accent-cyan/50 hover:text-text-primary'
          }`}
        >
          All
        </button>

        {/* Primary Category Filters */}
        {PRIMARY_CATEGORIES.map((category) => {
          const isActive = eventFilters.primaryFilters.includes(category.label);
          const hasMatches = primariesWithMatches.has(category.label);
          const isErrorCategory = category.label === 'Errors';

          return (
            <button
              key={category.label}
              onClick={() => togglePrimaryFilter(category.label)}
              disabled={!hasMatches && !isActive}
              className={`px-2 py-0.5 text-[11px] rounded border transition-all duration-200 flex items-center gap-1 ${
                isActive
                  ? isErrorCategory
                    ? 'bg-accent-red border-accent-red text-white'
                    : 'bg-accent-cyan border-accent-cyan text-bg-primary'
                  : hasMatches
                  ? 'bg-bg-primary border-border text-text-secondary hover:border-accent-cyan/50 hover:text-text-primary'
                  : 'bg-bg-primary border-transparent text-text-secondary/50 cursor-not-allowed'
              }`}
            >
              {isErrorCategory && isActive && <AlertTriangle size={10} />}
              {category.label}
            </button>
          );
        })}

        {/* Clear Button */}
        {hasActiveFilters && (
          <>
            <div className="w-px h-4 bg-border shrink-0" />
            <button
              onClick={clearFilters}
              className="p-1 text-text-secondary hover:text-accent-red transition-colors shrink-0"
              title="Clear filters"
            >
              <X size={14} />
            </button>
          </>
        )}
      </div>

      {/* Secondary filters grouped by primary */}
      {eventFilters.primaryFilters.length > 0 && (
        <div className="flex flex-col gap-1">
          {eventFilters.primaryFilters.map((primary) => {
            const secondaries = secondaryFilters.get(primary) || [];
            if (secondaries.length === 0) return null;

            return (
              <div key={primary} className="flex items-center gap-1 flex-wrap">
                <span className="text-[10px] text-text-secondary mr-1 min-w-[60px]">
                  {primary}:
                </span>
                {secondaries.map((filter) => {
                  const isActive = eventFilters.secondaryFilters.includes(filter);
                  return (
                    <button
                      key={filter}
                      onClick={() => toggleSecondaryFilter(filter)}
                      className={`px-2 py-0.5 text-[11px] rounded border transition-all duration-200 ${
                        isActive
                          ? 'bg-accent-purple/30 border-accent-purple text-accent-purple'
                          : 'bg-bg-primary border-border text-text-secondary hover:border-accent-purple/50 hover:text-text-primary'
                      }`}
                    >
                      {filter}
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}