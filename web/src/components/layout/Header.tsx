import { Settings } from 'lucide-react';

export type ViewType = 'dashboard' | 'sessions' | 'tools' | 'agents' | 'logs';

interface HeaderProps {
  currentView: ViewType;
  onViewChange: (view: ViewType) => void;
}

const navItems: { id: ViewType; label: string }[] = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'sessions', label: 'Sessions' },
  { id: 'tools', label: 'Tools' },
  { id: 'agents', label: 'Agents' },
  { id: 'logs', label: 'Logs' },
];

export function Header({ currentView, onViewChange }: HeaderProps) {
  return (
    <header className="h-14 bg-bg-surface border-b border-border flex items-center px-5 shrink-0 gap-6">
      {/* Logo */}
      <div className="flex items-center gap-2.5">
        <div className="w-7 h-7 rounded bg-gradient-to-br from-accent-cyan to-accent-purple flex items-center justify-center text-bg-primary text-sm">
          ◈
        </div>
        <span className="text-base font-bold tracking-wide">AI-Watchman</span>
      </div>

      {/* Navigation - pushed to center with margin-auto */}
      <nav className="flex items-center gap-2 ml-auto">
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => onViewChange(item.id)}
            className={`px-3.5 py-1.5 text-xs uppercase tracking-wide rounded border transition-all ${
              currentView === item.id
                ? 'bg-accent-cyan border-accent-cyan text-bg-primary font-semibold shadow-[0_0_15px_rgba(0,240,255,0.3)]'
                : 'border-border text-text-secondary hover:border-accent-cyan hover:text-accent-cyan'
            }`}
          >
            {item.label}
          </button>
        ))}
      </nav>

      {/* Status + Settings */}
      <div className="flex items-center gap-3 ml-4">
        <span className="text-[11px] text-text-secondary uppercase flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-accent-green shadow-[0_0_8px_#00ff88] animate-pulse" />
          Connected
        </span>
        <button className="p-1.5 text-text-secondary hover:text-text-primary transition-colors">
          <Settings size={16} />
        </button>
      </div>
    </header>
  );
}
