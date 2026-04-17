import {
  createContext,
  useContext,
  useReducer,
  type Dispatch,
  type ReactNode,
} from "react";
import type {
  ResearchAction,
  ResearchState,
  TaskInfo,
} from "../types";

const initialState: ResearchState = {
  taskGroups: [],
  researchResults: [],
  summaries: {},
};

function researchReducer(
  state: ResearchState,
  action: ResearchAction
): ResearchState {
  switch (action.type) {
    case "TASK_GROUP_STARTED": {
      const { groupId, query, tasks, timestamp } = action.payload;
      const newGroup = {
        groupId,
        query,
        tasks: tasks.map(
          (t): TaskInfo => ({
            taskId: t.taskId,
            topic: t.topic,
            status: t.status as TaskInfo["status"],
            toolCalls: [],
          })
        ),
        completed: false,
        startedAt: timestamp,
      };
      return {
        ...state,
        taskGroups: [newGroup, ...state.taskGroups],
      };
    }

    case "TASK_UPDATE": {
      const { groupId, taskId, status, detail, timestamp } = action.payload;
      const isTerminal = status === "completed" || status === "error";
      const now = timestamp ?? new Date().toISOString();
      return {
        ...state,
        taskGroups: state.taskGroups.map((group) => {
          if (group.groupId !== groupId) return group;
          return {
            ...group,
            tasks: group.tasks.map((task) => {
              if (task.taskId !== taskId) return task;
              return {
                ...task,
                status: status as TaskInfo["status"],
                detail,
                startedAt:
                  status === "running" && !task.startedAt
                    ? now
                    : task.startedAt,
                completedAt: isTerminal
                  ? task.completedAt ?? now
                  : task.completedAt,
              };
            }),
          };
        }),
      };
    }

    case "RESEARCH_RESULT": {
      const { groupId, taskId, topic, summary, sources, timestamp } =
        action.payload;
      const doneAt = timestamp ?? new Date().toISOString();
      return {
        ...state,
        researchResults: [
          ...state.researchResults,
          { groupId, taskId, topic, summary, sources },
        ],
        // A research_result means this worker is done — mark it completed
        taskGroups: state.taskGroups.map((group) => {
          if (group.groupId !== groupId) return group;
          return {
            ...group,
            hasUnheardResult: true,
            tasks: group.tasks.map((task) => {
              if (task.taskId !== taskId) return task;
              if (task.status === "completed" || task.status === "error")
                return task;
              return {
                ...task,
                status: "completed" as const,
                completedAt: task.completedAt ?? doneAt,
              };
            }),
          };
        }),
      };
    }

    case "TASK_GROUP_COMPLETED": {
      const { groupId, timestamp } = action.payload;
      return {
        ...state,
        taskGroups: state.taskGroups.map((group) => {
          if (group.groupId !== groupId) return group;
          return {
            ...group,
            completed: true,
            completedAt: timestamp,
            // Force-complete any tasks still running — handles message ordering issues
            tasks: group.tasks.map((task) =>
              task.status === "running" || task.status === "pending"
                ? {
                    ...task,
                    status: "completed" as const,
                    completedAt: task.completedAt ?? timestamp,
                  }
                : task
            ),
          };
        }),
      };
    }

    case "SUMMARY_UPDATE": {
      const { groupId, summary, keyFindings } = action.payload;
      return {
        ...state,
        summaries: {
          ...state.summaries,
          [groupId]: { groupId, summary, keyFindings },
        },
        // Summary fires after the agent has actually delivered the details to the user
        // (either in the immediate-speak path or after get_pending_result), so clear the
        // "result ready" badge here.
        taskGroups: state.taskGroups.map((group) =>
          group.groupId === groupId
            ? { ...group, hasUnheardResult: false }
            : group
        ),
      };
    }

    case "AGENT_METRICS": {
      const { groupId, taskId, inputTokens, outputTokens, ttfbMs, durationMs } =
        action.payload;
      const incoming = {
        ...(inputTokens !== undefined && { inputTokens }),
        ...(outputTokens !== undefined && { outputTokens }),
        ...(ttfbMs !== undefined && { ttfbMs }),
        ...(durationMs !== undefined && { durationMs }),
      };
      return {
        ...state,
        taskGroups: state.taskGroups.map((group) => {
          if (group.groupId !== groupId) return group;
          return {
            ...group,
            tasks: group.tasks.map((task) =>
              task.taskId === taskId
                ? { ...task, metrics: { ...task.metrics, ...incoming } }
                : task
            ),
          };
        }),
      };
    }

    case "WORKER_TOOL_CALL": {
      const { groupId, taskId, tool, input, timestamp } = action.payload;
      return {
        ...state,
        taskGroups: state.taskGroups.map((group) => {
          if (group.groupId !== groupId) return group;
          return {
            ...group,
            tasks: group.tasks.map((task) => {
              if (task.taskId !== taskId) return task;
              return {
                ...task,
                toolCalls: [
                  ...task.toolCalls,
                  { tool, input, timestamp },
                ],
              };
            }),
          };
        }),
      };
    }

    default:
      return state;
  }
}

const ResearchContext = createContext<ResearchState>(initialState);
const ResearchDispatchContext = createContext<Dispatch<ResearchAction>>(
  () => {}
);

export function ResearchProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(researchReducer, initialState);

  return (
    <ResearchContext.Provider value={state}>
      <ResearchDispatchContext.Provider value={dispatch}>
        {children}
      </ResearchDispatchContext.Provider>
    </ResearchContext.Provider>
  );
}

export function useResearchState() {
  return useContext(ResearchContext);
}

export function useResearchDispatch() {
  return useContext(ResearchDispatchContext);
}
