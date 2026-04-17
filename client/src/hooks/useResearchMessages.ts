import { RTVIEvent } from "@pipecat-ai/client-js";
import { useRTVIClientEvent } from "@pipecat-ai/client-react";
import { useResearchDispatch } from "../context/ResearchContext";
import type { ServerMessage } from "../types";

export function useResearchMessages() {
  const dispatch = useResearchDispatch();

  useRTVIClientEvent(RTVIEvent.ServerMessage, (data: unknown) => {
    const message = data as ServerMessage;
    if (!message || !message.type) return;

    switch (message.type) {
      case "task_group_started":
        dispatch({ type: "TASK_GROUP_STARTED", payload: message });
        break;
      case "task_update":
        dispatch({ type: "TASK_UPDATE", payload: message });
        break;
      case "research_result":
        dispatch({ type: "RESEARCH_RESULT", payload: message });
        break;
      case "task_group_completed":
        dispatch({ type: "TASK_GROUP_COMPLETED", payload: message });
        break;
      case "summary_update":
        dispatch({ type: "SUMMARY_UPDATE", payload: message });
        break;
      case "worker_tool_call":
        dispatch({ type: "WORKER_TOOL_CALL", payload: message });
        break;
      case "agent_metrics":
        dispatch({ type: "AGENT_METRICS", payload: message });
        break;
    }
  });
}
