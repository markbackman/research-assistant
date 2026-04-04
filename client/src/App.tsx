import type { PipecatBaseChildProps } from "@pipecat-ai/voice-ui-kit";
import { useResearchMessages } from "./hooks/useResearchMessages";
import { Header } from "./components/Header";
import { ResearchPanel } from "./components/ResearchPanel";
import { AgentDashboard } from "./components/AgentDashboard";

interface AppProps {
  handleConnect?: PipecatBaseChildProps["handleConnect"];
  handleDisconnect?: PipecatBaseChildProps["handleDisconnect"];
}

export function App({ handleConnect, handleDisconnect }: AppProps) {
  useResearchMessages();

  return (
    <div className="flex flex-col h-dvh">
      <Header
        handleConnect={handleConnect}
        handleDisconnect={handleDisconnect}
      />
      <div className="flex flex-1 overflow-hidden">
        <ResearchPanel />
        <AgentDashboard />
      </div>
    </div>
  );
}
