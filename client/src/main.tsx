import { StrictMode, useState } from 'react';
import { createRoot } from 'react-dom/client';

import type { APIRequest, TransportConnectionParams } from '@pipecat-ai/client-js';
import type { PipecatBaseChildProps } from '@pipecat-ai/voice-ui-kit';
import {
  PipecatAppBase,
  SpinLoader,
  ErrorCard,
} from '@pipecat-ai/voice-ui-kit';

import { ResearchProvider } from './context/ResearchContext';
import { App } from './App';
import { DEFAULT_TRANSPORT, TRANSPORT_CONFIG, botBaseUrl } from './config';
import type { TransportType } from './config';

import './index.css';

// Daily: strip sessionId (Daily transport rejects unknown properties)
function dailyTransformer(
  response: TransportConnectionParams,
): TransportConnectionParams {
  const { sessionId: _, ...rest } = response as Record<string, unknown>;
  return rest as TransportConnectionParams;
}

// SmallWebRTC: convert sessionId into webrtcRequestParams pointing at the
// session proxy endpoint for the SDP exchange
function smallWebRTCTransformer(
  response: TransportConnectionParams,
): TransportConnectionParams {
  const { sessionId } = response as Record<string, unknown>;
  return {
    webrtcRequestParams: {
      endpoint: `${botBaseUrl}/sessions/${sessionId}/api/offer`,
    },
  } as TransportConnectionParams;
}

const transformers: Record<
  TransportType,
  (r: TransportConnectionParams) => TransportConnectionParams
> = {
  daily: dailyTransformer,
  smallwebrtc: smallWebRTCTransformer,
};

const Main = () => {
  const [transportType] = useState<TransportType>(DEFAULT_TRANSPORT);
  const config = TRANSPORT_CONFIG[transportType];

  return (
    <ResearchProvider>
      <PipecatAppBase
        startBotParams={config as APIRequest}
        startBotResponseTransformer={transformers[transportType]}
        transportType={transportType}
        noThemeProvider>
        {({
          client,
          handleConnect,
          handleDisconnect,
          error,
        }: PipecatBaseChildProps) =>
          !client ? (
            <div className="flex items-center justify-center h-dvh">
              <SpinLoader />
            </div>
          ) : error ? (
            <div className="flex items-center justify-center h-dvh">
              <ErrorCard>{error}</ErrorCard>
            </div>
          ) : (
            <App
              handleConnect={handleConnect}
              handleDisconnect={handleDisconnect}
            />
          )
        }
      </PipecatAppBase>
    </ResearchProvider>
  );
};

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Main />
  </StrictMode>,
);
