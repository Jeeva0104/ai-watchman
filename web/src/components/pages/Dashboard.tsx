import { SessionList } from '../panels/SessionList';
import { EventStream } from '../panels/EventStream';
import { EventDetail } from '../panels/EventDetail';

export function Dashboard() {
  return (
    <div className="h-full grid grid-cols-[380px_640px_1fr] gap-px bg-border">
      {/* Left Panel: Sessions - 380px fixed */}
      <div className="bg-bg-primary overflow-hidden flex flex-col">
        <SessionList />
      </div>

      {/* Center Panel: Event Stream - 640px fixed */}
      <div className="bg-bg-primary overflow-hidden flex flex-col">
        <EventStream />
      </div>

      {/* Right Panel: Event Detail - flexible (hero) */}
      <div className="bg-bg-primary overflow-hidden flex flex-col">
        <EventDetail />
      </div>
    </div>
  );
}