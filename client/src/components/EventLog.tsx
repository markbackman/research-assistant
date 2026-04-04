import { useResearchState } from "../context/ResearchContext";
import { EventLogEntry } from "./EventLogEntry";

export function EventLog() {
  const { agentEvents } = useResearchState();

  return (
    <div className="flex flex-col">
      <h3 className="text-xs font-semibold uppercase tracking-wider opacity-60 mb-2">
        Event Log
      </h3>
      {agentEvents.length === 0 ? (
        <p className="text-[11px] opacity-40 font-mono">
          Waiting for events...
        </p>
      ) : (
        <div className="flex flex-col max-h-48 overflow-y-auto">
          {agentEvents.map((event, i) => (
            <EventLogEntry key={`${event.timestamp}-${i}`} event={event} />
          ))}
        </div>
      )}
    </div>
  );
}
