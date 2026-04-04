import { useResearchState } from "../context/ResearchContext";
import { TaskGroupCard } from "./TaskGroupCard";
import { EventLog } from "./EventLog";

export function AgentDashboard() {
  const { taskGroups } = useResearchState();

  const activeGroups = taskGroups.filter((g) => !g.completed);
  const completedGroups = taskGroups.filter((g) => g.completed);

  return (
    <div className="w-[28rem] shrink-0 border-l border-border overflow-y-auto flex flex-col">
      {/* Task groups section */}
      <div className="flex-1 p-4 space-y-4 overflow-y-auto">
        <h2 className="text-sm font-semibold">Agent Activity</h2>

        {taskGroups.length === 0 && (
          <p className="text-xs opacity-50">No tasks yet.</p>
        )}

        {activeGroups.map((group) => (
          <TaskGroupCard key={group.groupId} group={group} />
        ))}

        {completedGroups.length > 0 && activeGroups.length > 0 && (
          <div className="border-t border-border pt-3">
            <h3 className="text-xs font-medium opacity-60 mb-2">Completed</h3>
            {completedGroups.map((group) => (
              <TaskGroupCard key={group.groupId} group={group} />
            ))}
          </div>
        )}

        {completedGroups.length > 0 && activeGroups.length === 0 &&
          completedGroups.map((group) => (
            <TaskGroupCard key={group.groupId} group={group} />
          ))}
      </div>

      {/* Event log section */}
      <div className="border-t border-border p-4 shrink-0">
        <EventLog />
      </div>
    </div>
  );
}
