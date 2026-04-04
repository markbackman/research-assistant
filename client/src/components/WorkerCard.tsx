import { Check, X, Loader2, Clock, Search, Globe } from "lucide-react";
import type { TaskInfo } from "../types";
import { useElapsedTime } from "../hooks/useElapsedTime";

interface WorkerCardProps {
  task: TaskInfo;
  index: number;
}

function StatusIcon({ status }: { status: TaskInfo["status"] }) {
  switch (status) {
    case "completed":
      return <Check className="w-3.5 h-3.5 text-green-500" />;
    case "running":
      return <Loader2 className="w-3.5 h-3.5 text-blue-500 animate-spin" />;
    case "error":
      return <X className="w-3.5 h-3.5 text-red-500" />;
    case "pending":
    default:
      return <Clock className="w-3.5 h-3.5 opacity-40" />;
  }
}

function ToolIcon({ tool }: { tool: string }) {
  if (tool === "WebSearch") return <Search className="w-3 h-3" />;
  if (tool === "WebFetch") return <Globe className="w-3 h-3" />;
  return null;
}

function formatToolInput(tool: string, input: Record<string, unknown>): string {
  if (tool === "WebSearch" && input.query) return String(input.query);
  if (tool === "WebFetch" && input.url) {
    const url = String(input.url);
    try {
      return new URL(url).hostname + new URL(url).pathname.slice(0, 30);
    } catch {
      return url.slice(0, 40);
    }
  }
  return JSON.stringify(input).slice(0, 40);
}

export function WorkerCard({ task, index }: WorkerCardProps) {
  const elapsed = useElapsedTime(task.startedAt, task.completedAt);

  return (
    <div className="rounded border border-border bg-background/50 px-2.5 py-2">
      <div className="flex items-center gap-2">
        <StatusIcon status={task.status} />
        <span className="text-xs font-medium truncate flex-1">
          worker_{index}: {task.topic}
        </span>
        {elapsed !== null && (
          <span className="text-[11px] font-mono opacity-60 shrink-0">
            {elapsed.toFixed(1)}s
          </span>
        )}
      </div>

      {task.toolCalls.length > 0 && (
        <div className="mt-1.5 flex flex-col gap-0.5 pl-5">
          {task.toolCalls.map((tc, i) => (
            <div
              key={`${tc.timestamp}-${i}`}
              className="flex items-center gap-1.5 text-[11px] opacity-70"
            >
              <ToolIcon tool={tc.tool} />
              <span className="font-medium">{tc.tool}</span>
              <span className="truncate opacity-70">
                {formatToolInput(tc.tool, tc.input)}
              </span>
            </div>
          ))}
        </div>
      )}

      {task.status === "running" && (
        <div className="mt-1.5 pl-5">
          <div className="h-1 rounded-full bg-blue-500/20 overflow-hidden">
            <div className="h-full bg-blue-500 rounded-full animate-pulse w-2/3" />
          </div>
        </div>
      )}

      {task.status === "completed" && (
        <div className="mt-1 pl-5 text-[10px] font-semibold uppercase text-green-500 tracking-wider">
          COMPLETED
        </div>
      )}

      {task.status === "error" && (
        <div className="mt-1 pl-5 text-[10px] font-semibold uppercase text-red-500 tracking-wider">
          ERROR
        </div>
      )}
    </div>
  );
}
