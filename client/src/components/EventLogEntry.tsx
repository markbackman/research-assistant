import type { AgentEvent } from "../types";

interface EventLogEntryProps {
  event: AgentEvent;
}

function agentColor(agent: string): string {
  if (agent.startsWith("voice") || agent === "voice")
    return "text-purple-400";
  if (agent.startsWith("coordinator") || agent === "coordinator")
    return "text-blue-400";
  return "text-green-400"; // workers
}

function formatTime(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString("en-US", {
      hour12: false,
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  } catch {
    return "??:??:??";
  }
}

function truncateDetail(detail?: string, max = 60): string {
  if (!detail) return "";
  return detail.length > max ? detail.slice(0, max) + "\u2026" : detail;
}

export function EventLogEntry({ event }: EventLogEntryProps) {
  return (
    <div className="flex items-baseline gap-2 text-[11px] leading-tight font-mono py-0.5">
      <span className="opacity-50 shrink-0">{formatTime(event.timestamp)}</span>
      <span className={`shrink-0 font-semibold ${agentColor(event.agent)}`}>
        {event.agent}
      </span>
      <span className="opacity-70 truncate">
        {truncateDetail(event.detail || event.event)}
      </span>
    </div>
  );
}
