import { StrictMode, useState } from 'react';
import { createRoot } from 'react-dom/client';

import type { PipecatBaseChildProps } from '@pipecat-ai/voice-ui-kit';
import {
  PipecatAppBase,
  SpinLoader,
  ErrorCard,
} from '@pipecat-ai/voice-ui-kit';

import { ResearchProvider } from './context/ResearchContext';
import { App } from './App';
import { DEFAULT_TRANSPORT, TRANSPORT_CONFIG } from './config';
import type { TransportType } from './config';

import './index.css';

const Main = () => {
  const [transportType] = useState<TransportType>(DEFAULT_TRANSPORT);
  const connectParams = TRANSPORT_CONFIG[transportType];

  return (
    <ResearchProvider>
      <PipecatAppBase
        connectParams={connectParams}
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
