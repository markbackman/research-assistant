import { useState } from "react";
import { Badge } from "@pipecat-ai/voice-ui-kit";
import { ChevronDown, ChevronUp } from "lucide-react";
import type { TaskGroup } from "../types";
import { useResearchState } from "../context/ResearchContext";
import { DelegationChain } from "./DelegationChain";
import { WorkerCard } from "./WorkerCard";
import { EventLogEntry } from "./EventLogEntry";
import { useElapsedTime } from "../hooks/useElapsedTime";

interface TaskGroupCardProps {
  group: TaskGroup;
}

export function TaskGroupCard({ group }: TaskGroupCardProps) {
  const [showEvents, setShowEvents] = useState(false);
  const { agentEvents } = useResearchState();
  const completedCount = group.tasks.filter(
    (t) => t.status === "completed"
  ).length;
  const totalCount = group.tasks.length;
  const elapsed = useElapsedTime(group.startedAt, group.completedAt);

  const groupEvents = agentEvents.filter(
    (e) => e.groupId === group.groupId
  );

  return (
    <div className="rounded-lg border border-border bg-card p-3 space-y-3">
      {/* Header */}
      <div className="space-y-1.5">
        <div className="flex items-start justify-between gap-2">
          <h4 className="text-xs font-semibold leading-tight">
            &ldquo;{group.query}&rdquo;
          </h4>
          <Badge color={group.completed ? "secondary" : "primary"}>
            {completedCount}/{totalCount}
          </Badge>
        </div>
        <DelegationChain workerCount={totalCount} />
        {elapsed !== null && (
          <p className="text-[11px] opacity-50">
            {group.completed
              ? `Completed in ${elapsed.toFixed(1)}s`
              : `Started ${elapsed.toFixed(1)}s ago`}
          </p>
        )}
      </div>

      {/* Worker cards */}
      <div className="space-y-2">
        {group.tasks.map((task, i) => (
          <WorkerCard key={task.taskId} task={task} index={i} />
        ))}
      </div>

      {/* Expandable event log */}
      {groupEvents.length > 0 && (
        <div className="border-t border-border pt-2">
          <button
            type="button"
            className="flex items-center gap-1 text-[11px] opacity-50 hover:opacity-80 transition-opacity"
            onClick={() => setShowEvents(!showEvents)}
          >
            {showEvents ? (
              <ChevronUp className="w-3 h-3" />
            ) : (
              <ChevronDown className="w-3 h-3" />
            )}
            {groupEvents.length} event{groupEvents.length !== 1 && "s"}
          </button>
          {showEvents && (
            <div className="mt-1.5 flex flex-col max-h-48 overflow-y-auto">
              {groupEvents.map((event, i) => (
                <EventLogEntry key={`${event.timestamp}-${i}`} event={event} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
