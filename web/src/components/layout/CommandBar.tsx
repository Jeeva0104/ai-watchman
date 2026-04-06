import { useState, useCallback } from 'react';
import { useAppStore } from '../../stores/app-store';

export function CommandBar() {
  const [input, setInput] = useState('');
  const setFilters = useAppStore((state) => state.setFilters);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (input.trim()) {
        setFilters({ search: input.trim() });
      }
    },
    [input, setFilters]
  );

  return (
    <div className="bg-bg-primary px-6 py-4">
      <form onSubmit={handleSubmit} className="flex items-center gap-3 bg-bg-elevated border border-border rounded px-4 py-3">
        <span className="text-accent-green font-semibold">❯</span>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type a command or search events, sessions, tools... (try: 'filter tool=Bash' or 'session #7a8926f3')"
          className="flex-1 bg-transparent border-none text-text-primary font-mono text-[13px] outline-none placeholder:text-text-secondary"
        />
      </form>
    </div>
  );
}