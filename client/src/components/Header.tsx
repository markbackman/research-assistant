import type { PipecatBaseChildProps } from "@pipecat-ai/voice-ui-kit";
import {
  ConnectButton,
  UserAudioControl,
  VoiceVisualizer,
} from "@pipecat-ai/voice-ui-kit";

interface HeaderProps {
  handleConnect?: PipecatBaseChildProps["handleConnect"];
  handleDisconnect?: PipecatBaseChildProps["handleDisconnect"];
}

export function Header({ handleConnect, handleDisconnect }: HeaderProps) {
  return (
    <header className="flex items-center justify-between px-6 py-3 border-b border-border">
      <h1 className="text-lg font-semibold">Research Assistant</h1>
      <div className="flex items-center gap-4">
        <VoiceVisualizer
          participantType="bot"
          barCount={5}
          barWidth={4}
          barGap={3}
          barMaxHeight={20}
          className="h-6 w-10"
        />
        <UserAudioControl size="sm" />
        <ConnectButton
          size="sm"
          onConnect={handleConnect}
          onDisconnect={handleDisconnect}
        />
      </div>
    </header>
  );
}
