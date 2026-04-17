export interface ToolCall {
  tool: string;
  input: Record<string, unknown>;
  timestamp: string;
}

export interface AgentMetrics {
  inputTokens?: number;
  outputTokens?: number;
  ttfbMs?: number;
  durationMs?: number;
}

export interface TaskInfo {
  taskId: string;
  topic: string;
  status: "pending" | "running" | "completed" | "error";
  detail?: string;
  startedAt?: string;
  completedAt?: string;
  toolCalls: ToolCall[];
  metrics?: AgentMetrics;
}

export interface TaskGroup {
  groupId: string;
  query: string;
  tasks: TaskInfo[];
  completed: boolean;
  startedAt?: string;
  completedAt?: string;
}

export interface ResearchResult {
  groupId: string;
  taskId: string;
  topic: string;
  summary: string;
  sources: string[];
}

export interface SummaryData {
  groupId: string;
  summary: string;
  keyFindings: string[];
}

export interface ResearchState {
  taskGroups: TaskGroup[];
  researchResults: ResearchResult[];
  summaries: Record<string, SummaryData>;
}

// Backend message types
export interface TaskGroupStartedMessage {
  type: "task_group_started";
  timestamp?: string;
  groupId: string;
  query: string;
  tasks: { taskId: string; topic: string; status: string }[];
}

export interface TaskUpdateMessage {
  type: "task_update";
  timestamp?: string;
  groupId: string;
  taskId: string;
  status: string;
  detail?: string;
}

export interface ResearchResultMessage {
  type: "research_result";
  timestamp?: string;
  groupId: string;
  taskId: string;
  topic: string;
  summary: string;
  sources: string[];
}

export interface TaskGroupCompletedMessage {
  type: "task_group_completed";
  timestamp?: string;
  groupId: string;
}

export interface SummaryUpdateMessage {
  type: "summary_update";
  timestamp?: string;
  groupId: string;
  summary: string;
  keyFindings: string[];
}

export interface AgentEventMessage {
  type: "agent_event";
  timestamp: string;
  agent: string;
  agentType: string;
  event: string;
  target?: string;
  groupId?: string;
  detail?: string;
}

export interface WorkerToolCallMessage {
  type: "worker_tool_call";
  timestamp: string;
  groupId: string;
  taskId: string;
  tool: string;
  input: Record<string, unknown>;
}

export interface AgentMetricsMessage {
  type: "agent_metrics";
  timestamp?: string;
  groupId: string;
  agent: string;
  taskId: string;
  inputTokens?: number;
  outputTokens?: number;
  ttfbMs?: number;
  durationMs?: number;
}

export type ServerMessage =
  | TaskGroupStartedMessage
  | TaskUpdateMessage
  | ResearchResultMessage
  | TaskGroupCompletedMessage
  | SummaryUpdateMessage
  | AgentEventMessage
  | WorkerToolCallMessage
  | AgentMetricsMessage;

// Reducer actions
export type ResearchAction =
  | { type: "TASK_GROUP_STARTED"; payload: TaskGroupStartedMessage }
  | { type: "TASK_UPDATE"; payload: TaskUpdateMessage }
  | { type: "RESEARCH_RESULT"; payload: ResearchResultMessage }
  | { type: "TASK_GROUP_COMPLETED"; payload: TaskGroupCompletedMessage }
  | { type: "SUMMARY_UPDATE"; payload: SummaryUpdateMessage }
  | { type: "WORKER_TOOL_CALL"; payload: WorkerToolCallMessage }
  | { type: "AGENT_METRICS"; payload: AgentMetricsMessage };
