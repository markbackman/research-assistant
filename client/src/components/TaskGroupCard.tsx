import { Badge } from "@pipecat-ai/voice-ui-kit";
import type { TaskGroup } from "../types";
import { DelegationChain } from "./DelegationChain";
import { WorkerCard } from "./WorkerCard";
import { useElapsedTime } from "../hooks/useElapsedTime";

interface TaskGroupCardProps {
  group: TaskGroup;
}

export function TaskGroupCard({ group }: TaskGroupCardProps) {
  const completedCount = group.tasks.filter(
    (t) => t.status === "completed"
  ).length;
  const totalCount = group.tasks.length;
  const elapsed = useElapsedTime(group.startedAt, group.completedAt);

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
    </div>
  );
}
