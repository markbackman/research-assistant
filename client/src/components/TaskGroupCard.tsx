import { Badge } from "@pipecat-ai/voice-ui-kit";
import type { TaskGroup } from "../types";
import { DelegationChain } from "./DelegationChain";
import { WorkerCard } from "./WorkerCard";

interface TaskGroupCardProps {
  group: TaskGroup;
}

export function TaskGroupCard({ group }: TaskGroupCardProps) {
  const completedCount = group.tasks.filter(
    (t) => t.status === "completed"
  ).length;
  const totalCount = group.tasks.length;

  return (
    <div className="rounded-lg border border-border bg-card p-3 space-y-3">
      {/* Header */}
      <div className="space-y-1.5">
        <div className="flex items-start justify-between gap-2">
          <h4 className="text-xs font-semibold leading-tight">
            &ldquo;{group.query}&rdquo;
          </h4>
          <div className="flex items-center gap-1.5">
            {group.hasUnheardResult && (
              <Badge className="animate-pulse bg-emerald-100 text-emerald-700 border-emerald-200">
                READY
              </Badge>
            )}
            <Badge color={group.completed ? "secondary" : "primary"}>
              {completedCount}/{totalCount}
            </Badge>
          </div>
        </div>
        <DelegationChain workerCount={totalCount} />
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
